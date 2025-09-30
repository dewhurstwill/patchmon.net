/**
 * Database configuration for multiple instances
 * Optimizes connection pooling to prevent "too many connections" errors
 */

const { PrismaClient } = require("@prisma/client");

// Parse DATABASE_URL and add connection pooling parameters
function getOptimizedDatabaseUrl() {
	const originalUrl = process.env.DATABASE_URL;

	if (!originalUrl) {
		throw new Error("DATABASE_URL environment variable is required");
	}

	// Parse the URL
	const url = new URL(originalUrl);

	// Add connection pooling parameters for multiple instances
	url.searchParams.set("connection_limit", "5"); // Reduced from default 10
	url.searchParams.set("pool_timeout", "10"); // 10 seconds
	url.searchParams.set("connect_timeout", "10"); // 10 seconds
	url.searchParams.set("idle_timeout", "300"); // 5 minutes
	url.searchParams.set("max_lifetime", "1800"); // 30 minutes

	return url.toString();
}

// Create optimized Prisma client
function createPrismaClient() {
	const optimizedUrl = getOptimizedDatabaseUrl();

	return new PrismaClient({
		datasources: {
			db: {
				url: optimizedUrl,
			},
		},
		log:
			process.env.PRISMA_LOG_QUERIES === "true"
				? ["query", "info", "warn", "error"]
				: ["warn", "error"],
		errorFormat: "pretty",
	});
}

// Connection health check
async function checkDatabaseConnection(prisma) {
	try {
		await prisma.$queryRaw`SELECT 1`;
		return true;
	} catch (error) {
		console.error("Database connection failed:", error.message);
		return false;
	}
}

// Wait for database to be available with retry logic
async function waitForDatabase(prisma, options = {}) {
	const maxAttempts =
		options.maxAttempts ||
		parseInt(process.env.PM_DB_CONN_MAX_ATTEMPTS, 10) ||
		30;
	const waitInterval =
		options.waitInterval ||
		parseInt(process.env.PM_DB_CONN_WAIT_INTERVAL, 10) ||
		2;

	if (process.env.ENABLE_LOGGING === "true") {
		console.log(
			`Waiting for database connection (max ${maxAttempts} attempts, ${waitInterval}s interval)...`,
		);
	}

	for (let attempt = 1; attempt <= maxAttempts; attempt++) {
		try {
			const isConnected = await checkDatabaseConnection(prisma);
			if (isConnected) {
				if (process.env.ENABLE_LOGGING === "true") {
					console.log(
						`Database connected successfully after ${attempt} attempt(s)`,
					);
				}
				return true;
			}
		} catch {
			// checkDatabaseConnection already logs the error
		}

		if (attempt < maxAttempts) {
			if (process.env.ENABLE_LOGGING === "true") {
				console.log(
					`⏳ Database not ready (attempt ${attempt}/${maxAttempts}), retrying in ${waitInterval}s...`,
				);
			}
			await new Promise((resolve) => setTimeout(resolve, waitInterval * 1000));
		}
	}

	throw new Error(
		`❌ Database failed to become available after ${maxAttempts} attempts`,
	);
}

// Graceful disconnect with retry
async function disconnectPrisma(prisma, maxRetries = 3) {
	for (let i = 0; i < maxRetries; i++) {
		try {
			await prisma.$disconnect();
			console.log("Database disconnected successfully");
			return;
		} catch (error) {
			console.error(`Disconnect attempt ${i + 1} failed:`, error.message);
			if (i === maxRetries - 1) {
				console.error("Failed to disconnect from database after all retries");
			} else {
				await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait 1 second
			}
		}
	}
}

module.exports = {
	createPrismaClient,
	checkDatabaseConnection,
	waitForDatabase,
	disconnectPrisma,
	getOptimizedDatabaseUrl,
};
