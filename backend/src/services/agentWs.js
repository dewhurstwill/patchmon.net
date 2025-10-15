// Lightweight WebSocket hub for agent connections
// Auth: X-API-ID / X-API-KEY headers on the upgrade request

const WebSocket = require("ws");
const url = require("node:url");

// Connection registry by api_id
const apiIdToSocket = new Map();

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
				apiIdToSocket.set(apiId, ws);
				console.log(
					`[agent-ws] connected api_id=${apiId} total=${apiIdToSocket.size}`,
				);

				ws.on("message", () => {
					// Currently we don't need to handle agent->server messages
				});

				ws.on("close", () => {
					const existing = apiIdToSocket.get(apiId);
					if (existing === ws) {
						apiIdToSocket.delete(apiId);
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

module.exports = {
	init,
	broadcastSettingsUpdate,
	pushReportNow,
	pushSettingsUpdate,
	// Expose read-only view of connected agents
	getConnectedApiIds: () => Array.from(apiIdToSocket.keys()),
	isConnected: (apiId) => {
		const ws = apiIdToSocket.get(apiId);
		return !!ws && ws.readyState === WebSocket.OPEN;
	},
};
