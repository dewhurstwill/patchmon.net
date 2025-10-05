const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { PrismaClient } = require("@prisma/client");
const { body, validationResult } = require("express-validator");
const { authenticateToken, _requireAdmin } = require("../middleware/auth");
const {
	requireViewUsers,
	requireManageUsers,
} = require("../middleware/permissions");
const { v4: uuidv4 } = require("uuid");
const {
	createDefaultDashboardPreferences,
} = require("./dashboardPreferencesRoutes");
const {
	create_session,
	refresh_access_token,
	revoke_session,
	revoke_all_user_sessions,
	get_user_sessions,
} = require("../utils/session_manager");

const router = express.Router();
const prisma = new PrismaClient();

// Check if any admin users exist (for first-time setup)
router.get("/check-admin-users", async (_req, res) => {
	try {
		const adminCount = await prisma.users.count({
			where: { role: "admin" },
		});

		res.json({
			hasAdminUsers: adminCount > 0,
			adminCount: adminCount,
		});
	} catch (error) {
		console.error("Error checking admin users:", error);
		res.status(500).json({
			error: "Failed to check admin users",
			hasAdminUsers: true, // Assume admin exists for security
		});
	}
});

// Create first admin user (for first-time setup)
router.post(
	"/setup-admin",
	[
		body("firstName")
			.isLength({ min: 1 })
			.withMessage("First name is required"),
		body("lastName").isLength({ min: 1 }).withMessage("Last name is required"),
		body("username").isLength({ min: 1 }).withMessage("Username is required"),
		body("email").isEmail().withMessage("Valid email is required"),
		body("password")
			.isLength({ min: 8 })
			.withMessage("Password must be at least 8 characters for security"),
	],
	async (req, res) => {
		try {
			const errors = validationResult(req);
			if (!errors.isEmpty()) {
				return res.status(400).json({
					error: "Validation failed",
					details: errors.array(),
				});
			}

			const { firstName, lastName, username, email, password } = req.body;

			// Check if any admin users already exist
			const adminCount = await prisma.users.count({
				where: { role: "admin" },
			});

			if (adminCount > 0) {
				return res.status(400).json({
					error:
						"Admin users already exist. This endpoint is only for first-time setup.",
				});
			}

			// Check if username or email already exists
			const existingUser = await prisma.users.findFirst({
				where: {
					OR: [{ username: username.trim() }, { email: email.trim() }],
				},
			});

			if (existingUser) {
				return res.status(400).json({
					error: "Username or email already exists",
				});
			}

			// Hash password
			const passwordHash = await bcrypt.hash(password, 12);

			// Create admin user
			const user = await prisma.users.create({
				data: {
					id: uuidv4(),
					username: username.trim(),
					email: email.trim(),
					password_hash: passwordHash,
					first_name: firstName.trim(),
					last_name: lastName.trim(),
					role: "admin",
					is_active: true,
					created_at: new Date(),
					updated_at: new Date(),
				},
				select: {
					id: true,
					username: true,
					email: true,
					first_name: true,
					last_name: true,
					role: true,
					created_at: true,
				},
			});

			// Create default dashboard preferences for the new admin user
			await createDefaultDashboardPreferences(user.id, "admin");

			// Create session for immediate login
			const ip_address = req.ip || req.connection.remoteAddress;
			const user_agent = req.get("user-agent");
			const session = await create_session(user.id, ip_address, user_agent);

			res.status(201).json({
				message: "Admin user created successfully",
				token: session.access_token,
				refresh_token: session.refresh_token,
				expires_at: session.expires_at,
				user: {
					id: user.id,
					username: user.username,
					email: user.email,
					role: user.role,
					first_name: user.first_name,
					last_name: user.last_name,
					is_active: user.is_active,
				},
			});
		} catch (error) {
			console.error("Error creating admin user:", error);
			res.status(500).json({
				error: "Failed to create admin user",
			});
		}
	},
);

// Generate JWT token
const generateToken = (userId) => {
	if (!process.env.JWT_SECRET) {
		throw new Error("JWT_SECRET environment variable is required");
	}
	return jwt.sign({ userId }, process.env.JWT_SECRET, {
		expiresIn: process.env.JWT_EXPIRES_IN || "24h",
	});
};

