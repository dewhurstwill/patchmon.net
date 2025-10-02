const express = require("express");
const { PrismaClient } = require("@prisma/client");
const moment = require("moment");
const { authenticateToken } = require("../middleware/auth");
const {
	requireViewDashboard,
	requireViewHosts,
	requireViewPackages,
	requireViewUsers,
} = require("../middleware/permissions");

const router = express.Router();
const prisma = new PrismaClient();

// Get dashboard statistics
router.get(
	"/stats",
	authenticateToken,
	requireViewDashboard,
	async (_req, res) => {
		try {
			const now = new Date();

			// Get the agent update interval setting
			const settings = await prisma.settings.findFirst();
			const updateIntervalMinutes = settings?.update_interval || 60; // Default to 60 minutes if no setting

			// Calculate the threshold based on the actual update interval
			// Use 2x the update interval as the threshold for "errored" hosts
			const thresholdMinutes = updateIntervalMinutes * 2;
			const thresholdTime = moment(now)
				.subtract(thresholdMinutes, "minutes")
				.toDate();

			// Get all statistics in parallel for better performance
			const [
				totalHosts,
				hostsNeedingUpdates,
				totalOutdatedPackages,
				erroredHosts,
				securityUpdates,
				offlineHosts,
				totalHostGroups,
				totalUsers,
				totalRepos,
				osDistribution,
				updateTrends,
			] = await Promise.all([
				// Total hosts count (all hosts regardless of status)
				prisma.hosts.count(),

				// Hosts needing updates (distinct hosts with packages needing updates)
				prisma.hosts.count({
					where: {
						host_packages: {
							some: {
								needs_update: true,
							},
						},
					},
				}),

				// Total outdated packages across all hosts
				prisma.host_packages.count({
					where: { needs_update: true },
				}),

				// Errored hosts (not updated within threshold based on update interval)
				prisma.hosts.count({
					where: {
						status: "active",
						last_update: {
							lt: thresholdTime,
						},
					},
				}),

				// Security updates count
				prisma.host_packages.count({
					where: {
						needs_update: true,
						is_security_update: true,
					},
				}),

				// Offline/Stale hosts (not updated within 3x the update interval)
				prisma.hosts.count({
					where: {
						status: "active",
						last_update: {
							lt: moment(now)
								.subtract(updateIntervalMinutes * 3, "minutes")
								.toDate(),
						},
					},
				}),

				// Total host groups count
				prisma.host_groups.count(),

				// Total users count
				prisma.users.count(),

				// Total repositories count
				prisma.repositories.count(),

				// OS distribution for pie chart
				prisma.hosts.groupBy({
					by: ["os_type"],
					where: { status: "active" },
					_count: {
						os_type: true,
					},
				}),

				// Update trends for the last 7 days
				prisma.update_history.groupBy({
					by: ["timestamp"],
					where: {
						timestamp: {
							gte: moment(now).subtract(7, "days").toDate(),
						},
					},
					_count: {
						id: true,
					},
					_sum: {
						packages_count: true,
						security_count: true,
					},
				}),
			]);

			// Format OS distribution for pie chart
			const osDistributionFormatted = osDistribution.map((item) => ({
				name: item.os_type,
				count: item._count.os_type,
			}));

			// Calculate update status distribution
			const updateStatusDistribution = [
				{ name: "Up to date", count: totalHosts - hostsNeedingUpdates },
				{ name: "Needs updates", count: hostsNeedingUpdates },
				{ name: "Errored", count: erroredHosts },
			];

			// Package update priority distribution
			const packageUpdateDistribution = [
				{ name: "Security", count: securityUpdates },
				{ name: "Regular", count: totalOutdatedPackages - securityUpdates },
			];

			res.json({
				cards: {
					totalHosts,
					hostsNeedingUpdates,
					upToDateHosts: Math.max(totalHosts - hostsNeedingUpdates, 0),
					totalOutdatedPackages,
					erroredHosts,
					securityUpdates,
					offlineHosts,
					totalHostGroups,
					totalUsers,
					totalRepos,
				},
				charts: {
					osDistribution: osDistributionFormatted,
					updateStatusDistribution,
					packageUpdateDistribution,
				},
				trends: updateTrends,
				lastUpdated: now.toISOString(),
			});
		} catch (error) {
			console.error("Error fetching dashboard stats:", error);
			res.status(500).json({ error: "Failed to fetch dashboard statistics" });
		}
	},
);

