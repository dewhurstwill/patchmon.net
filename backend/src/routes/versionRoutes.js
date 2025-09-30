const express = require("express");
const { authenticateToken } = require("../middleware/auth");
const { requireManageSettings } = require("../middleware/permissions");
const { PrismaClient } = require("@prisma/client");
const { exec } = require("node:child_process");
const { promisify } = require("node:util");

const prisma = new PrismaClient();
const execAsync = promisify(exec);

const router = express.Router();

// Get current version info
router.get("/current", authenticateToken, async (_req, res) => {
	try {
		// Read version from package.json dynamically
		let currentVersion = "1.2.7"; // fallback

		try {
			const packageJson = require("../../package.json");
			if (packageJson?.version) {
				currentVersion = packageJson.version;
			}
		} catch (packageError) {
			console.warn(
				"Could not read version from package.json, using fallback:",
				packageError.message,
			);
		}

		res.json({
			version: currentVersion,
			buildDate: new Date().toISOString(),
			environment: process.env.NODE_ENV || "development",
		});
	} catch (error) {
		console.error("Error getting current version:", error);
		res.status(500).json({ error: "Failed to get current version" });
	}
});

// Test SSH key permissions and GitHub access
router.post(
	"/test-ssh-key",
	authenticateToken,
	requireManageSettings,
	async (req, res) => {
		try {
			const { sshKeyPath, githubRepoUrl } = req.body;

			if (!sshKeyPath || !githubRepoUrl) {
				return res.status(400).json({
					error: "SSH key path and GitHub repo URL are required",
				});
			}

			// Parse repository info
			let owner, repo;
			if (githubRepoUrl.includes("git@github.com:")) {
				const match = githubRepoUrl.match(
					/git@github\.com:([^/]+)\/([^/]+)\.git/,
				);
				if (match) {
					[, owner, repo] = match;
				}
			} else if (githubRepoUrl.includes("github.com/")) {
				const match = githubRepoUrl.match(/github\.com\/([^/]+)\/([^/]+)/);
				if (match) {
					[, owner, repo] = match;
				}
			}

			if (!owner || !repo) {
				return res.status(400).json({
					error: "Invalid GitHub repository URL format",
				});
			}

			// Check if SSH key file exists and is readable
			try {
				require("node:fs").accessSync(sshKeyPath);
			} catch {
				return res.status(400).json({
					error: "SSH key file not found or not accessible",
					details: `Cannot access: ${sshKeyPath}`,
					suggestion:
						"Check the file path and ensure the application has read permissions",
				});
			}

			// Test SSH connection to GitHub
			const sshRepoUrl = `git@github.com:${owner}/${repo}.git`;
			const env = {
				...process.env,
				GIT_SSH_COMMAND: `ssh -i ${sshKeyPath} -o StrictHostKeyChecking=no -o IdentitiesOnly=yes -o ConnectTimeout=10`,
			};

			try {
				// Test with a simple git command
				const { stdout } = await execAsync(
					`git ls-remote --heads ${sshRepoUrl} | head -n 1`,
					{
						timeout: 15000,
						env: env,
					},
				);

				if (stdout.trim()) {
					return res.json({
						success: true,
						message: "SSH key is working correctly",
						details: {
							sshKeyPath,
							repository: `${owner}/${repo}`,
							testResult: "Successfully connected to GitHub",
						},
					});
				} else {
					return res.status(400).json({
						error: "SSH connection succeeded but no data returned",
						suggestion: "Check repository access permissions",
					});
				}
			} catch (sshError) {
				console.error("SSH test error:", sshError.message);

				if (sshError.message.includes("Permission denied")) {
					return res.status(403).json({
						error: "SSH key permission denied",
						details: "The SSH key exists but GitHub rejected the connection",
						suggestion:
							"Verify the SSH key is added to the repository as a deploy key with read access",
					});
				} else if (sshError.message.includes("Host key verification failed")) {
					return res.status(403).json({
						error: "Host key verification failed",
						suggestion:
							"This is normal for first-time connections. The key will be added to known_hosts automatically.",
					});
				} else if (sshError.message.includes("Connection timed out")) {
					return res.status(408).json({
						error: "Connection timed out",
						suggestion: "Check your internet connection and GitHub status",
					});
				} else {
					return res.status(500).json({
						error: "SSH connection failed",
						details: sshError.message,
						suggestion: "Check the SSH key format and repository URL",
					});
				}
			}
		} catch (error) {
			console.error("SSH key test error:", error);
			res.status(500).json({
				error: "Failed to test SSH key",
				details: error.message,
			});
		}
	},
);

// Check for updates from GitHub
router.get(
	"/check-updates",
	authenticateToken,
	requireManageSettings,
	async (_req, res) => {
		try {
			// Get cached update information from settings
			const settings = await prisma.settings.findFirst();

			if (!settings) {
				return res.status(400).json({ error: "Settings not found" });
			}

			const currentVersion = "1.2.7";
			const latestVersion = settings.latest_version || currentVersion;
			const isUpdateAvailable = settings.update_available || false;
			const lastUpdateCheck = settings.last_update_check || null;

			res.json({
				currentVersion,
				latestVersion,
				isUpdateAvailable,
				lastUpdateCheck,
				repositoryType: settings.repository_type || "public",
				latestRelease: {
					tagName: latestVersion ? `v${latestVersion}` : null,
					version: latestVersion,
					repository: settings.github_repo_url
						? settings.github_repo_url.split("/").slice(-2).join("/")
						: null,
					accessMethod: settings.repository_type === "private" ? "ssh" : "api",
				},
			});
		} catch (error) {
			console.error("Error getting update information:", error);
			res.status(500).json({ error: "Failed to get update information" });
		}
	},
);

module.exports = router;