// Admin endpoint to list all users
router.get(
	"/admin/users",
	authenticateToken,
	requireViewUsers,
	async (_req, res) => {
		try {
			const users = await prisma.users.findMany({
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
				orderBy: {
					created_at: "desc",
				},
			});

			res.json(users);
		} catch (error) {
			console.error("List users error:", error);
			res.status(500).json({ error: "Failed to fetch users" });
		}
	},
);

// Admin endpoint to create a new user
router.post(
	"/admin/users",
	authenticateToken,
	requireManageUsers,
	[
		body("username")
			.isLength({ min: 3 })
			.withMessage("Username must be at least 3 characters"),
		body("email").isEmail().withMessage("Valid email is required"),
		body("password")
			.isLength({ min: 6 })
			.withMessage("Password must be at least 6 characters"),
		body("first_name")
			.optional()
			.isLength({ min: 1 })
			.withMessage("First name must be at least 1 character"),
		body("last_name")
			.optional()
			.isLength({ min: 1 })
			.withMessage("Last name must be at least 1 character"),
		body("role")
			.optional()
			.custom(async (value) => {
				if (!value) return true; // Optional field
				// Allow built-in roles even if not in role_permissions table yet
				const builtInRoles = ["admin", "user"];
				if (builtInRoles.includes(value)) return true;
				const rolePermissions = await prisma.role_permissions.findUnique({
					where: { role: value },
				});
				if (!rolePermissions) {
					throw new Error("Invalid role specified");
				}
				return true;
			}),
	],
	async (req, res) => {
		try {
			const errors = validationResult(req);
			if (!errors.isEmpty()) {
				return res.status(400).json({ errors: errors.array() });
			}

			const { username, email, password, first_name, last_name, role } =
				req.body;

			// Get default user role from settings if no role specified
			let userRole = role;
			if (!userRole) {
				const settings = await prisma.settings.findFirst();
				userRole = settings?.default_user_role || "user";
			}

			// Check if user already exists
			const existingUser = await prisma.users.findFirst({
				where: {
					OR: [{ username }, { email }],
				},
			});

			if (existingUser) {
				return res
					.status(409)
					.json({ error: "Username or email already exists" });
			}

			// Hash password
			const passwordHash = await bcrypt.hash(password, 12);

			// Create user
			const user = await prisma.users.create({
				data: {
					id: uuidv4(),
					username,
					email,
					password_hash: passwordHash,
					first_name: first_name || null,
					last_name: last_name || null,
					role: userRole,
					updated_at: new Date(),
				},
				select: {
					id: true,
					username: true,
					email: true,
					first_name: true,
					last_name: true,
					role: true,
					is_active: true,
					created_at: true,
				},
			});

			// Create default dashboard preferences for the new user
			await createDefaultDashboardPreferences(user.id, userRole);

			res.status(201).json({
				message: "User created successfully",
				user,
			});
		} catch (error) {
			console.error("User creation error:", error);
			res.status(500).json({ error: "Failed to create user" });
		}
	},
);

