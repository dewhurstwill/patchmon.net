const jwt = require("jsonwebtoken");
const crypto = require("node:crypto");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

/**
 * Session Manager - Handles secure session management with inactivity timeout
 */

// Configuration
if (!process.env.JWT_SECRET) {
	throw new Error("JWT_SECRET environment variable is required");
}
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "1h";
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || "7d";
const INACTIVITY_TIMEOUT_MINUTES = parseInt(
	process.env.SESSION_INACTIVITY_TIMEOUT_MINUTES || "30",
	10,
);

/**
 * Generate access token (short-lived)
 */
function generate_access_token(user_id, session_id) {
	return jwt.sign({ userId: user_id, sessionId: session_id }, JWT_SECRET, {
		expiresIn: JWT_EXPIRES_IN,
	});
}

/**
 * Generate refresh token (long-lived)
 */
function generate_refresh_token() {
	return crypto.randomBytes(64).toString("hex");
}

/**
 * Hash token for storage
 */
function hash_token(token) {
	return crypto.createHash("sha256").update(token).digest("hex");
}

/**
 * Parse expiration string to Date
 */
function parse_expiration(expiration_string) {
	const match = expiration_string.match(/^(\d+)([smhd])$/);
	if (!match) {
		throw new Error("Invalid expiration format");
	}

	const value = parseInt(match[1], 10);
	const unit = match[2];

	const now = new Date();
	switch (unit) {
		case "s":
			return new Date(now.getTime() + value * 1000);
		case "m":
			return new Date(now.getTime() + value * 60 * 1000);
		case "h":
			return new Date(now.getTime() + value * 60 * 60 * 1000);
		case "d":
			return new Date(now.getTime() + value * 24 * 60 * 60 * 1000);
		default:
			throw new Error("Invalid time unit");
	}
}

/**
 * Create a new session for user
 */
async function create_session(user_id, ip_address, user_agent) {
	try {
		const session_id = crypto.randomUUID();
		const refresh_token = generate_refresh_token();
		const access_token = generate_access_token(user_id, session_id);

		const expires_at = parse_expiration(JWT_REFRESH_EXPIRES_IN);

		// Store session in database
		await prisma.user_sessions.create({
			data: {
				id: session_id,
				user_id: user_id,
				refresh_token: hash_token(refresh_token),
				access_token_hash: hash_token(access_token),
				ip_address: ip_address || null,
				user_agent: user_agent || null,
				last_activity: new Date(),
				expires_at: expires_at,
			},
		});

		return {
			session_id,
			access_token,
			refresh_token,
			expires_at,
		};
	} catch (error) {
		console.error("Error creating session:", error);
		throw error;
	}
}

/**
 * Validate session and check for inactivity timeout
 */
async function validate_session(session_id, access_token) {
	try {
		const session = await prisma.user_sessions.findUnique({
			where: { id: session_id },
			include: { users: true },
		});

		if (!session) {
			return { valid: false, reason: "Session not found" };
		}

		// Check if session is revoked
		if (session.is_revoked) {
			return { valid: false, reason: "Session revoked" };
		}

		// Check if session has expired
		if (new Date() > session.expires_at) {
			await revoke_session(session_id);
			return { valid: false, reason: "Session expired" };
		}

		// Check for inactivity timeout
		const inactivity_threshold = new Date(
			Date.now() - INACTIVITY_TIMEOUT_MINUTES * 60 * 1000,
		);
		if (session.last_activity < inactivity_threshold) {
			await revoke_session(session_id);
			return {
				valid: false,
				reason: "Session inactive",
				message: `Session timed out after ${INACTIVITY_TIMEOUT_MINUTES} minutes of inactivity`,
			};
		}

		// Validate access token hash (optional security check)
		if (session.access_token_hash) {
			const provided_hash = hash_token(access_token);
			if (session.access_token_hash !== provided_hash) {
				return { valid: false, reason: "Token mismatch" };
			}
		}

		// Check if user is still active
		if (!session.users.is_active) {
			await revoke_session(session_id);
			return { valid: false, reason: "User inactive" };
		}

		return {
			valid: true,
			session,
			user: session.users,
		};
	} catch (error) {
		console.error("Error validating session:", error);
		return { valid: false, reason: "Validation error" };
	}
}

/**
 * Update session activity timestamp
 */
async function update_session_activity(session_id) {
	try {
		await prisma.user_sessions.update({
			where: { id: session_id },
			data: { last_activity: new Date() },
		});
		return true;
	} catch (error) {
		console.error("Error updating session activity:", error);
		return false;
	}
}

/**
 * Refresh access token using refresh token
 */
async function refresh_access_token(refresh_token) {
	try {
		const hashed_token = hash_token(refresh_token);

		const session = await prisma.user_sessions.findUnique({
			where: { refresh_token: hashed_token },
			include: { users: true },
		});

		if (!session) {
			return { success: false, error: "Invalid refresh token" };
		}

		// Validate session
		const validation = await validate_session(session.id, "");
		if (!validation.valid) {
			return { success: false, error: validation.reason };
		}

		// Generate new access token
		const new_access_token = generate_access_token(session.user_id, session.id);

		// Update access token hash
		await prisma.user_sessions.update({
			where: { id: session.id },
			data: {
				access_token_hash: hash_token(new_access_token),
				last_activity: new Date(),
			},
		});

		return {
			success: true,
			access_token: new_access_token,
			user: session.users,
		};
	} catch (error) {
		console.error("Error refreshing access token:", error);
		return { success: false, error: "Token refresh failed" };
	}
}

/**
 * Revoke a session
 */
async function revoke_session(session_id) {
	try {
		await prisma.user_sessions.update({
			where: { id: session_id },
			data: { is_revoked: true },
		});
		return true;
	} catch (error) {
		console.error("Error revoking session:", error);
		return false;
	}
}

/**
 * Revoke all sessions for a user
 */
async function revoke_all_user_sessions(user_id) {
	try {
		await prisma.user_sessions.updateMany({
			where: { user_id: user_id },
			data: { is_revoked: true },
		});
		return true;
	} catch (error) {
		console.error("Error revoking user sessions:", error);
		return false;
	}
}

/**
 * Clean up expired sessions (should be run periodically)
 */
async function cleanup_expired_sessions() {
	try {
		const result = await prisma.user_sessions.deleteMany({
			where: {
				OR: [{ expires_at: { lt: new Date() } }, { is_revoked: true }],
			},
		});
		console.log(`Cleaned up ${result.count} expired sessions`);
		return result.count;
	} catch (error) {
		console.error("Error cleaning up sessions:", error);
		return 0;
	}
}

/**
 * Get active sessions for a user
 */
async function get_user_sessions(user_id) {
	try {
		return await prisma.user_sessions.findMany({
			where: {
				user_id: user_id,
				is_revoked: false,
				expires_at: { gt: new Date() },
			},
			select: {
				id: true,
				ip_address: true,
				user_agent: true,
				last_activity: true,
				created_at: true,
				expires_at: true,
			},
			orderBy: { last_activity: "desc" },
		});
	} catch (error) {
		console.error("Error getting user sessions:", error);
		return [];
	}
}

module.exports = {
	create_session,
	validate_session,
	update_session_activity,
	refresh_access_token,
	revoke_session,
	revoke_all_user_sessions,
	cleanup_expired_sessions,
	get_user_sessions,
	generate_access_token,
	INACTIVITY_TIMEOUT_MINUTES,
};