// Get hosts with their update status
router.get("/hosts", authenticateToken, requireViewHosts, async (_req, res) => {
	try {
		const hosts = await prisma.hosts.findMany({
			// Show all hosts regardless of status
			select: {
				id: true,
				friendly_name: true,
				hostname: true,
				ip: true,
				os_type: true,
				os_version: true,
				last_update: true,
				status: true,
				agent_version: true,
				auto_update: true,
				notes: true,
				host_groups: {
					select: {
						id: true,
						name: true,
						color: true,
					},
				},
				_count: {
					select: {
						host_packages: {
							where: {
								needs_update: true,
							},
						},
					},
				},
			},
			orderBy: { last_update: "desc" },
		});

		// Get update counts for each host separately
		const hostsWithUpdateInfo = await Promise.all(
			hosts.map(async (host) => {
				const updatesCount = await prisma.host_packages.count({
					where: {
						host_id: host.id,
						needs_update: true,
					},
				});

				// Get total packages count for this host
				const totalPackagesCount = await prisma.host_packages.count({
					where: {
						host_id: host.id,
					},
				});

				// Get the agent update interval setting for stale calculation
				const settings = await prisma.settings.findFirst();
				const updateIntervalMinutes = settings?.update_interval || 60;
				const thresholdMinutes = updateIntervalMinutes * 2;

				// Calculate effective status based on reporting interval
				const isStale = moment(host.last_update).isBefore(
					moment().subtract(thresholdMinutes, "minutes"),
				);
				let effectiveStatus = host.status;

				// Override status if host hasn't reported within threshold
				if (isStale && host.status === "active") {
					effectiveStatus = "inactive";
				}

				return {
					...host,
					updatesCount,
					totalPackagesCount,
					isStale,
					effectiveStatus,
				};
			}),
		);

		res.json(hostsWithUpdateInfo);
	} catch (error) {
		console.error("Error fetching hosts:", error);
		res.status(500).json({ error: "Failed to fetch hosts" });
	}
});

// Get packages that need updates across all hosts
router.get(
	"/packages",
	authenticateToken,
	requireViewPackages,
	async (_req, res) => {
		try {
			const packages = await prisma.packages.findMany({
				where: {
					host_packages: {
						some: {
							needs_update: true,
						},
					},
				},
				select: {
					id: true,
					name: true,
					description: true,
					category: true,
					latest_version: true,
					host_packages: {
						where: { needs_update: true },
						select: {
							current_version: true,
							available_version: true,
							is_security_update: true,
							hosts: {
								select: {
									id: true,
									friendly_name: true,
									os_type: true,
								},
							},
						},
					},
				},
				orderBy: {
					name: "asc",
				},
			});

			const packagesWithHostInfo = packages.map((pkg) => ({
				id: pkg.id,
				name: pkg.name,
				description: pkg.description,
				category: pkg.category,
				latestVersion: pkg.latest_version,
				affectedHostsCount: pkg.host_packages.length,
				isSecurityUpdate: pkg.host_packages.some((hp) => hp.is_security_update),
				affectedHosts: pkg.host_packages.map((hp) => ({
					hostId: hp.hosts.id,
					friendlyName: hp.hosts.friendly_name,
					osType: hp.hosts.os_type,
					currentVersion: hp.current_version,
					availableVersion: hp.available_version,
					isSecurityUpdate: hp.is_security_update,
				})),
			}));

			res.json(packagesWithHostInfo);
		} catch (error) {
			console.error("Error fetching packages:", error);
			res.status(500).json({ error: "Failed to fetch packages" });
		}
	},
);

// Get detailed host information
router.get(
	"/hosts/:hostId",
	authenticateToken,
	requireViewHosts,
	async (req, res) => {
		try {
			const { hostId } = req.params;

			const host = await prisma.hosts.findUnique({
				where: { id: hostId },
				include: {
					host_groups: {
						select: {
							id: true,
							name: true,
							color: true,
						},
					},
					host_packages: {
						include: {
							packages: true,
						},
						orderBy: {
							needs_update: "desc",
						},
					},
					update_history: {
						orderBy: {
							timestamp: "desc",
						},
						take: 10,
					},
				},
			});

			if (!host) {
				return res.status(404).json({ error: "Host not found" });
			}

			const hostWithStats = {
				...host,
				stats: {
					total_packages: host.host_packages.length,
					outdated_packages: host.host_packages.filter((hp) => hp.needs_update)
						.length,
					security_updates: host.host_packages.filter(
						(hp) => hp.needs_update && hp.is_security_update,
					).length,
				},
			};

			res.json(hostWithStats);
		} catch (error) {
			console.error("Error fetching host details:", error);
			res.status(500).json({ error: "Failed to fetch host details" });
		}
	},
);

// Get recent users ordered by last_login desc
router.get(
	"/recent-users",
	authenticateToken,
	requireViewUsers,
	async (_req, res) => {
		try {
			const users = await prisma.users.findMany({
				where: {
					last_login: {
						not: null,
					},
				},
				select: {
					id: true,
					username: true,
					email: true,
					role: true,
					last_login: true,
					created_at: true,
				},
				orderBy: [{ last_login: "desc" }, { created_at: "desc" }],
				take: 5,
			});

			res.json(users);
		} catch (error) {
			console.error("Error fetching recent users:", error);
			res.status(500).json({ error: "Failed to fetch recent users" });
		}
	},
);

// Get recent hosts that have sent data (ordered by last_update desc)
router.get(
	"/recent-collection",
	authenticateToken,
	requireViewHosts,
	async (_req, res) => {
		try {
			const hosts = await prisma.hosts.findMany({
				select: {
					id: true,
					friendly_name: true,
					hostname: true,
					last_update: true,
					status: true,
				},
				orderBy: {
					last_update: "desc",
				},
				take: 5,
			});

			res.json(hosts);
		} catch (error) {
			console.error("Error fetching recent collection:", error);
			res.status(500).json({ error: "Failed to fetch recent collection" });
		}
	},
);

module.exports = router;
