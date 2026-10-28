/**
 * Dormammu Engine - Centralized Redis Connection Infrastructure
 * Provides shared, resilient IORedis connections for BullMQ Queue, Worker,
 * and distributed Pub/Sub broadcasting with native Upstash Redis (TLS) support.
 */

const Redis = require("ioredis");
const env = require("../../env");

let sharedRedisClient = null;
let sharedSubscriberClient = null;

/**
 * Sanitizes a Redis connection URL by masking passwords.
 * Safe for structured logging and error diagnostics.
 * @param {string} rawUrl
 * @returns {string}
 */
function sanitizeRedisUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== "string") return "redis://[undefined]";
  try {
    const parsed = new URL(rawUrl);
    if (parsed.password) {
      parsed.password = "********";
    }
    return parsed.toString();
  } catch {
    return "redis://[malformed-url]";
  }
}

/**
 * Validates and extracts connection parameters from a Redis URL.
 * Detects whether TLS is required (e.g. Upstash rediss:// protocol).
 * @param {string} [connectionUrl]
 * @returns {{ isTls: boolean, sanitizedUrl: string, options: Object }}
 */
function parseRedisConnectionOptions(connectionUrl) {
  const url = connectionUrl || env.REDIS_URL || "redis://127.0.0.1:6379";
  const isTls = url.startsWith("rediss://");
  let servername = undefined;
  let password = undefined;

  try {
    const parsed = new URL(url);
    servername = parsed.hostname;
    if (parsed.password) {
      password = parsed.password;
    }
  } catch (err) {
    console.warn(`[Redis Connection] Invalid REDIS_URL format: ${err.message}`);
  }

  const options = {
    maxRetriesPerRequest: null, // Mandatory for BullMQ workers and queues
    enableReadyCheck: false,    // Safe for managed Redis proxies (Upstash / AWS ElastiCache)
    lazyConnect: false,
    keepAlive: 10000,           // 10s TCP keep-alive probe to prevent Upstash idle connection drops
    family: 4,                  // Prefer IPv4 to avoid IPv6 latency spikes on cloud hosts
    connectTimeout: 10000,      // 10s connection timeout
    retryStrategy(times) {
      // Exponential backoff with jitter; maximum 3000ms delay
      const baseDelay = Math.min(times * 150, 3000);
      const jitter = Math.floor(Math.random() * 200);
      return baseDelay + jitter;
    },
    reconnectOnError(err) {
      const targetErrors = ["READONLY", "ETIMEDOUT", "ECONNRESET", "CLOSED", "LOADING"];
      return targetErrors.some((t) => err.message && err.message.includes(t));
    },
  };

  // Upstash TLS configuration
  if (isTls) {
    options.tls = {
      servername,
      rejectUnauthorized: true, // Validate SSL certificates in production
    };
  }

  return {
    isTls,
    sanitizedUrl: sanitizeRedisUrl(url),
    servername,
    password,
    tls: options.tls,
    keepAlive: options.keepAlive,
    options,
  };
}

/**
 * Creates a configured IORedis connection instance.
 * @param {Object} [overrides={}]
 * @returns {import('ioredis').Redis}
 */
function createRedisClient(overrides = {}) {
  const connectionUrl = overrides.url || env.REDIS_URL || "redis://127.0.0.1:6379";
  const { options, sanitizedUrl, isTls } = parseRedisConnectionOptions(connectionUrl);

  const client = new Redis(connectionUrl, {
    ...options,
    ...overrides,
  });

  client.on("connect", () => {
    // Avoid noisy logging in tests; only log in dev/prod
    if (process.env.NODE_ENV !== "test") {
      console.log(`[Redis] Connected successfully (${isTls ? "TLS/Upstash" : "Standard"}: ${sanitizedUrl})`);
    }
  });

  client.on("error", (err) => {
    // Prevent unhandled promise rejection crashing the process on transient network hiccups
    console.warn(`[Redis Connection Error] ${sanitizedUrl}: ${err.message}`);
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
  sanitizeRedisUrl,
  parseRedisConnectionOptions,
};
