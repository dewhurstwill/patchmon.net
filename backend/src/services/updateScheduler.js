const { PrismaClient } = require("@prisma/client");
const { exec } = require("node:child_process");
const { promisify } = require("node:util");

const prisma = new PrismaClient();
const execAsync = promisify(exec);

class UpdateScheduler {
	constructor() {
		this.isRunning = false;
		this.intervalId = null;
		this.checkInterval = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
	}

	// Start the scheduler
	start() {
		if (this.isRunning) {
			console.log("Update scheduler is already running");
			return;
		}

		console.log("🔄 Starting update scheduler...");
		this.isRunning = true;

		// Run initial check
		this.checkForUpdates();

		// Schedule regular checks
		this.intervalId = setInterval(() => {
			this.checkForUpdates();
		}, this.checkInterval);

		console.log(
			`✅ Update scheduler started - checking every ${this.checkInterval / (60 * 60 * 1000)} hours`,
		);
	}

	// Stop the scheduler
	stop() {
		if (!this.isRunning) {
			console.log("Update scheduler is not running");
			return;
		}

		console.log("🛑 Stopping update scheduler...");
		this.isRunning = false;

		if (this.intervalId) {
			clearInterval(this.intervalId);
			this.intervalId = null;
		}

		console.log("✅ Update scheduler stopped");
	}

	// Check for updates
	async checkForUpdates() {
		try {
			console.log("🔍 Checking for updates...");

			// Get settings
			const settings = await prisma.settings.findFirst();
			const DEFAULT_GITHUB_REPO = "https://github.com/patchMon/patchmon";
			const repoUrl = settings?.githubRepoUrl || DEFAULT_GITHUB_REPO;
			let owner, repo;

			if (repoUrl.includes("git@github.com:")) {
				const match = repoUrl.match(/git@github\.com:([^/]+)\/([^/]+)\.git/);
				if (match) {
					[, owner, repo] = match;
				}
			} else if (repoUrl.includes("github.com/")) {
				const match = repoUrl.match(
					/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?$/,
				);
				if (match) {
					[, owner, repo] = match;
				}
			}

			if (!owner || !repo) {
				console.log(
					"⚠️ Could not parse GitHub repository URL, skipping update check",
				);
				return;
			}

			let latestVersion;
			const isPrivate = settings.repositoryType === "private";

			if (isPrivate) {
				// Use SSH for private repositories
				latestVersion = await this.checkPrivateRepo(settings, owner, repo);
			} else {
				// Use GitHub API for public repositories
				latestVersion = await this.checkPublicRepo(owner, repo);
			}

			if (!latestVersion) {
				console.log(
					"⚠️ Could not determine latest version, skipping update check",
				);
				return;
			}

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
			const isUpdateAvailable =
				this.compareVersions(latestVersion, currentVersion) > 0;

			// Update settings with check results
			await prisma.settings.update({
				where: { id: settings.id },
				data: {
					last_update_check: new Date(),
					update_available: isUpdateAvailable,
					latest_version: latestVersion,
				},
			});

			console.log(
				`✅ Update check completed - Current: ${currentVersion}, Latest: ${latestVersion}, Update Available: ${isUpdateAvailable}`,
			);
		} catch (error) {
			console.error("❌ Error checking for updates:", error.message);

			// Update last check time even on error
			try {
				const settings = await prisma.settings.findFirst();
				if (settings) {
					await prisma.settings.update({
						where: { id: settings.id },
						data: {
							last_update_check: new Date(),
							update_available: false,
						},
					});
				}
			} catch (updateError) {
				console.error(
					"❌ Error updating last check time:",
					updateError.message,
				);
			}
		}
	}

	// Check private repository using SSH
	async checkPrivateRepo(settings, owner, repo) {
		try {
			let sshKeyPath = settings.sshKeyPath;

			// Try to find SSH key if not configured
			if (!sshKeyPath) {
				const possibleKeyPaths = [
					"/root/.ssh/id_ed25519",
					"/root/.ssh/id_rsa",
					"/home/patchmon/.ssh/id_ed25519",
					"/home/patchmon/.ssh/id_rsa",
					"/var/www/.ssh/id_ed25519",
					"/var/www/.ssh/id_rsa",
				];

				for (const path of possibleKeyPaths) {
					try {
						require("node:fs").accessSync(path);
						sshKeyPath = path;
						break;
					} catch {
						// Key not found at this path, try next
					}
				}
			}

			if (!sshKeyPath) {
				throw new Error("No SSH deploy key found");
			}

			const sshRepoUrl = `git@github.com:${owner}/${repo}.git`;
			const env = {
				...process.env,
				GIT_SSH_COMMAND: `ssh -i ${sshKeyPath} -o StrictHostKeyChecking=no -o IdentitiesOnly=yes`,
			};

			const { stdout: sshLatestTag } = await execAsync(
				`git ls-remote --tags --sort=-version:refname ${sshRepoUrl} | head -n 1 | sed 's/.*refs\\/tags\\///' | sed 's/\\^{}//'`,
				{
					timeout: 10000,
					env: env,
				},
			);

			return sshLatestTag.trim().replace("v", "");
		} catch (error) {
			console.error("SSH Git error:", error.message);
			throw error;
		}
	}

	// Check public repository using GitHub API
	async checkPublicRepo(owner, repo) {
		try {
			const httpsRepoUrl = `https://api.github.com/repos/${owner}/${repo}/releases/latest`;

			// Get current version for User-Agent
			let currentVersion = "1.2.7"; // fallback
			try {
				const packageJson = require("../../package.json");
				if (packageJson?.version) {
					currentVersion = packageJson.version;
				}
			} catch (packageError) {
				console.warn(
					"Could not read version from package.json for User-Agent, using fallback:",
					packageError.message,
				);
			}

			const response = await fetch(httpsRepoUrl, {
				method: "GET",
				headers: {
					Accept: "application/vnd.github.v3+json",
					"User-Agent": `PatchMon-Server/${currentVersion}`,
				},
			});

			if (!response.ok) {
				const errorText = await response.text();
				if (
					errorText.includes("rate limit") ||
					errorText.includes("API rate limit")
				) {
					console.log(
						"⚠️ GitHub API rate limit exceeded, skipping update check",
					);
					return null; // Return null instead of throwing error
				}
				throw new Error(
					`GitHub API error: ${response.status} ${response.statusText}`,
				);
			}

			const releaseData = await response.json();
			return releaseData.tag_name.replace("v", "");
		} catch (error) {
			console.error("GitHub API error:", error.message);
			throw error;
		}
	}

	// Compare version strings (semantic versioning)
	compareVersions(version1, version2) {
		const v1parts = version1.split(".").map(Number);
		const v2parts = version2.split(".").map(Number);

		const maxLength = Math.max(v1parts.length, v2parts.length);

		for (let i = 0; i < maxLength; i++) {
			const v1part = v1parts[i] || 0;
			const v2part = v2parts[i] || 0;

			if (v1part > v2part) return 1;
			if (v1part < v2part) return -1;
		}

		return 0;
	}

	// Get scheduler status
	getStatus() {
		return {
			isRunning: this.isRunning,
			checkInterval: this.checkInterval,
			nextCheck: this.isRunning
				? new Date(Date.now() + this.checkInterval)
				: null,
		};
	}
}

// Create singleton instance
const updateScheduler = new UpdateScheduler();

module.exports = updateScheduler;
