/**
 * Echo Hello Automation
 * Simple test automation task
 */
class EchoHello {
	constructor(queueManager) {
		this.queueManager = queueManager;
		this.queueName = "echo-hello";
	}

	/**
	 * Process echo hello job
	 */
	async process(job) {
		const startTime = Date.now();
		console.log("👋 Starting echo hello task...");

		try {
			// Simple echo task
			const message = job.data.message || "Hello from BullMQ!";
			const timestamp = new Date().toISOString();

			// Simulate some work
			await new Promise((resolve) => setTimeout(resolve, 100));

			const executionTime = Date.now() - startTime;
			console.log(`✅ Echo hello completed in ${executionTime}ms: ${message}`);

			return {
				success: true,
				message,
				timestamp,
				executionTime,
			};
		} catch (error) {
			const executionTime = Date.now() - startTime;
			console.error(
				`❌ Echo hello failed after ${executionTime}ms:`,
				error.message,
			);
			throw error;
		}
	}

	/**
	 * Echo hello is manual only - no scheduling
	 */
	async schedule() {
		console.log("ℹ️ Echo hello is manual only - no scheduling needed");
		return null;
	}

	/**
	 * Trigger manual echo hello
	 */
	async triggerManual(message = "Hello from BullMQ!") {
		const job = await this.queueManager.queues[this.queueName].add(
			"echo-hello-manual",
			{ message },
			{ priority: 1 },
		);
		console.log("✅ Manual echo hello triggered");
		return job;
	}
}

module.exports = EchoHello;
