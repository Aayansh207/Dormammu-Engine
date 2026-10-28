/**
 * Dormammu Engine - Centralized Redis Connection Infrastructure
 * Provides shared, resilient IORedis connections for BullMQ Queue, Worker,
 * and distributed Pub/Sub broadcasting.
 */

const Redis = require("ioredis");
const env = require("../../env");

let sharedRedisClient = null;
let sharedSubscriberClient = null;

/**
 * Creates a configured IORedis connection instance.
 * @param {Object} [overrides={}]
 * @returns {import('ioredis').Redis}
 */
function createRedisClient(overrides = {}) {
  const connectionUrl = overrides.url || env.REDIS_URL || "redis://localhost:6379";

  const options = {
    maxRetriesPerRequest: null, // Mandatory for BullMQ workers and queues
    enableReadyCheck: false,
    retryStrategy(times) {
      // Exponential backoff with maximum 3s reconnect delay
      const delay = Math.min(times * 100, 3000);
      return delay;
    },
    reconnectOnError(err) {
      const targetErrors = ["READONLY", "ETIMEDOUT", "ECONNRESET"];
      return targetErrors.some((t) => err.message.includes(t));
    },
    ...overrides,
  };

  const client = new Redis(connectionUrl, options);

  client.on("error", (err) => {
    // Avoid unhandled rejection crashing the process on transient disconnects
    console.warn(`[Redis Connection] ${err.message}`);
  });

  return client;
}

/**
 * Returns a shared Redis connection for general producers and queries.
 * @returns {import('ioredis').Redis}
 */
function getSharedRedisClient() {
  if (!sharedRedisClient || sharedRedisClient.status === "end") {
    sharedRedisClient = createRedisClient();
  }
  return sharedRedisClient;
}

/**
 * Returns a dedicated subscriber client for Pub/Sub.
 * @returns {import('ioredis').Redis}
 */
function getSharedSubscriberClient() {
  if (!sharedSubscriberClient || sharedSubscriberClient.status === "end") {
    sharedSubscriberClient = createRedisClient();
  }
  return sharedSubscriberClient;
}

/**
 * Gracefully disconnects all shared Redis connections.
 */
async function closeRedisConnections() {
  const promises = [];
  if (sharedRedisClient && sharedRedisClient.status !== "end") {
    promises.push(sharedRedisClient.quit().catch(() => sharedRedisClient.disconnect()));
    sharedRedisClient = null;
  }
  if (sharedSubscriberClient && sharedSubscriberClient.status !== "end") {
    promises.push(sharedSubscriberClient.quit().catch(() => sharedSubscriberClient.disconnect()));
    sharedSubscriberClient = null;
  }
  await Promise.all(promises);
}

/**
 * Verifies Redis connectivity with ping.
 * @returns {Promise<boolean>}
 */
async function checkRedisHealth() {
  try {
    const client = getSharedRedisClient();
    const pong = await client.ping();
    return pong === "PONG";
  } catch (err) {
    return false;
  }
}

module.exports = {
  createRedisClient,
  getSharedRedisClient,
  getSharedSubscriberClient,
  closeRedisConnections,
  checkRedisHealth,
};
