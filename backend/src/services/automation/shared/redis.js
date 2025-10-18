const IORedis = require("ioredis");

// Redis connection configuration
const redisConnection = {
	host: process.env.REDIS_HOST || "localhost",
	port: parseInt(process.env.REDIS_PORT, 10) || 6379,
	password: process.env.REDIS_PASSWORD || undefined,
	username: process.env.REDIS_USER || undefined,
	db: parseInt(process.env.REDIS_DB, 10) || 0,
	retryDelayOnFailover: 100,
	maxRetriesPerRequest: null, // BullMQ requires this to be null
};

// Create Redis connection
const redis = new IORedis(redisConnection);

module.exports = { redis, redisConnection };
