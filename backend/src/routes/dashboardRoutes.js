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
const { queueManager } = require("../services/automation");

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
			const regularUpdates = Math.max(
				0,
				totalOutdatedPackages - securityUpdates,
			);
			const packageUpdateDistribution = [
				{ name: "Security", count: securityUpdates },
				{ name: "Regular", count: regularUpdates },
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
				machine_id: true,
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
				api_id: true,
				host_group_memberships: {
					include: {
						host_groups: {
							select: {
								id: true,
								name: true,
								color: true,
							},
						},
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

			const limit = parseInt(req.query.limit, 10) || 10;
			const offset = parseInt(req.query.offset, 10) || 0;

			const [host, totalHistoryCount] = await Promise.all([
				prisma.hosts.findUnique({
					where: { id: hostId },
					include: {
						host_group_memberships: {
							include: {
								host_groups: {
									select: {
										id: true,
										name: true,
										color: true,
									},
								},
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
							take: limit,
							skip: offset,
						},
					},
				}),
				prisma.update_history.count({
					where: { host_id: hostId },
				}),
			]);

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
				pagination: {
					total: totalHistoryCount,
					limit,
					offset,
					hasMore: offset + limit < totalHistoryCount,
				},
			};

			res.json(hostWithStats);
		} catch (error) {
			console.error("Error fetching host details:", error);
			res.status(500).json({ error: "Failed to fetch host details" });
		}
	},
);

