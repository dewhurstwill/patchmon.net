const { Queue, Worker } = require("bullmq");
const { redis, redisConnection } = require("./shared/redis");
const { prisma } = require("./shared/prisma");

// Import automation classes
const GitHubUpdateCheck = require("./githubUpdateCheck");
const SessionCleanup = require("./sessionCleanup");
const OrphanedRepoCleanup = require("./orphanedRepoCleanup");
const EchoHello = require("./echoHello");

// Queue names
const QUEUE_NAMES = {
	GITHUB_UPDATE_CHECK: "github-update-check",
	SESSION_CLEANUP: "session-cleanup",
	SYSTEM_MAINTENANCE: "system-maintenance",
	ECHO_HELLO: "echo-hello",
	ORPHANED_REPO_CLEANUP: "orphaned-repo-cleanup",
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
		for (const [key, queueName] of Object.entries(QUEUE_NAMES)) {
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
		this.automations[QUEUE_NAMES.ECHO_HELLO] = new EchoHello(this);

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

		// Echo Hello Worker
		this.workers[QUEUE_NAMES.ECHO_HELLO] = new Worker(
			QUEUE_NAMES.ECHO_HELLO,
			this.automations[QUEUE_NAMES.ECHO_HELLO].process.bind(
				this.automations[QUEUE_NAMES.ECHO_HELLO],
			),
			{
				connection: redisConnection,
				concurrency: 1,
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
		await this.automations[QUEUE_NAMES.ECHO_HELLO].schedule();
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

	async triggerEchoHello(message = "Hello from BullMQ!") {
		return this.automations[QUEUE_NAMES.ECHO_HELLO].triggerManual(message);
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
	 * Graceful shutdown
	 */
	async shutdown() {
		console.log("🛑 Shutting down queue manager...");

		for (const queueName of Object.keys(this.queues)) {
			await this.queues[queueName].close();
			await this.workers[queueName].close();
		}

		await redis.quit();
		console.log("✅ Queue manager shutdown complete");
	}
}

const queueManager = new QueueManager();

module.exports = { queueManager, QUEUE_NAMES };
