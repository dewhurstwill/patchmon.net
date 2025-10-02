const jwt = require("jsonwebtoken");
const { PrismaClient } = require("@prisma/client");
const {
	validate_session,
	update_session_activity,
} = require("../utils/session_manager");

const prisma = new PrismaClient();

// Middleware to verify JWT token with session validation
const authenticateToken = async (req, res, next) => {
	try {
		const authHeader = req.headers.authorization;
		const token = authHeader?.split(" ")[1]; // Bearer TOKEN

		if (!token) {
			return res.status(401).json({ error: "Access token required" });
		}

		// Verify token
		const decoded = jwt.verify(
			token,
			process.env.JWT_SECRET || "your-secret-key",
		);

		// Validate session and check inactivity timeout
		const validation = await validate_session(decoded.sessionId, token);

		if (!validation.valid) {
			const error_messages = {
				"Session not found": "Session not found",
				"Session revoked": "Session has been revoked",
				"Session expired": "Session has expired",
				"Session inactive":
					validation.message || "Session timed out due to inactivity",
				"Token mismatch": "Invalid token",
				"User inactive": "User account is inactive",
			};

			return res.status(401).json({
				error: error_messages[validation.reason] || "Authentication failed",
				reason: validation.reason,
			});
		}

		// Update session activity timestamp
		await update_session_activity(decoded.sessionId);

		// Update last login (only on successful authentication)
		await prisma.users.update({
			where: { id: validation.user.id },
			data: {
				last_login: new Date(),
				updated_at: new Date(),
			},
		});

		req.user = validation.user;
		req.session_id = decoded.sessionId;
		next();
	} catch (error) {
		if (error.name === "JsonWebTokenError") {
			return res.status(401).json({ error: "Invalid token" });
		}
		if (error.name === "TokenExpiredError") {
			return res.status(401).json({ error: "Token expired" });
		}
		console.error("Auth middleware error:", error);
		return res.status(500).json({ error: "Authentication failed" });
	}
};

// Middleware to check admin role
const requireAdmin = (req, res, next) => {
	if (req.user.role !== "admin") {
		return res.status(403).json({ error: "Admin access required" });
	}
	next();
};

// Middleware to check if user is authenticated (optional)
const optionalAuth = async (req, _res, next) => {
	try {
		const authHeader = req.headers.authorization;
		const token = authHeader?.split(" ")[1];

		if (token) {
			const decoded = jwt.verify(
				token,
				process.env.JWT_SECRET || "your-secret-key",
			);
			const user = await prisma.users.findUnique({
				where: { id: decoded.userId },
				select: {
					id: true,
					username: true,
					email: true,
					role: true,
					is_active: true,
					last_login: true,
					created_at: true,
					updated_at: true,
				},
			});

			if (user?.is_active) {
				req.user = user;
			}
		}
		next();
	} catch {
		// Continue without authentication for optional auth
		next();
	}
};

module.exports = {
	authenticateToken,
	requireAdmin,
	optionalAuth,
};
