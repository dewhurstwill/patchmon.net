const express = require("express");
const { body, validationResult } = require("express-validator");
const { PrismaClient } = require("@prisma/client");
const { authenticateToken } = require("../middleware/auth");
const { requireManageSettings } = require("../middleware/permissions");
const { getSettings, updateSettings } = require("../services/settingsService");

const router = express.Router();
const prisma = new PrismaClient();

// Function to trigger crontab updates on all hosts with auto-update enabled
async function triggerCrontabUpdates() {
	try {
		console.log(
			"Triggering crontab updates on all hosts with auto-update enabled...",
		);

		// Get current settings for server URL
		const settings = await getSettings();
		const serverUrl = settings.server_url;

		// Get all hosts that have auto-update enabled
		const hosts = await prisma.hosts.findMany({
			where: {
				auto_update: true,
				status: "active", // Only update active hosts
			},
			select: {
				id: true,
				friendly_name: true,
				api_id: true,
				api_key: true,
			},
		});

		console.log(`Found ${hosts.length} hosts with auto-update enabled`);

		// For each host, we'll send a special update command that triggers crontab update
		// This is done by sending a ping with a special flag
		for (const host of hosts) {
			try {
				console.log(
					`Triggering crontab update for host: ${host.friendly_name}`,
				);

				// We'll use the existing ping endpoint but add a special parameter
				// The agent will detect this and run update-crontab command
				const http = require("node:http");
				const https = require("node:https");

				const url = new URL(`${serverUrl}/api/v1/hosts/ping`);
				const isHttps = url.protocol === "https:";
				const client = isHttps ? https : http;

				const postData = JSON.stringify({
					triggerCrontabUpdate: true,
					message: "Update interval changed, please update your crontab",
				});

				const options = {
					hostname: url.hostname,
					port: url.port || (isHttps ? 443 : 80),
					path: url.pathname,
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						"Content-Length": Buffer.byteLength(postData),
						"X-API-ID": host.api_id,
						"X-API-KEY": host.api_key,
					},
				};

				const req = client.request(options, (res) => {
					if (res.statusCode === 200) {
						console.log(
							`Successfully triggered crontab update for ${host.friendly_name}`,
						);
					} else {
						console.error(
							`Failed to trigger crontab update for ${host.friendly_name}: ${res.statusCode}`,
						);
					}
				});

				req.on("error", (error) => {
					console.error(
						`Error triggering crontab update for ${host.friendly_name}:`,
						error.message,
					);
				});

				req.write(postData);
				req.end();
			} catch (error) {
				console.error(
					`Error triggering crontab update for ${host.friendly_name}:`,
					error.message,
				);
			}
		}

		console.log("Crontab update trigger completed");
	} catch (error) {
		console.error("Error in triggerCrontabUpdates:", error);
	}
}

// Get current settings
router.get("/", authenticateToken, requireManageSettings, async (_req, res) => {
	try {
		const settings = await getSettings();
		if (process.env.ENABLE_LOGGING === "true") {
			console.log("Returning settings:", settings);
		}
		res.json(settings);
	} catch (error) {
		console.error("Settings fetch error:", error);
		res.status(500).json({ error: "Failed to fetch settings" });
	}
});

