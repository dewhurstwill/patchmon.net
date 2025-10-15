const express = require("express");
const { authenticateToken } = require("../middleware/auth");
const {
	getConnectionInfo,
	subscribeToConnectionChanges,
} = require("../services/agentWs");

const router = express.Router();

// Get WebSocket connection status by api_id (no database access - pure memory lookup)
router.get("/status/:apiId", authenticateToken, async (req, res) => {
	try {
		const { apiId } = req.params;

		// Direct in-memory check - no database query needed
		const connectionInfo = getConnectionInfo(apiId);

		// Minimal response for maximum speed
		res.json({
			success: true,
			data: connectionInfo,
		});
	} catch (error) {
		console.error("Error fetching WebSocket status:", error);
		res.status(500).json({
			success: false,
			error: "Failed to fetch WebSocket status",
		});
	}
});

// Server-Sent Events endpoint for real-time status updates (no polling needed!)
router.get("/status/:apiId/stream", async (req, res) => {
	try {
		const { apiId } = req.params;

		// Manual authentication for SSE (EventSource doesn't support custom headers)
		const token =
			req.query.token || req.headers.authorization?.replace("Bearer ", "");
		if (!token) {
			return res.status(401).json({ error: "Authentication required" });
		}

		// Verify token manually
		const jwt = require("jsonwebtoken");
		try {
			const decoded = jwt.verify(token, process.env.JWT_SECRET);
			req.user = decoded;
		} catch (_err) {
			console.error("[SSE] Invalid token for api_id:", apiId);
			return res.status(401).json({ error: "Invalid or expired token" });
		}

		console.log("[SSE] Client connected for api_id:", apiId);

		// Set headers for SSE
		res.setHeader("Content-Type", "text/event-stream");
		res.setHeader("Cache-Control", "no-cache");
		res.setHeader("Connection", "keep-alive");
		res.setHeader("X-Accel-Buffering", "no"); // Disable nginx buffering

		// Send initial status immediately
		const initialInfo = getConnectionInfo(apiId);
		res.write(`data: ${JSON.stringify(initialInfo)}\n\n`);
		res.flushHeaders(); // Ensure headers are sent immediately

		// Subscribe to connection changes for this specific api_id
		const unsubscribe = subscribeToConnectionChanges(apiId, (_connected) => {
			try {
				// Push update to client instantly when status changes
				const connectionInfo = getConnectionInfo(apiId);
				console.log(
					`[SSE] Pushing status change for ${apiId}: connected=${connectionInfo.connected} secure=${connectionInfo.secure}`,
				);
				res.write(`data: ${JSON.stringify(connectionInfo)}\n\n`);
			} catch (err) {
				console.error("[SSE] Error writing to stream:", err);
			}
		});

		// Heartbeat to keep connection alive (every 30 seconds)
		const heartbeat = setInterval(() => {
			try {
				res.write(": heartbeat\n\n");
			} catch (err) {
				console.error("[SSE] Error writing heartbeat:", err);
				clearInterval(heartbeat);
			}
		}, 30000);

		// Cleanup on client disconnect
		req.on("close", () => {
			console.log("[SSE] Client disconnected for api_id:", apiId);
			clearInterval(heartbeat);
			unsubscribe();
		});

		// Handle errors
		req.on("error", (err) => {
			console.error("[SSE] Request error:", err);
			clearInterval(heartbeat);
			unsubscribe();
		});
	} catch (error) {
		console.error("[SSE] Unexpected error:", error);
		if (!res.headersSent) {
			res.status(500).json({ error: "Internal server error" });
		}
	}
});

module.exports = router;
