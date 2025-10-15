const { Queue, Worker } = require("bullmq");
const { redis, redisConnection } = require("./shared/redis");
const { prisma } = require("./shared/prisma");
const agentWs = require("../agentWs");

// Import automation classes
const GitHubUpdateCheck = require("./githubUpdateCheck");
const SessionCleanup = require("./sessionCleanup");
const OrphanedRepoCleanup = require("./orphanedRepoCleanup");

// Queue names
const QUEUE_NAMES = {
	GITHUB_UPDATE_CHECK: "github-update-check",
	SESSION_CLEANUP: "session-cleanup",
	ORPHANED_REPO_CLEANUP: "orphaned-repo-cleanup",
	AGENT_COMMANDS: "agent-commands",
};

/**
 * Main Queue Manager
 * Manages all BullMQ queues and workers
 */
class QueueManager {
	constructor() {
		this.queues = {};
		this.workers = {};
		this.automations = {};
		this.isInitialized = false;
	}

	/**
	 * Initialize all queues, workers, and automations
	 */
	async initialize() {
		try {
			console.log("✅ Redis connection successful");

			// Initialize queues
			await this.initializeQueues();

			// Initialize automation classes
			await this.initializeAutomations();

			// Initialize workers
			await this.initializeWorkers();

			// Setup event listeners
			this.setupEventListeners();

			this.isInitialized = true;
			console.log("✅ Queue manager initialized successfully");
		} catch (error) {
			console.error("❌ Failed to initialize queue manager:", error.message);
			throw error;
		}
	}

	/**
	 * Initialize all queues
	 */
	async initializeQueues() {
		for (const [_key, queueName] of Object.entries(QUEUE_NAMES)) {
			this.queues[queueName] = new Queue(queueName, {
				connection: redisConnection,
				defaultJobOptions: {
					removeOnComplete: 50, // Keep last 50 completed jobs
					removeOnFail: 20, // Keep last 20 failed jobs
					attempts: 3, // Retry failed jobs 3 times
					backoff: {
						type: "exponential",
						delay: 2000,
					},
				},
			});

			console.log(`✅ Queue '${queueName}' initialized`);
		}
	}

	/**
	 * Initialize automation classes
	 */
	async initializeAutomations() {
		this.automations[QUEUE_NAMES.GITHUB_UPDATE_CHECK] = new GitHubUpdateCheck(
			this,
		);
		this.automations[QUEUE_NAMES.SESSION_CLEANUP] = new SessionCleanup(this);
		this.automations[QUEUE_NAMES.ORPHANED_REPO_CLEANUP] =
			new OrphanedRepoCleanup(this);

		console.log("✅ All automation classes initialized");
	}

