// Lightweight WebSocket hub for agent connections
// Auth: X-API-ID / X-API-KEY headers on the upgrade request

const WebSocket = require("ws");
const url = require("node:url");

// Connection registry by api_id
const apiIdToSocket = new Map();

// Connection metadata (secure/insecure)
// Map<api_id, { ws: WebSocket, secure: boolean }>
const connectionMetadata = new Map();

// Subscribers for connection status changes (for SSE)
// Map<api_id, Set<callback>>
const connectionChangeSubscribers = new Map();

let wss;
let prisma;

function init(server, prismaClient) {
	prisma = prismaClient;
	wss = new WebSocket.Server({ noServer: true });

	// Handle HTTP upgrade events and authenticate before accepting WS
	server.on("upgrade", async (request, socket, head) => {
		try {
			const { pathname } = url.parse(request.url);
			if (!pathname || !pathname.startsWith("/api/")) {
				socket.destroy();
				return;
			}

			// Expected path: /api/{v}/agents/ws
			const parts = pathname.split("/").filter(Boolean); // [api, v1, agents, ws]
			if (parts.length !== 4 || parts[2] !== "agents" || parts[3] !== "ws") {
				socket.destroy();
				return;
			}

			const apiId = request.headers["x-api-id"];
			const apiKey = request.headers["x-api-key"];
			if (!apiId || !apiKey) {
				socket.destroy();
				return;
			}

			// Validate credentials
			const host = await prisma.hosts.findUnique({ where: { api_id: apiId } });
			if (!host || host.api_key !== apiKey) {
				socket.destroy();
				return;
			}

			wss.handleUpgrade(request, socket, head, (ws) => {
				ws.apiId = apiId;

				// Detect if connection is secure (wss://) or not (ws://)
				const isSecure =
					socket.encrypted || request.headers["x-forwarded-proto"] === "https";

				apiIdToSocket.set(apiId, ws);
				connectionMetadata.set(apiId, { ws, secure: isSecure });

				console.log(
					`[agent-ws] connected api_id=${apiId} protocol=${isSecure ? "wss" : "ws"} total=${apiIdToSocket.size}`,
				);

				// Notify subscribers of connection
				notifyConnectionChange(apiId, true);

				ws.on("message", () => {
					// Currently we don't need to handle agent->server messages
				});

				ws.on("close", () => {
					const existing = apiIdToSocket.get(apiId);
					if (existing === ws) {
						apiIdToSocket.delete(apiId);
						connectionMetadata.delete(apiId);
						// Notify subscribers of disconnection
						notifyConnectionChange(apiId, false);
					}
					console.log(
						`[agent-ws] disconnected api_id=${apiId} total=${apiIdToSocket.size}`,
					);
				});

				// Optional: greet/ack
				safeSend(ws, JSON.stringify({ type: "connected" }));
			});
		} catch (_err) {
			try {
				socket.destroy();
			} catch {
				/* ignore */
			}
		}
	});
}

function safeSend(ws, data) {
	if (ws && ws.readyState === WebSocket.OPEN) {
		try {
			ws.send(data);
		} catch {
			/* ignore */
		}
	}
}

function broadcastSettingsUpdate(newInterval) {
	const payload = JSON.stringify({
		type: "settings_update",
		update_interval: newInterval,
	});
	for (const [, ws] of apiIdToSocket) {
		safeSend(ws, payload);
	}
}

function pushReportNow(apiId) {
	const ws = apiIdToSocket.get(apiId);
	safeSend(ws, JSON.stringify({ type: "report_now" }));
}

function pushSettingsUpdate(apiId, newInterval) {
	const ws = apiIdToSocket.get(apiId);
	safeSend(
		ws,
		JSON.stringify({ type: "settings_update", update_interval: newInterval }),
	);
}

function pushUpdateNotification(apiId, updateInfo) {
	const ws = apiIdToSocket.get(apiId);
	if (ws && ws.readyState === WebSocket.OPEN) {
		safeSend(
			ws,
			JSON.stringify({
				type: "update_notification",
				version: updateInfo.version,
				force: updateInfo.force || false,
				downloadUrl: updateInfo.downloadUrl,
				message: updateInfo.message,
			}),
		);
		console.log(
			`📤 Pushed update notification to agent ${apiId}: version ${updateInfo.version}`,
		);
		return true;
	} else {
		console.log(
			`⚠️ Agent ${apiId} not connected, cannot push update notification`,
		);
		return false;
	}
}

async function pushUpdateNotificationToAll(updateInfo) {
	let notifiedCount = 0;
	let failedCount = 0;

	for (const [apiId, ws] of apiIdToSocket) {
		if (ws && ws.readyState === WebSocket.OPEN) {
			try {
				safeSend(
					ws,
					JSON.stringify({
						type: "update_notification",
						version: updateInfo.version,
						force: updateInfo.force || false,
						message: updateInfo.message,
					}),
				);
				notifiedCount++;
				console.log(
					`📤 Pushed update notification to agent ${apiId}: version ${updateInfo.version}`,
				);
			} catch (error) {
				failedCount++;
				console.error(`❌ Failed to notify agent ${apiId}:`, error.message);
			}
		} else {
			failedCount++;
		}
	}

	console.log(
		`📤 Update notification sent to ${notifiedCount} agents, ${failedCount} failed`,
	);
	return { notifiedCount, failedCount };
}

// Notify all subscribers when connection status changes
function notifyConnectionChange(apiId, connected) {
	const subscribers = connectionChangeSubscribers.get(apiId);
	if (subscribers) {
		for (const callback of subscribers) {
			try {
				callback(connected);
			} catch (err) {
				console.error(`[agent-ws] error notifying subscriber:`, err);
			}
		}
	}
}

// Subscribe to connection status changes for a specific api_id
function subscribeToConnectionChanges(apiId, callback) {
	if (!connectionChangeSubscribers.has(apiId)) {
		connectionChangeSubscribers.set(apiId, new Set());
	}
	connectionChangeSubscribers.get(apiId).add(callback);

	// Return unsubscribe function
	return () => {
		const subscribers = connectionChangeSubscribers.get(apiId);
		if (subscribers) {
			subscribers.delete(callback);
			if (subscribers.size === 0) {
				connectionChangeSubscribers.delete(apiId);
			}
		}
	};
}

module.exports = {
	init,
	broadcastSettingsUpdate,
	pushReportNow,
	pushSettingsUpdate,
	pushUpdateNotification,
	pushUpdateNotificationToAll,
	// Expose read-only view of connected agents
	getConnectedApiIds: () => Array.from(apiIdToSocket.keys()),
	isConnected: (apiId) => {
		const ws = apiIdToSocket.get(apiId);
		return !!ws && ws.readyState === WebSocket.OPEN;
	},
	// Get connection info including protocol (ws/wss)
	getConnectionInfo: (apiId) => {
		const metadata = connectionMetadata.get(apiId);
		if (!metadata) {
			return { connected: false, secure: false };
		}
		const connected = metadata.ws.readyState === WebSocket.OPEN;
		return { connected, secure: metadata.secure };
	},
	// Subscribe to connection status changes (for SSE)
	subscribeToConnectionChanges,
};