// Admin endpoint to update a user
router.put(
	"/admin/users/:userId",
	authenticateToken,
	requireManageUsers,
	[
		body("username")
			.optional()
			.isLength({ min: 3 })
			.withMessage("Username must be at least 3 characters"),
		body("email").optional().isEmail().withMessage("Valid email is required"),
		body("role")
			.optional()
			.custom(async (value) => {
				if (!value) return true; // Optional field
				const rolePermissions = await prisma.role_permissions.findUnique({
					where: { role: value },
				});
				if (!rolePermissions) {
					throw new Error("Invalid role specified");
				}
				return true;
			}),
		body("isActive")
			.optional()
			.isBoolean()
			.withMessage("isActive must be a boolean"),
	],
	async (req, res) => {
		try {
			const { userId } = req.params;
			const errors = validationResult(req);

			if (!errors.isEmpty()) {
				return res.status(400).json({ errors: errors.array() });
			}

			const { username, email, role, isActive } = req.body;
			const updateData = {};

			if (username) updateData.username = username;
			if (email) updateData.email = email;
			if (role) updateData.role = role;
			if (typeof isActive === "boolean") updateData.is_active = isActive;

			// Check if user exists
			const existingUser = await prisma.users.findUnique({
				where: { id: userId },
			});

			if (!existingUser) {
				return res.status(404).json({ error: "User not found" });
			}

			// Check if username/email already exists (excluding current user)
			if (username || email) {
				const duplicateUser = await prisma.users.findFirst({
					where: {
						AND: [
							{ id: { not: userId } },
							{
								OR: [
									...(username ? [{ username }] : []),
									...(email ? [{ email }] : []),
								],
							},
						],
					},
				});

				if (duplicateUser) {
					return res
						.status(409)
						.json({ error: "Username or email already exists" });
				}
			}

			// Prevent deactivating the last admin
			if (isActive === false && existingUser.role === "admin") {
				const adminCount = await prisma.users.count({
					where: {
						role: "admin",
						is_active: true,
					},
				});

				if (adminCount <= 1) {
					return res
						.status(400)
						.json({ error: "Cannot deactivate the last admin user" });
				}
			}

			// Update user
			const updatedUser = await prisma.users.update({
				where: { id: userId },
				data: updateData,
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

			res.json({
				message: "User updated successfully",
				user: updatedUser,
			});
		} catch (error) {
			console.error("User update error:", error);
			res.status(500).json({ error: "Failed to update user" });
		}
	},
);

// Admin endpoint to delete a user
router.delete(
	"/admin/users/:userId",
	authenticateToken,
	requireManageUsers,
	async (req, res) => {
		try {
			const { userId } = req.params;

			// Prevent self-deletion
			if (userId === req.user.id) {
				return res
					.status(400)
					.json({ error: "Cannot delete your own account" });
			}

			// Check if user exists
			const user = await prisma.users.findUnique({
				where: { id: userId },
			});

			if (!user) {
				return res.status(404).json({ error: "User not found" });
			}

			// Prevent deleting the last admin
			if (user.role === "admin") {
				const adminCount = await prisma.users.count({
					where: {
						role: "admin",
						is_active: true,
					},
				});

				if (adminCount <= 1) {
					return res
						.status(400)
						.json({ error: "Cannot delete the last admin user" });
				}
			}

			// Delete user
			await prisma.users.delete({
				where: { id: userId },
			});

			res.json({
				message: "User deleted successfully",
			});
		} catch (error) {
			console.error("User deletion error:", error);
			res.status(500).json({ error: "Failed to delete user" });
		}
	},
);

// Admin endpoint to reset user password
router.post(
	"/admin/users/:userId/reset-password",
	authenticateToken,
	requireManageUsers,
	[
		body("newPassword")
			.isLength({ min: 6 })
			.withMessage("New password must be at least 6 characters"),
	],
	async (req, res) => {
		try {
			const { userId } = req.params;
			const errors = validationResult(req);

			if (!errors.isEmpty()) {
				return res.status(400).json({ errors: errors.array() });
			}

			const { newPassword } = req.body;

			// Check if user exists
			const user = await prisma.users.findUnique({
				where: { id: userId },
				select: {
					id: true,
					username: true,
					email: true,
					role: true,
					is_active: true,
				},
			});

			if (!user) {
				return res.status(404).json({ error: "User not found" });
			}

			// Prevent resetting password of inactive users
			if (!user.is_active) {
				return res
					.status(400)
					.json({ error: "Cannot reset password for inactive user" });
			}

			// Hash new password
			const passwordHash = await bcrypt.hash(newPassword, 12);

			// Update user password
			await prisma.users.update({
				where: { id: userId },
				data: { password_hash: passwordHash },
			});

			// Log the password reset action (you might want to add an audit log table)
			console.log(
				`Password reset for user ${user.username} (${user.email}) by admin ${req.user.username}`,
			);

			res.json({
				message: "Password reset successfully",
				user: {
					id: user.id,
					username: user.username,
					email: user.email,
				},
			});
		} catch (error) {
			console.error("Password reset error:", error);
			res.status(500).json({ error: "Failed to reset password" });
		}
	},
);

// Check if signup is enabled (public endpoint)
router.get("/signup-enabled", async (_req, res) => {
	try {
		const settings = await prisma.settings.findFirst();
		res.json({ signupEnabled: settings?.signup_enabled || false });
	} catch (error) {
		console.error("Error checking signup status:", error);
		res.status(500).json({ error: "Failed to check signup status" });
	}
});

// Public signup endpoint
router.post(
	"/signup",
	[
		body("firstName")
			.isLength({ min: 1 })
			.withMessage("First name is required"),
		body("lastName").isLength({ min: 1 }).withMessage("Last name is required"),
		body("username")
			.isLength({ min: 3 })
			.withMessage("Username must be at least 3 characters"),
		body("email").isEmail().withMessage("Valid email is required"),
		body("password")
			.isLength({ min: 6 })
			.withMessage("Password must be at least 6 characters"),
	],
	async (req, res) => {
		try {
			// Check if signup is enabled
			const settings = await prisma.settings.findFirst();
			if (!settings?.signup_enabled) {
				return res
					.status(403)
					.json({ error: "User signup is currently disabled" });
			}

			const errors = validationResult(req);
			if (!errors.isEmpty()) {
				return res.status(400).json({ errors: errors.array() });
			}

			const { firstName, lastName, username, email, password } = req.body;

			// Check if user already exists
			const existingUser = await prisma.users.findFirst({
				where: {
					OR: [{ username }, { email }],
				},
			});

			if (existingUser) {
				return res
					.status(409)
					.json({ error: "Username or email already exists" });
			}

			// Hash password
			const passwordHash = await bcrypt.hash(password, 12);

			// Get default user role from settings or environment variable
			const defaultRole =
				settings?.default_user_role || process.env.DEFAULT_USER_ROLE || "user";

			// Create user with default role from settings
			const user = await prisma.users.create({
				data: {
					id: uuidv4(),
					username,
					email,
					password_hash: passwordHash,
					first_name: firstName.trim(),
					last_name: lastName.trim(),
					role: defaultRole,
					updated_at: new Date(),
				},
				select: {
					id: true,
					username: true,
					email: true,
					first_name: true,
					last_name: true,
					role: true,
					is_active: true,
					created_at: true,
				},
			});

			// Create default dashboard preferences for the new user
			await createDefaultDashboardPreferences(user.id, defaultRole);

			console.log(`New user registered: ${user.username} (${user.email})`);

			// Generate token for immediate login
			const token = generateToken(user.id);

			res.status(201).json({
				message: "Account created successfully",
				token,
				user: {
					id: user.id,
					username: user.username,
					email: user.email,
					role: user.role,
				},
			});
		} catch (error) {
			console.error("Signup error:", error);
			console.error("Signup error message:", error.message);
			console.error("Signup error stack:", error.stack);
			res.status(500).json({ error: "Failed to create account" });
		}
	},
);

// Login
router.post(
	"/login",
	[
		body("username").notEmpty().withMessage("Username is required"),
		body("password").notEmpty().withMessage("Password is required"),
	],
	async (req, res) => {
		try {
			const errors = validationResult(req);
			if (!errors.isEmpty()) {
				return res.status(400).json({ errors: errors.array() });
			}

			const { username, password } = req.body;

			// Find user by username or email
			const user = await prisma.users.findFirst({
				where: {
					OR: [{ username }, { email: username }],
					is_active: true,
				},
				select: {
					id: true,
					username: true,
					email: true,
					first_name: true,
					last_name: true,
					password_hash: true,
					role: true,
					is_active: true,
					last_login: true,
					created_at: true,
					updated_at: true,
					tfa_enabled: true,
				},
			});

			if (!user) {
				return res.status(401).json({ error: "Invalid credentials" });
			}

			// Verify password
			const isValidPassword = await bcrypt.compare(
				password,
				user.password_hash,
			);
			if (!isValidPassword) {
				return res.status(401).json({ error: "Invalid credentials" });
			}

			// Check if TFA is enabled
			if (user.tfa_enabled) {
				return res.status(200).json({
					message: "TFA verification required",
					requiresTfa: true,
					username: user.username,
				});
			}

			// Update last login
			await prisma.users.update({
				where: { id: user.id },
				data: {
					last_login: new Date(),
					updated_at: new Date(),
				},
			});

			// Create session with access and refresh tokens
			const ip_address = req.ip || req.connection.remoteAddress;
			const user_agent = req.get("user-agent");
			const session = await create_session(user.id, ip_address, user_agent);

			res.json({
				message: "Login successful",
				token: session.access_token,
				refresh_token: session.refresh_token,
				expires_at: session.expires_at,
				user: {
					id: user.id,
					username: user.username,
					email: user.email,
					role: user.role,
					is_active: user.is_active,
					last_login: user.last_login,
					created_at: user.created_at,
					updated_at: user.updated_at,
				},
			});
		} catch (error) {
			console.error("Login error:", error);
			res.status(500).json({ error: "Login failed" });
		}
	},
);

// TFA verification for login
router.post(
	"/verify-tfa",
	[
		body("username").notEmpty().withMessage("Username is required"),
		body("token")
			.isLength({ min: 6, max: 6 })
			.withMessage("Token must be 6 digits"),
		body("token").isNumeric().withMessage("Token must contain only numbers"),
	],
	async (req, res) => {
		try {
			const errors = validationResult(req);
			if (!errors.isEmpty()) {
				return res.status(400).json({ errors: errors.array() });
			}

			const { username, token } = req.body;

			// Find user
			const user = await prisma.users.findFirst({
				where: {
					OR: [{ username }, { email: username }],
					is_active: true,
					tfa_enabled: true,
				},
				select: {
					id: true,
					username: true,
					email: true,
					role: true,
					tfa_secret: true,
					tfa_backup_codes: true,
				},
			});

			if (!user) {
				return res
					.status(401)
					.json({ error: "Invalid credentials or TFA not enabled" });
			}

			// Verify TFA token using the TFA routes logic
			const speakeasy = require("speakeasy");

			// Check if it's a backup code
			const backupCodes = user.tfa_backup_codes
				? JSON.parse(user.tfa_backup_codes)
				: [];
			const isBackupCode = backupCodes.includes(token);

			let verified = false;

			if (isBackupCode) {
				// Remove the used backup code
				const updatedBackupCodes = backupCodes.filter((code) => code !== token);
				await prisma.users.update({
					where: { id: user.id },
					data: {
						tfa_backup_codes: JSON.stringify(updatedBackupCodes),
					},
				});
				verified = true;
			} else {
				// Verify TOTP token
				verified = speakeasy.totp.verify({
					secret: user.tfa_secret,
					encoding: "base32",
					token: token,
					window: 2,
				});
			}

			if (!verified) {
				return res.status(401).json({ error: "Invalid verification code" });
			}

			// Update last login
			await prisma.users.update({
				where: { id: user.id },
				data: { last_login: new Date() },
			});

			// Create session with access and refresh tokens
			const ip_address = req.ip || req.connection.remoteAddress;
			const user_agent = req.get("user-agent");
			const session = await create_session(user.id, ip_address, user_agent);

			res.json({
				message: "Login successful",
				token: session.access_token,
				refresh_token: session.refresh_token,
				expires_at: session.expires_at,
				user: {
					id: user.id,
					username: user.username,
					email: user.email,
					first_name: user.first_name,
					last_name: user.last_name,
					role: user.role,
				},
			});
		} catch (error) {
			console.error("TFA verification error:", error);
			res.status(500).json({ error: "TFA verification failed" });
		}
	},
);

// Get current user profile
router.get("/profile", authenticateToken, async (req, res) => {
	try {
		res.json({
			user: req.user,
		});
	} catch (error) {
		console.error("Get profile error:", error);
		res.status(500).json({ error: "Failed to get profile" });
	}
});

// Update user profile
router.put(
	"/profile",
	authenticateToken,
	[
		body("username")
			.optional()
			.isLength({ min: 3 })
			.withMessage("Username must be at least 3 characters"),
		body("email").optional().isEmail().withMessage("Valid email is required"),
		body("first_name")
			.optional()
			.isLength({ min: 1 })
			.withMessage("First name must be at least 1 character"),
		body("last_name")
			.optional()
			.isLength({ min: 1 })
			.withMessage("Last name must be at least 1 character"),
	],
	async (req, res) => {
		try {
			const errors = validationResult(req);
			if (!errors.isEmpty()) {
				return res.status(400).json({ errors: errors.array() });
			}

			const { username, email, first_name, last_name } = req.body;
			const updateData = {};

			if (username) updateData.username = username;
			if (email) updateData.email = email;
			if (first_name !== undefined) updateData.first_name = first_name || null;
			if (last_name !== undefined) updateData.last_name = last_name || null;

			// Check if username/email already exists (excluding current user)
			if (username || email) {
				const existingUser = await prisma.users.findFirst({
					where: {
						AND: [
							{ id: { not: req.user.id } },
							{
								OR: [
									...(username ? [{ username }] : []),
									...(email ? [{ email }] : []),
								],
							},
						],
					},
				});

				if (existingUser) {
					return res
						.status(409)
						.json({ error: "Username or email already exists" });
				}
			}

			const updatedUser = await prisma.users.update({
				where: { id: req.user.id },
				data: updateData,
				select: {
					id: true,
					username: true,
					email: true,
					first_name: true,
					last_name: true,
					role: true,
					is_active: true,
					last_login: true,
					updated_at: true,
				},
			});

			res.json({
				message: "Profile updated successfully",
				user: updatedUser,
			});
		} catch (error) {
			console.error("Update profile error:", error);
			res.status(500).json({ error: "Failed to update profile" });
		}
	},
);

// Change password
router.put(
	"/change-password",
	authenticateToken,
	[
		body("currentPassword")
			.notEmpty()
			.withMessage("Current password is required"),
		body("newPassword")
			.isLength({ min: 6 })
			.withMessage("New password must be at least 6 characters"),
	],
	async (req, res) => {
		try {
			const errors = validationResult(req);
			if (!errors.isEmpty()) {
				return res.status(400).json({ errors: errors.array() });
			}

			const { currentPassword, newPassword } = req.body;

			// Get user with password hash
			const user = await prisma.users.findUnique({
				where: { id: req.user.id },
			});

			// Verify current password
			const isValidPassword = await bcrypt.compare(
				currentPassword,
				user.password_hash,
			);
			if (!isValidPassword) {
				return res.status(401).json({ error: "Current password is incorrect" });
			}

			// Hash new password
			const newPasswordHash = await bcrypt.hash(newPassword, 12);

			// Update password
			await prisma.users.update({
				where: { id: req.user.id },
				data: { password_hash: newPasswordHash },
			});

			res.json({
				message: "Password changed successfully",
			});
		} catch (error) {
			console.error("Change password error:", error);
			res.status(500).json({ error: "Failed to change password" });
		}
	},
);

// Logout (revoke current session)
router.post("/logout", authenticateToken, async (req, res) => {
	try {
		// Revoke the current session
		if (req.session_id) {
			await revoke_session(req.session_id);
		}

		res.json({
			message: "Logout successful",
		});
	} catch (error) {
		console.error("Logout error:", error);
		res.status(500).json({ error: "Logout failed" });
	}
});

// Logout all sessions (revoke all user sessions)
router.post("/logout-all", authenticateToken, async (req, res) => {
	try {
		await revoke_all_user_sessions(req.user.id);

		res.json({
			message: "All sessions logged out successfully",
		});
	} catch (error) {
		console.error("Logout all error:", error);
		res.status(500).json({ error: "Logout all failed" });
	}
});

// Refresh access token using refresh token
router.post(
	"/refresh-token",
	[body("refresh_token").notEmpty().withMessage("Refresh token is required")],
	async (req, res) => {
		try {
			const errors = validationResult(req);
			if (!errors.isEmpty()) {
				return res.status(400).json({ errors: errors.array() });
			}

			const { refresh_token } = req.body;

			const result = await refresh_access_token(refresh_token);

			if (!result.success) {
				return res.status(401).json({ error: result.error });
			}

			res.json({
				message: "Token refreshed successfully",
				token: result.access_token,
				user: {
					id: result.user.id,
					username: result.user.username,
					email: result.user.email,
					role: result.user.role,
					is_active: result.user.is_active,
				},
			});
		} catch (error) {
			console.error("Refresh token error:", error);
			res.status(500).json({ error: "Token refresh failed" });
		}
	},
);

// Get user's active sessions
router.get("/sessions", authenticateToken, async (req, res) => {
	try {
		const sessions = await get_user_sessions(req.user.id);

		res.json({
			sessions: sessions,
		});
	} catch (error) {
		console.error("Get sessions error:", error);
		res.status(500).json({ error: "Failed to fetch sessions" });
	}
});

// Revoke a specific session
router.delete("/sessions/:session_id", authenticateToken, async (req, res) => {
	try {
		const { session_id } = req.params;

		// Verify the session belongs to the user
		const session = await prisma.user_sessions.findUnique({
			where: { id: session_id },
		});

		if (!session || session.user_id !== req.user.id) {
			return res.status(404).json({ error: "Session not found" });
		}

		await revoke_session(session_id);

		res.json({
			message: "Session revoked successfully",
		});
	} catch (error) {
		console.error("Revoke session error:", error);
		res.status(500).json({ error: "Failed to revoke session" });
	}
});

module.exports = router;