	/**
	 * Initialize all workers
	 */
	async initializeWorkers() {
		// GitHub Update Check Worker
		this.workers[QUEUE_NAMES.GITHUB_UPDATE_CHECK] = new Worker(
			QUEUE_NAMES.GITHUB_UPDATE_CHECK,
			this.automations[QUEUE_NAMES.GITHUB_UPDATE_CHECK].process.bind(
				this.automations[QUEUE_NAMES.GITHUB_UPDATE_CHECK],
			),
			{
				connection: redisConnection,
				concurrency: 1,
			},
		);

		// Session Cleanup Worker
		this.workers[QUEUE_NAMES.SESSION_CLEANUP] = new Worker(
			QUEUE_NAMES.SESSION_CLEANUP,
			this.automations[QUEUE_NAMES.SESSION_CLEANUP].process.bind(
				this.automations[QUEUE_NAMES.SESSION_CLEANUP],
			),
			{
				connection: redisConnection,
				concurrency: 1,
			},
		);

		// Orphaned Repo Cleanup Worker
		this.workers[QUEUE_NAMES.ORPHANED_REPO_CLEANUP] = new Worker(
			QUEUE_NAMES.ORPHANED_REPO_CLEANUP,
			this.automations[QUEUE_NAMES.ORPHANED_REPO_CLEANUP].process.bind(
				this.automations[QUEUE_NAMES.ORPHANED_REPO_CLEANUP],
			),
			{
				connection: redisConnection,
				concurrency: 1,
			},
		);

		// Agent Commands Worker
		this.workers[QUEUE_NAMES.AGENT_COMMANDS] = new Worker(
			QUEUE_NAMES.AGENT_COMMANDS,
			async (job) => {
				const { api_id, type, update_interval } = job.data || {};
				console.log("[agent-commands] processing job", job.id, api_id, type);

				// Log job attempt to history - use job.id as the unique identifier
				const attemptNumber = job.attemptsMade || 1;
				const historyId = job.id; // Single row per job, updated with each attempt

				try {
					if (!api_id || !type) {
						throw new Error("invalid job data");
					}

					// Find host by api_id
					const host = await prisma.hosts.findUnique({
						where: { api_id },
						select: { id: true },
					});

					// Ensure agent is connected; if not, retry later
					if (!agentWs.isConnected(api_id)) {
						const error = new Error("agent not connected");
						// Log failed attempt
						await prisma.job_history.upsert({
							where: { id: historyId },
							create: {
								id: historyId,
								job_id: job.id,
								queue_name: QUEUE_NAMES.AGENT_COMMANDS,
								job_name: type,
								host_id: host?.id,
								api_id,
								status: "failed",
								attempt_number: attemptNumber,
								error_message: error.message,
								created_at: new Date(),
								updated_at: new Date(),
							},
							update: {
								status: "failed",
								attempt_number: attemptNumber,
								error_message: error.message,
								updated_at: new Date(),
							},
						});
						console.log(
							"[agent-commands] agent not connected, will retry",
							api_id,
						);
						throw error;
					}

					// Process the command
					let result;
					if (type === "settings_update") {
						agentWs.pushSettingsUpdate(api_id, update_interval);
						console.log(
							"[agent-commands] delivered settings_update",
							api_id,
							update_interval,
						);
						result = { delivered: true, update_interval };
					} else if (type === "report_now") {
						agentWs.pushReportNow(api_id);
						console.log("[agent-commands] delivered report_now", api_id);
						result = { delivered: true };
					} else {
						throw new Error("unsupported agent command");
					}

					// Log successful completion
					await prisma.job_history.upsert({
						where: { id: historyId },
						create: {
							id: historyId,
							job_id: job.id,
							queue_name: QUEUE_NAMES.AGENT_COMMANDS,
							job_name: type,
							host_id: host?.id,
							api_id,
							status: "completed",
							attempt_number: attemptNumber,
							output: result,
							created_at: new Date(),
							updated_at: new Date(),
							completed_at: new Date(),
						},
						update: {
							status: "completed",
							attempt_number: attemptNumber,
							output: result,
							error_message: null,
							updated_at: new Date(),
							completed_at: new Date(),
						},
					});

					return result;
				} catch (error) {
					// Log error to history (if not already logged above)
					if (error.message !== "agent not connected") {
						const host = await prisma.hosts
							.findUnique({
								where: { api_id },
								select: { id: true },
							})
							.catch(() => null);

						await prisma.job_history
							.upsert({
								where: { id: historyId },
								create: {
									id: historyId,
									job_id: job.id,
									queue_name: QUEUE_NAMES.AGENT_COMMANDS,
									job_name: type || "unknown",
									host_id: host?.id,
									api_id,
									status: "failed",
									attempt_number: attemptNumber,
									error_message: error.message,
									created_at: new Date(),
									updated_at: new Date(),
								},
								update: {
									status: "failed",
									attempt_number: attemptNumber,
									error_message: error.message,
									updated_at: new Date(),
								},
							})
							.catch((err) =>
								console.error("[agent-commands] failed to log error:", err),
							);
					}
					throw error;
				}
			},
			{
				connection: redisConnection,
				concurrency: 10,
			},
		);

		// Add error handling for all workers
		Object.values(this.workers).forEach((worker) => {
			worker.on("error", (error) => {
				console.error("Worker error:", error);
			});
		});

		console.log("✅ All workers initialized");
	}

	/**
	 * Setup event listeners for all queues
	 */
	setupEventListeners() {
		for (const queueName of Object.values(QUEUE_NAMES)) {
			const queue = this.queues[queueName];
			queue.on("error", (error) => {
				console.error(`❌ Queue '${queueName}' experienced an error:`, error);
			});
			queue.on("failed", (job, err) => {
				console.error(
					`❌ Job '${job.id}' in queue '${queueName}' failed:`,
					err,
				);
			});
			queue.on("completed", (job) => {
				console.log(`✅ Job '${job.id}' in queue '${queueName}' completed.`);
			});
		}
		console.log("✅ Queue events initialized");
	}

	/**
	 * Schedule all recurring jobs
	 */
	async scheduleAllJobs() {
		await this.automations[QUEUE_NAMES.GITHUB_UPDATE_CHECK].schedule();
		await this.automations[QUEUE_NAMES.SESSION_CLEANUP].schedule();
		await this.automations[QUEUE_NAMES.ORPHANED_REPO_CLEANUP].schedule();
	}

	/**
	 * Manual job triggers
	 */
	async triggerGitHubUpdateCheck() {
		return this.automations[QUEUE_NAMES.GITHUB_UPDATE_CHECK].triggerManual();
	}