// Update settings
router.put(
	"/",
	authenticateToken,
	requireManageSettings,
	[
		body("serverProtocol")
			.isIn(["http", "https"])
			.withMessage("Protocol must be http or https"),
		body("serverHost")
			.isLength({ min: 1 })
			.withMessage("Server host is required"),
		body("serverPort")
			.isInt({ min: 1, max: 65535 })
			.withMessage("Port must be between 1 and 65535"),
		body("updateInterval")
			.isInt({ min: 5, max: 1440 })
			.withMessage("Update interval must be between 5 and 1440 minutes"),
		body("autoUpdate").isBoolean().withMessage("Auto update must be a boolean"),
		body("signupEnabled")
			.isBoolean()
			.withMessage("Signup enabled must be a boolean"),
		body("defaultUserRole")
			.optional()
			.isLength({ min: 1 })
			.withMessage("Default user role must be a non-empty string"),
		body("githubRepoUrl")
			.optional()
			.isLength({ min: 1 })
			.withMessage("GitHub repo URL must be a non-empty string"),
		body("repositoryType")
			.optional()
			.isIn(["public", "private"])
			.withMessage("Repository type must be public or private"),
		body("sshKeyPath")
			.optional()
			.custom((value) => {
				if (value && value.trim().length === 0) {
					return true; // Allow empty string
				}
				if (value && value.trim().length < 1) {
					throw new Error("SSH key path must be a non-empty string");
				}
				return true;
			}),
	],
	async (req, res) => {
		try {
			const errors = validationResult(req);
			if (!errors.isEmpty()) {
				console.log("Validation errors:", errors.array());
				return res.status(400).json({ errors: errors.array() });
			}

			const {
				serverProtocol,
				serverHost,
				serverPort,
				updateInterval,
				autoUpdate,
				signupEnabled,
				defaultUserRole,
				githubRepoUrl,
				repositoryType,
				sshKeyPath,
			} = req.body;

			// Get current settings to check for update interval changes
			const currentSettings = await getSettings();
			const oldUpdateInterval = currentSettings.update_interval;

			// Update settings using the service
			const updatedSettings = await updateSettings(currentSettings.id, {
				server_protocol: serverProtocol,
				server_host: serverHost,
				server_port: serverPort,
				update_interval: updateInterval || 60,
				auto_update: autoUpdate || false,
				signup_enabled: signupEnabled || false,
				default_user_role:
					defaultUserRole || process.env.DEFAULT_USER_ROLE || "user",
				github_repo_url:
					githubRepoUrl !== undefined
						? githubRepoUrl
						: "git@github.com:9technologygroup/patchmon.net.git",
				repository_type: repositoryType || "public",
				ssh_key_path: sshKeyPath || null,
			});

			console.log("Settings updated successfully:", updatedSettings);

			// If update interval changed, trigger crontab updates on all hosts with auto-update enabled
			if (oldUpdateInterval !== (updateInterval || 60)) {
				console.log(
					`Update interval changed from ${oldUpdateInterval} to ${updateInterval || 60} minutes. Triggering crontab updates...`,
				);
				await triggerCrontabUpdates();
			}

			res.json({
				message: "Settings updated successfully",
				settings: updatedSettings,
			});
		} catch (error) {
			console.error("Settings update error:", error);
			res.status(500).json({ error: "Failed to update settings" });
		}
	},
);

// Get server URL for public use (used by installation scripts)
router.get("/server-url", async (_req, res) => {
	try {
		const settings = await getSettings();
		const serverUrl = settings.server_url;
		res.json({ server_url: serverUrl });
	} catch (error) {
		console.error("Server URL fetch error:", error);
		res.status(500).json({ error: "Failed to fetch server URL" });
	}
});

// Get update interval policy for agents (requires API authentication)
router.get("/update-interval", async (req, res) => {
	try {
		// Verify API credentials
		const apiId = req.headers["x-api-id"];
		const apiKey = req.headers["x-api-key"];

		if (!apiId || !apiKey) {
			return res.status(401).json({ error: "API credentials required" });
		}

		// Validate API credentials
		const host = await prisma.hosts.findUnique({
			where: { api_id: apiId },
		});

		if (!host || host.api_key !== apiKey) {
			return res.status(401).json({ error: "Invalid API credentials" });
		}

		const settings = await getSettings();
		res.json({
			updateInterval: settings.update_interval,
			cronExpression: `*/${settings.update_interval} * * * *`, // Generate cron expression
		});
	} catch (error) {
		console.error("Update interval fetch error:", error);
		res.json({ updateInterval: 60, cronExpression: "0 * * * *" });
	}
});

// Get auto-update policy for agents (public endpoint)
router.get("/auto-update", async (_req, res) => {
	try {
		const settings = await getSettings();
		res.json({
			autoUpdate: settings.auto_update || false,
		});
	} catch (error) {
		console.error("Auto-update fetch error:", error);
		res.json({ autoUpdate: false });
	}
});

module.exports = router;
