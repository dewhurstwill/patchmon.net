const express = require("express");
const { createPrismaClient } = require("../config/database");
const bcrypt = require("bcryptjs");

const router = express.Router();
const prisma = createPrismaClient();

// Middleware to authenticate API key
const authenticateApiKey = async (req, res, next) => {
	try {
		const authHeader = req.headers.authorization;

		if (!authHeader || !authHeader.startsWith("Basic ")) {
			return res
				.status(401)
				.json({ error: "Missing or invalid authorization header" });
		}

		// Decode base64 credentials
		const base64Credentials = authHeader.split(" ")[1];
		const credentials = Buffer.from(base64Credentials, "base64").toString(
			"ascii",
		);
		const [apiKey, apiSecret] = credentials.split(":");

		if (!apiKey || !apiSecret) {
			return res.status(401).json({ error: "Invalid credentials format" });
		}

		// Find the token in database
		const token = await prisma.auto_enrollment_tokens.findUnique({
			where: { token_key: apiKey },
			include: {
				users: {
					select: {
						id: true,
						username: true,
						role: true,
					},
				},
			},
		});

		if (!token) {
			console.log(`API key not found: ${apiKey}`);
			return res.status(401).json({ error: "Invalid API key" });
		}

		// Check if token is active
		if (!token.is_active) {
			return res.status(401).json({ error: "API key is disabled" });
		}

		// Check if token has expired
		if (token.expires_at && new Date(token.expires_at) < new Date()) {
			return res.status(401).json({ error: "API key has expired" });
		}

		// Check if token is for gethomepage integration
		if (token.metadata?.integration_type !== "gethomepage") {
			return res.status(401).json({ error: "Invalid API key type" });
		}

		// Verify the secret
		const isValidSecret = await bcrypt.compare(apiSecret, token.token_secret);
		if (!isValidSecret) {
			return res.status(401).json({ error: "Invalid API secret" });
		}

		// Check IP restrictions if any
		if (token.allowed_ip_ranges && token.allowed_ip_ranges.length > 0) {
			const clientIp = req.ip || req.connection.remoteAddress;
			const forwardedFor = req.headers["x-forwarded-for"];
			const realIp = req.headers["x-real-ip"];

			// Get the actual client IP (considering proxies)
			const actualClientIp = forwardedFor
				? forwardedFor.split(",")[0].trim()
				: realIp || clientIp;

			const isAllowedIp = token.allowed_ip_ranges.some((range) => {
				// Simple IP range check (can be enhanced for CIDR support)
				return actualClientIp.startsWith(range) || actualClientIp === range;
			});

			if (!isAllowedIp) {
				console.log(
					`IP validation failed. Client IP: ${actualClientIp}, Allowed ranges: ${token.allowed_ip_ranges.join(", ")}`,
				);
				return res.status(403).json({ error: "IP address not allowed" });
			}
		}

		// Update last used timestamp
		await prisma.auto_enrollment_tokens.update({
			where: { id: token.id },
			data: { last_used_at: new Date() },
		});

		// Attach token info to request
		req.apiToken = token;
		next();
	} catch (error) {
		console.error("API key authentication error:", error);
		res.status(500).json({ error: "Authentication failed" });
	}
};

// Get homepage widget statistics
router.get("/stats", authenticateApiKey, async (_req, res) => {
	try {
		// Get total hosts count
		const totalHosts = await prisma.hosts.count({
			where: { status: "active" },
		});

		// Get total outdated packages count
		const totalOutdatedPackages = await prisma.host_packages.count({
			where: { needs_update: true },
		});

		// Get total repositories count
		const totalRepos = await prisma.repositories.count({
			where: { is_active: true },
		});

		// Get hosts that need updates (have outdated packages)
		const hostsNeedingUpdates = await prisma.hosts.count({
			where: {
				status: "active",
				host_packages: {
					some: {
						needs_update: true,
					},
				},
			},
		});

		// Get security updates count
		const securityUpdates = await prisma.host_packages.count({
			where: {
				needs_update: true,
				is_security_update: true,
			},
		});

		// Get hosts with security updates
		const hostsWithSecurityUpdates = await prisma.hosts.count({
			where: {
				status: "active",
				host_packages: {
					some: {
						needs_update: true,
						is_security_update: true,
					},
				},
			},
		});

		// Get up-to-date hosts count
		const upToDateHosts = totalHosts - hostsNeedingUpdates;

		// Get recent update activity (last 24 hours)
		const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
		const recentUpdates = await prisma.update_history.count({
			where: {
				timestamp: {
					gte: oneDayAgo,
				},
				status: "success",
			},
		});

		// Get OS distribution
		const osDistribution = await prisma.hosts.groupBy({
			by: ["os_type"],
			where: { status: "active" },
			_count: {
				id: true,
			},
			orderBy: {
				_count: {
					id: "desc",
				},
			},
		});

		// Format OS distribution data
		const osDistributionFormatted = osDistribution.map((os) => ({
			name: os.os_type,
			count: os._count.id,
		}));

		// Extract top 3 OS types for flat display in widgets
		const top_os_1 = osDistributionFormatted[0] || { name: "None", count: 0 };
		const top_os_2 = osDistributionFormatted[1] || { name: "None", count: 0 };
		const top_os_3 = osDistributionFormatted[2] || { name: "None", count: 0 };

		// Prepare response data
		const stats = {
			total_hosts: totalHosts,
			total_outdated_packages: totalOutdatedPackages,
			total_repos: totalRepos,
			hosts_needing_updates: hostsNeedingUpdates,
			up_to_date_hosts: upToDateHosts,
			security_updates: securityUpdates,
			hosts_with_security_updates: hostsWithSecurityUpdates,
			recent_updates_24h: recentUpdates,
			os_distribution: osDistributionFormatted,
			// Flattened OS data for easy widget display
			top_os_1_name: top_os_1.name,
			top_os_1_count: top_os_1.count,
			top_os_2_name: top_os_2.name,
			top_os_2_count: top_os_2.count,
			top_os_3_name: top_os_3.name,
			top_os_3_count: top_os_3.count,
			last_updated: new Date().toISOString(),
		};

		res.json(stats);
	} catch (error) {
		console.error("Error fetching homepage stats:", error);
		res.status(500).json({ error: "Failed to fetch statistics" });
	}
});

// Health check endpoint for the API
router.get("/health", authenticateApiKey, async (req, res) => {
	res.json({
		status: "ok",
		timestamp: new Date().toISOString(),
		api_key: req.apiToken.token_name,
	});
});

module.exports = router;