	async triggerSessionCleanup() {
		return this.automations[QUEUE_NAMES.SESSION_CLEANUP].triggerManual();
	}

	async triggerOrphanedRepoCleanup() {
		return this.automations[QUEUE_NAMES.ORPHANED_REPO_CLEANUP].triggerManual();
	}

	/**
	 * Get queue statistics
	 */
	async getQueueStats(queueName) {
		const queue = this.queues[queueName];
		if (!queue) {
			throw new Error(`Queue ${queueName} not found`);
		}

		const [waiting, active, completed, failed, delayed] = await Promise.all([
			queue.getWaiting(),
			queue.getActive(),
			queue.getCompleted(),
			queue.getFailed(),
			queue.getDelayed(),
		]);

		return {
			waiting: waiting.length,
			active: active.length,
			completed: completed.length,
			failed: failed.length,
			delayed: delayed.length,
		};
	}

	/**
	 * Get all queue statistics
	 */
	async getAllQueueStats() {
		const stats = {};
		for (const queueName of Object.values(QUEUE_NAMES)) {
			stats[queueName] = await this.getQueueStats(queueName);
		}
		return stats;
	}

	/**
	 * Get recent jobs for a queue
	 */
	async getRecentJobs(queueName, limit = 10) {
		const queue = this.queues[queueName];
		if (!queue) {
			throw new Error(`Queue ${queueName} not found`);
		}

		const [completed, failed] = await Promise.all([
			queue.getCompleted(0, limit - 1),
			queue.getFailed(0, limit - 1),
		]);

		return [...completed, ...failed]
			.sort((a, b) => new Date(b.finishedOn) - new Date(a.finishedOn))
			.slice(0, limit);
	}

	/**
	 * Get jobs for a specific host (by API ID)
	 */
	async getHostJobs(apiId, limit = 20) {
		const queue = this.queues[QUEUE_NAMES.AGENT_COMMANDS];
		if (!queue) {
			throw new Error(`Queue ${QUEUE_NAMES.AGENT_COMMANDS} not found`);
		}

		console.log(`[getHostJobs] Looking for jobs with api_id: ${apiId}`);

		// Get active queue status (waiting, active, delayed, failed)
		const [waiting, active, delayed, failed] = await Promise.all([
			queue.getWaiting(),
			queue.getActive(),
			queue.getDelayed(),
			queue.getFailed(),
		]);

		// Filter by API ID
		const filterByApiId = (jobs) =>
			jobs.filter((job) => job.data && job.data.api_id === apiId);

		const waitingCount = filterByApiId(waiting).length;
		const activeCount = filterByApiId(active).length;
		const delayedCount = filterByApiId(delayed).length;
		const failedCount = filterByApiId(failed).length;

		console.log(
			`[getHostJobs] Queue status - Waiting: ${waitingCount}, Active: ${activeCount}, Delayed: ${delayedCount}, Failed: ${failedCount}`,
		);

		// Get job history from database (shows all attempts and status changes)
		const jobHistory = await prisma.job_history.findMany({
			where: {
				api_id: apiId,
			},
			orderBy: {
				created_at: "desc",
			},
			take: limit,
		});

		console.log(
			`[getHostJobs] Found ${jobHistory.length} job history records for api_id: ${apiId}`,
		);

		return {
			waiting: waitingCount,
			active: activeCount,
			delayed: delayedCount,
			failed: failedCount,
			jobHistory: jobHistory.map((job) => ({
				id: job.id,
				job_id: job.job_id,
				job_name: job.job_name,
				status: job.status,
				attempt_number: job.attempt_number,
				error_message: job.error_message,
				output: job.output,
				created_at: job.created_at,
				updated_at: job.updated_at,
				completed_at: job.completed_at,
			})),
		};
	}

	/**
	 * Graceful shutdown
	 */
	async shutdown() {
		console.log("🛑 Shutting down queue manager...");

		for (const queueName of Object.keys(this.queues)) {
			try {
				await this.queues[queueName].close();
			} catch (e) {
				console.warn(
					`⚠️ Failed to close queue '${queueName}':`,
					e?.message || e,
				);
			}
			if (this.workers?.[queueName]) {
				try {
					await this.workers[queueName].close();
				} catch (e) {
					console.warn(
						`⚠️ Failed to close worker for '${queueName}':`,
						e?.message || e,
					);
				}
			}
		}

		await redis.quit();
		console.log("✅ Queue manager shutdown complete");
	}
}

const queueManager = new QueueManager();

module.exports = { queueManager, QUEUE_NAMES };