// Get agent queue status for a specific host
router.get(
	"/hosts/:hostId/queue",
	authenticateToken,
	requireViewHosts,
	async (req, res) => {
		try {
			const { hostId } = req.params;
			const { limit = 20 } = req.query;

			// Get the host to find its API ID
			const host = await prisma.hosts.findUnique({
				where: { id: hostId },
				select: { api_id: true, friendly_name: true },
			});

			if (!host) {
				return res.status(404).json({ error: "Host not found" });
			}

			// Get queue jobs for this host
			const queueData = await queueManager.getHostJobs(
				host.api_id,
				parseInt(limit, 10),
			);

			res.json({
				success: true,
				data: {
					hostId,
					apiId: host.api_id,
					friendlyName: host.friendly_name,
					...queueData,
				},
			});
		} catch (error) {
			console.error("Error fetching host queue status:", error);
			res.status(500).json({
				success: false,
				error: "Failed to fetch host queue status",
			});
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

// Get package trends over time
router.get(
	"/package-trends",
	authenticateToken,
	requireViewHosts,
	async (req, res) => {
		try {
			const { days = 30, hostId } = req.query;
			const daysInt = parseInt(days, 10);

			// Calculate date range
			const endDate = new Date();
			const startDate = new Date();
			startDate.setDate(endDate.getDate() - daysInt);

			// Build where clause
			const whereClause = {
				timestamp: {
					gte: startDate,
					lte: endDate,
				},
			};

			// Add host filter if specified
			if (hostId && hostId !== "all" && hostId !== "undefined") {
				whereClause.host_id = hostId;
			}

			// Get all update history records in the date range
			const trendsData = await prisma.update_history.findMany({
				where: whereClause,
				select: {
					timestamp: true,
					packages_count: true,
					security_count: true,
					total_packages: true,
					host_id: true,
					status: true,
				},
				orderBy: {
					timestamp: "asc",
				},
			});

			// Enhanced data validation and processing
			const processedData = trendsData
				.filter((record) => {
					// Enhanced validation
					return (
						record.total_packages !== null &&
						record.total_packages >= 0 &&
						record.packages_count >= 0 &&
						record.security_count >= 0 &&
						record.security_count <= record.packages_count && // Security can't exceed outdated
						record.status === "success"
					); // Only include successful reports
				})
				.map((record) => {
					const date = new Date(record.timestamp);
					let timeKey;

					if (daysInt <= 1) {
						// For hourly view, group by hour only (not minutes)
						timeKey = date.toISOString().substring(0, 13); // YYYY-MM-DDTHH
					} else {
						// For daily view, group by day
						timeKey = date.toISOString().split("T")[0]; // YYYY-MM-DD
					}

					return {
						timeKey,
						total_packages: record.total_packages,
						packages_count: record.packages_count || 0,
						security_count: record.security_count || 0,
						host_id: record.host_id,
						timestamp: record.timestamp,
					};
				});

			// Determine if we need aggregation based on host filter
			const needsAggregation =
				!hostId || hostId === "all" || hostId === "undefined";

			let aggregatedArray;

			if (needsAggregation) {
				// For "All Hosts" mode, we need to calculate the actual total packages differently
				// Instead of aggregating historical data (which is per-host), we'll use the current total
				// and show that as a flat line, since total packages don't change much over time

				// Get the current total packages count (unique packages across all hosts)
				const currentTotalPackages = await prisma.packages.count({
					where: {
						host_packages: {
							some: {}, // At least one host has this package
						},
					},
				});

				// Aggregate data by timeKey when looking at "All Hosts" or no specific host
				const aggregatedData = processedData.reduce((acc, item) => {
					if (!acc[item.timeKey]) {
						acc[item.timeKey] = {
							timeKey: item.timeKey,
							total_packages: currentTotalPackages, // Use current total packages
							packages_count: 0,
							security_count: 0,
							record_count: 0,
							host_ids: new Set(),
							min_timestamp: item.timestamp,
							max_timestamp: item.timestamp,
						};
					}

					// For outdated and security packages: SUM (these represent counts across hosts)
					acc[item.timeKey].packages_count += item.packages_count;
					acc[item.timeKey].security_count += item.security_count;

					acc[item.timeKey].record_count += 1;
					acc[item.timeKey].host_ids.add(item.host_id);

					// Track timestamp range
					if (item.timestamp < acc[item.timeKey].min_timestamp) {
						acc[item.timeKey].min_timestamp = item.timestamp;
					}
					if (item.timestamp > acc[item.timeKey].max_timestamp) {
						acc[item.timeKey].max_timestamp = item.timestamp;
					}

					return acc;
				}, {});

				// Convert to array and add metadata
				aggregatedArray = Object.values(aggregatedData)
					.map((item) => ({
						...item,
						host_count: item.host_ids.size,
						host_ids: Array.from(item.host_ids),
					}))
					.sort((a, b) => a.timeKey.localeCompare(b.timeKey));
			} else {
				// For specific host, show individual data points without aggregation
				// But still group by timeKey to handle multiple reports from same host in same time period
				const hostAggregatedData = processedData.reduce((acc, item) => {
					if (!acc[item.timeKey]) {
						acc[item.timeKey] = {
							timeKey: item.timeKey,
							total_packages: 0,
							packages_count: 0,
							security_count: 0,
							record_count: 0,
							host_ids: new Set([item.host_id]),
							min_timestamp: item.timestamp,
							max_timestamp: item.timestamp,
						};
					}

					// For same host, take the latest values (not sum)
					// This handles cases where a host reports multiple times in the same time period
					if (item.timestamp > acc[item.timeKey].max_timestamp) {
						acc[item.timeKey].total_packages = item.total_packages;
						acc[item.timeKey].packages_count = item.packages_count;
						acc[item.timeKey].security_count = item.security_count;
						acc[item.timeKey].max_timestamp = item.timestamp;
					}

					acc[item.timeKey].record_count += 1;

					return acc;
				}, {});

				// Convert to array
				aggregatedArray = Object.values(hostAggregatedData)
					.map((item) => ({
						...item,
						host_count: item.host_ids.size,
						host_ids: Array.from(item.host_ids),
					}))
					.sort((a, b) => a.timeKey.localeCompare(b.timeKey));
			}

			// Handle sparse data by filling missing time periods
			const fillMissingPeriods = (data, daysInt) => {
				const filledData = [];
				const startDate = new Date();
				startDate.setDate(startDate.getDate() - daysInt);

				const dataMap = new Map(data.map((item) => [item.timeKey, item]));

				const endDate = new Date();
				const currentDate = new Date(startDate);

				// Find the last known values for interpolation
				let lastKnownValues = null;
				if (data.length > 0) {
					lastKnownValues = {
						total_packages: data[0].total_packages,
						packages_count: data[0].packages_count,
						security_count: data[0].security_count,
					};
				}

				while (currentDate <= endDate) {
					let timeKey;
					if (daysInt <= 1) {
						timeKey = currentDate.toISOString().substring(0, 13); // Hourly
						currentDate.setHours(currentDate.getHours() + 1);
					} else {
						timeKey = currentDate.toISOString().split("T")[0]; // Daily
						currentDate.setDate(currentDate.getDate() + 1);
					}

					if (dataMap.has(timeKey)) {
						const item = dataMap.get(timeKey);
						filledData.push(item);
						// Update last known values
						lastKnownValues = {
							total_packages: item.total_packages,
							packages_count: item.packages_count,
							security_count: item.security_count,
						};
					} else {
						// For missing periods, use the last known values (interpolation)
						// This creates a continuous line instead of gaps
						filledData.push({
							timeKey,
							total_packages: lastKnownValues?.total_packages || 0,
							packages_count: lastKnownValues?.packages_count || 0,
							security_count: lastKnownValues?.security_count || 0,
							record_count: 0,
							host_count: 0,
							host_ids: [],
							min_timestamp: null,
							max_timestamp: null,
							isInterpolated: true, // Mark as interpolated for debugging
						});
					}
				}

				return filledData;
			};

			const finalProcessedData = fillMissingPeriods(aggregatedArray, daysInt);

			// Get hosts list for dropdown
			const hostsList = await prisma.hosts.findMany({
				select: {
					id: true,
					friendly_name: true,
					hostname: true,
					last_update: true,
					status: true,
				},
				orderBy: {
					friendly_name: "asc",
				},
			});

			// Get current package state for offline fallback
			let currentPackageState = null;
			if (hostId && hostId !== "all" && hostId !== "undefined") {
				// Get current package counts for specific host
				const currentState = await prisma.host_packages.aggregate({
					where: {
						host_id: hostId,
					},
					_count: {
						id: true,
					},
				});

				// Get counts for boolean fields separately
				const outdatedCount = await prisma.host_packages.count({
					where: {
						host_id: hostId,
						needs_update: true,
					},
				});

				const securityCount = await prisma.host_packages.count({
					where: {
						host_id: hostId,
						is_security_update: true,
					},
				});

				currentPackageState = {
					total_packages: currentState._count.id,
					packages_count: outdatedCount,
					security_count: securityCount,
				};
			} else {
				// Get current package counts for all hosts
				// Total packages = count of unique packages installed on at least one host
				const totalPackagesCount = await prisma.packages.count({
					where: {
						host_packages: {
							some: {}, // At least one host has this package
						},
					},
				});

				// Get counts for boolean fields separately
				const outdatedCount = await prisma.host_packages.count({
					where: {
						needs_update: true,
					},
				});

				const securityCount = await prisma.host_packages.count({
					where: {
						is_security_update: true,
					},
				});

				currentPackageState = {
					total_packages: totalPackagesCount,
					packages_count: outdatedCount,
					security_count: securityCount,
				};
			}

			// Format data for chart
			const chartData = {
				labels: [],
				datasets: [
					{
						label: needsAggregation
							? "Total Packages (All Hosts)"
							: "Total Packages",
						data: [],
						borderColor: "#3B82F6", // Blue
						backgroundColor: "rgba(59, 130, 246, 0.1)",
						tension: 0.4,
						hidden: true, // Hidden by default
						spanGaps: true, // Connect lines across missing data
						pointRadius: 3,
						pointHoverRadius: 5,
					},
					{
						label: needsAggregation
							? "Total Outdated Packages"
							: "Outdated Packages",
						data: [],
						borderColor: "#F59E0B", // Orange
						backgroundColor: "rgba(245, 158, 11, 0.1)",
						tension: 0.4,
						spanGaps: true, // Connect lines across missing data
						pointRadius: 3,
						pointHoverRadius: 5,
					},
					{
						label: needsAggregation
							? "Total Security Packages"
							: "Security Packages",
						data: [],
						borderColor: "#EF4444", // Red
						backgroundColor: "rgba(239, 68, 68, 0.1)",
						tension: 0.4,
						spanGaps: true, // Connect lines across missing data
						pointRadius: 3,
						pointHoverRadius: 5,
					},
				],
			};

			// Process aggregated data
			finalProcessedData.forEach((item) => {
				chartData.labels.push(item.timeKey);
				chartData.datasets[0].data.push(item.total_packages);
				chartData.datasets[1].data.push(item.packages_count);
				chartData.datasets[2].data.push(item.security_count);
			});

			// Calculate data quality metrics
			const dataQuality = {
				totalRecords: trendsData.length,
				validRecords: processedData.length,
				aggregatedPoints: aggregatedArray.length,
				filledPoints: finalProcessedData.length,
				recordsWithNullTotal: trendsData.filter(
					(r) => r.total_packages === null,
				).length,
				recordsWithInvalidData: trendsData.length - processedData.length,
				successfulReports: trendsData.filter((r) => r.status === "success")
					.length,
				failedReports: trendsData.filter((r) => r.status === "error").length,
			};

			res.json({
				chartData,
				hosts: hostsList,
				period: daysInt,
				hostId: hostId || "all",
				currentPackageState,
				dataQuality,
				aggregationInfo: {
					hasData: aggregatedArray.length > 0,
					hasGaps: finalProcessedData.some((item) => item.record_count === 0),
					lastDataPoint:
						aggregatedArray.length > 0
							? aggregatedArray[aggregatedArray.length - 1]
							: null,
					aggregationMode: needsAggregation
						? "sum_across_hosts"
						: "individual_host_data",
					explanation: needsAggregation
						? "Data is summed across all hosts for each time period"
						: "Data shows individual host values without cross-host aggregation",
				},
			});
		} catch (error) {
			console.error("Error fetching package trends:", error);
			res.status(500).json({ error: "Failed to fetch package trends" });
		}
	},
);

// Diagnostic endpoint to investigate package spikes
router.get(
	"/package-spike-analysis",
	authenticateToken,
	requireViewHosts,
	async (req, res) => {
		try {
			const { date, time, hours = 2 } = req.query;

			if (!date || !time) {
				return res.status(400).json({
					error:
						"Date and time parameters are required. Format: date=2025-10-17&time=18:00",
				});
			}

			// Parse the specific date and time
			const targetDateTime = new Date(`${date}T${time}:00`);
			const startTime = new Date(targetDateTime);
			startTime.setHours(startTime.getHours() - parseInt(hours, 10));
			const endTime = new Date(targetDateTime);
			endTime.setHours(endTime.getHours() + parseInt(hours, 10));

			console.log(
				`Analyzing package spike around ${targetDateTime.toISOString()}`,
			);
			console.log(
				`Time range: ${startTime.toISOString()} to ${endTime.toISOString()}`,
			);

			// Get all update history records in the time window
			const spikeData = await prisma.update_history.findMany({
				where: {
					timestamp: {
						gte: startTime,
						lte: endTime,
					},
				},
				select: {
					id: true,
					host_id: true,
					timestamp: true,
					packages_count: true,
					security_count: true,
					total_packages: true,
					status: true,
					error_message: true,
					execution_time: true,
					payload_size_kb: true,
					hosts: {
						select: {
							friendly_name: true,
							hostname: true,
							os_type: true,
							os_version: true,
						},
					},
				},
				orderBy: {
					timestamp: "asc",
				},
			});

			// Analyze the data
			const analysis = {
				timeWindow: {
					start: startTime.toISOString(),
					end: endTime.toISOString(),
					target: targetDateTime.toISOString(),
				},
				totalRecords: spikeData.length,
				successfulReports: spikeData.filter((r) => r.status === "success")
					.length,
				failedReports: spikeData.filter((r) => r.status === "error").length,
				uniqueHosts: [...new Set(spikeData.map((r) => r.host_id))].length,
				hosts: {},
				timeline: [],
				summary: {
					maxPackagesCount: 0,
					maxSecurityCount: 0,
					maxTotalPackages: 0,
					avgPackagesCount: 0,
					avgSecurityCount: 0,
					avgTotalPackages: 0,
				},
			};

			// Group by host and analyze each host's behavior
			spikeData.forEach((record) => {
				const hostId = record.host_id;
				if (!analysis.hosts[hostId]) {
					analysis.hosts[hostId] = {
						hostInfo: record.hosts,
						records: [],
						summary: {
							totalReports: 0,
							successfulReports: 0,
							failedReports: 0,
							maxPackagesCount: 0,
							maxSecurityCount: 0,
							maxTotalPackages: 0,
							avgPackagesCount: 0,
							avgSecurityCount: 0,
							avgTotalPackages: 0,
						},
					};
				}

				analysis.hosts[hostId].records.push({
					timestamp: record.timestamp,
					packages_count: record.packages_count,
					security_count: record.security_count,
					total_packages: record.total_packages,
					status: record.status,
					error_message: record.error_message,
					execution_time: record.execution_time,
					payload_size_kb: record.payload_size_kb,
				});

				analysis.hosts[hostId].summary.totalReports++;
				if (record.status === "success") {
					analysis.hosts[hostId].summary.successfulReports++;
					analysis.hosts[hostId].summary.maxPackagesCount = Math.max(
						analysis.hosts[hostId].summary.maxPackagesCount,
						record.packages_count,
					);
					analysis.hosts[hostId].summary.maxSecurityCount = Math.max(
						analysis.hosts[hostId].summary.maxSecurityCount,
						record.security_count,
					);
					analysis.hosts[hostId].summary.maxTotalPackages = Math.max(
						analysis.hosts[hostId].summary.maxTotalPackages,
						record.total_packages || 0,
					);
				} else {
					analysis.hosts[hostId].summary.failedReports++;
				}
			});

			// Calculate averages for each host
			Object.keys(analysis.hosts).forEach((hostId) => {
				const host = analysis.hosts[hostId];
				const successfulRecords = host.records.filter(
					(r) => r.status === "success",
				);

				if (successfulRecords.length > 0) {
					host.summary.avgPackagesCount = Math.round(
						successfulRecords.reduce((sum, r) => sum + r.packages_count, 0) /
							successfulRecords.length,
					);
					host.summary.avgSecurityCount = Math.round(
						successfulRecords.reduce((sum, r) => sum + r.security_count, 0) /
							successfulRecords.length,
					);
					host.summary.avgTotalPackages = Math.round(
						successfulRecords.reduce(
							(sum, r) => sum + (r.total_packages || 0),
							0,
						) / successfulRecords.length,
					);
				}
			});

			// Create timeline with hourly/daily aggregation
			const timelineMap = new Map();
			spikeData.forEach((record) => {
				const timeKey = record.timestamp.toISOString().substring(0, 13); // Hourly
				if (!timelineMap.has(timeKey)) {
					timelineMap.set(timeKey, {
						timestamp: timeKey,
						totalReports: 0,
						successfulReports: 0,
						failedReports: 0,
						totalPackagesCount: 0,
						totalSecurityCount: 0,
						totalTotalPackages: 0,
						uniqueHosts: new Set(),
					});
				}

				const timelineEntry = timelineMap.get(timeKey);
				timelineEntry.totalReports++;
				timelineEntry.uniqueHosts.add(record.host_id);

				if (record.status === "success") {
					timelineEntry.successfulReports++;
					timelineEntry.totalPackagesCount += record.packages_count;
					timelineEntry.totalSecurityCount += record.security_count;
					timelineEntry.totalTotalPackages += record.total_packages || 0;
				} else {
					timelineEntry.failedReports++;
				}
			});

			// Convert timeline map to array
			analysis.timeline = Array.from(timelineMap.values())
				.map((entry) => ({
					...entry,
					uniqueHosts: entry.uniqueHosts.size,
				}))
				.sort((a, b) => a.timestamp.localeCompare(b.timestamp));

			// Calculate overall summary
			const successfulRecords = spikeData.filter((r) => r.status === "success");
			if (successfulRecords.length > 0) {
				analysis.summary.maxPackagesCount = Math.max(
					...successfulRecords.map((r) => r.packages_count),
				);
				analysis.summary.maxSecurityCount = Math.max(
					...successfulRecords.map((r) => r.security_count),
				);
				analysis.summary.maxTotalPackages = Math.max(
					...successfulRecords.map((r) => r.total_packages || 0),
				);
				analysis.summary.avgPackagesCount = Math.round(
					successfulRecords.reduce((sum, r) => sum + r.packages_count, 0) /
						successfulRecords.length,
				);
				analysis.summary.avgSecurityCount = Math.round(
					successfulRecords.reduce((sum, r) => sum + r.security_count, 0) /
						successfulRecords.length,
				);
				analysis.summary.avgTotalPackages = Math.round(
					successfulRecords.reduce(
						(sum, r) => sum + (r.total_packages || 0),
						0,
					) / successfulRecords.length,
				);
			}

			// Identify potential causes of the spike
			const potentialCauses = [];

			// Check for hosts with unusually high package counts
			Object.keys(analysis.hosts).forEach((hostId) => {
				const host = analysis.hosts[hostId];
				if (
					host.summary.maxPackagesCount >
					analysis.summary.avgPackagesCount * 2
				) {
					potentialCauses.push({
						type: "high_package_count",
						hostId,
						hostName: host.hostInfo.friendly_name || host.hostInfo.hostname,
						value: host.summary.maxPackagesCount,
						avg: analysis.summary.avgPackagesCount,
					});
				}
			});

			// Check for multiple hosts reporting at the same time (this explains the 500 vs 59 discrepancy)
			const concurrentReports = analysis.timeline.filter(
				(entry) => entry.uniqueHosts > 1,
			);
			if (concurrentReports.length > 0) {
				potentialCauses.push({
					type: "concurrent_reports",
					description:
						"Multiple hosts reported simultaneously - this explains why chart shows higher numbers than individual host reports",
					count: concurrentReports.length,
					details: concurrentReports.map((entry) => ({
						timestamp: entry.timestamp,
						totalPackagesCount: entry.totalPackagesCount,
						uniqueHosts: entry.uniqueHosts,
						avgPerHost: Math.round(
							entry.totalPackagesCount / entry.uniqueHosts,
						),
					})),
					explanation:
						"The chart sums package counts across all hosts. If multiple hosts report at the same time, the chart shows the total sum, not individual host counts.",
				});
			}

			// Check for failed reports that might indicate system issues
			if (analysis.failedReports > 0) {
				potentialCauses.push({
					type: "failed_reports",
					count: analysis.failedReports,
					percentage: Math.round(
						(analysis.failedReports / analysis.totalRecords) * 100,
					),
				});
			}

			// Add aggregation explanation
			const aggregationExplanation = {
				type: "aggregation_explanation",
				description: "Chart Aggregation Logic",
				details: {
					howItWorks:
						"The package trends chart sums package counts across all hosts for each time period",
					individualHosts:
						"Each host reports its own package count (e.g., 59 packages)",
					chartDisplay:
						"Chart shows the sum of all hosts' package counts (e.g., 59 + other hosts = 500)",
					timeGrouping:
						"Multiple hosts reporting in the same hour/day are aggregated together",
				},
				example: {
					host1: "Host A reports 59 outdated packages",
					host2: "Host B reports 120 outdated packages",
					host3: "Host C reports 321 outdated packages",
					chartShows: "Chart displays 500 total packages (59+120+321)",
				},
			};
			potentialCauses.push(aggregationExplanation);

			// Add specific host breakdown if a host ID is provided
			let specificHostAnalysis = null;
			if (req.query.hostId) {
				const hostId = req.query.hostId;
				const hostData = analysis.hosts[hostId];
				if (hostData) {
					specificHostAnalysis = {
						hostId,
						hostInfo: hostData.hostInfo,
						summary: hostData.summary,
						records: hostData.records,
						explanation: `This host reported ${hostData.summary.maxPackagesCount} outdated packages, but the chart shows ${analysis.summary.maxPackagesCount} because it sums across all hosts that reported at the same time.`,
					};
				}
			}

			res.json({
				analysis,
				potentialCauses,
				specificHostAnalysis,
				recommendations: [
					"Check if any hosts had major package updates around this time",
					"Verify if any new hosts were added to the system",
					"Check for system maintenance or updates that might have triggered package checks",
					"Review any automation or scheduled tasks that run around 6pm",
					"Check if any repositories were updated or new packages were released",
					"Remember: Chart shows SUM of all hosts' package counts, not individual host counts",
				],
			});
		} catch (error) {
			console.error("Error analyzing package spike:", error);
			res.status(500).json({ error: "Failed to analyze package spike" });
		}
	},
);

module.exports = router;
