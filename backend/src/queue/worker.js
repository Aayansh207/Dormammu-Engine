/**
 * Dormammu Engine - Standalone Queue Worker Process
 * Consumes tasks from BullMQ, executes registered node handlers,
 * and maintains durable state in PostgreSQL.
 */

require("dotenv").config();
const { Worker } = require("bullmq");
const env = require("../../env");
const prisma = require("../config/db");
const { createRedisClient, closeRedisConnections } = require("./redis.connection");
const { QUEUES } = require("./queue.constants");
const { processTaskJob } = require("./task.processor");
const { defaultRecoveryService } = require("./recovery.service");
const os = require("os");
const { defaultOutboxService } = require("./outbox.service");
const { REDIS_KEYS } = require("./queue.constants");

class TaskWorker {
  constructor(options = {}) {
    this.concurrency = options.concurrency || env.WORKER_CONCURRENCY || 5;
    this.workerId = options.workerId || `worker_${process.pid}_${Math.random().toString(36).slice(2, 7)}`;
    this.redisConnection = null;
    this.worker = null;
    this.isShuttingDown = false;
    this.startedAt = new Date().toISOString();
    this.activeJobCount = 0;
    this._heartbeatTimer = null;
    this._heartbeatIntervalMs = options.heartbeatIntervalMs || env.WORKER_HEARTBEAT_INTERVAL_MS || 10000;
    this._heartbeatTtlSeconds = options.heartbeatTtlSeconds || env.WORKER_HEARTBEAT_TTL_SECONDS || 30;
  }

  /**
   * Periodically writes worker heartbeat and health status to Redis.
   * Avoids querying or writing to PostgreSQL for high-frequency worker presence.
   * @private
   */
  async _sendHeartbeat() {
    if (!this.redisConnection || this.isShuttingDown) return;
    try {
      const key = `${REDIS_KEYS.WORKER_HEARTBEAT_PREFIX}${this.workerId}`;
      const statusData = {
        workerId: this.workerId,
        status: "ALIVE",
        pid: process.pid,
        hostname: os.hostname(),
        concurrency: this.concurrency,
        activeJobs: this.activeJobCount,
        startedAt: this.startedAt,
        lastHeartbeat: new Date().toISOString(),
      };
      await this.redisConnection.set(key, JSON.stringify(statusData), "EX", this._heartbeatTtlSeconds);
    } catch (err) {
      // Non-fatal transient heartbeat warning
      console.warn(`[TaskWorker] Heartbeat ping warning: ${err.message}`);
    }
  }

  /**
   * Discovers all currently healthy workers active in the cluster.
   * Scans Redis heartbeat keys.
   * @returns {Promise<Array<Object>>}
   */
  static async getActiveWorkers() {
    const { getSharedRedisClient } = require("./redis.connection");
    const client = getSharedRedisClient();
    try {
      const keys = await client.keys(`${REDIS_KEYS.WORKER_HEARTBEAT_PREFIX}*`);
      if (!keys || keys.length === 0) return [];

      const rawValues = await client.mget(keys);
      return rawValues
        .filter(Boolean)
        .map((v) => {
          try {
            return JSON.parse(v);
          } catch {
            return null;
          }
        })
        .filter(Boolean);
    } catch (err) {
      console.warn(`[TaskWorker] Error discovering active workers: ${err.message}`);
      return [];
    }
  }

  /**
   * Initializes and starts the BullMQ worker.
   */
  async start() {
    this.redisConnection = createRedisClient();

    this.worker = new Worker(
      QUEUES.WORKFLOW_TASKS,
      async (job) => {
        this.activeJobCount++;
        try {
          return await processTaskJob(job, this.workerId);
        } finally {
          this.activeJobCount = Math.max(0, this.activeJobCount - 1);
        }
      },
      {
        connection: this.redisConnection,
        concurrency: this.concurrency,
        stalledInterval: 15000,
        maxStalledCount: 2,
        lockDuration: env.TASK_LOCK_DURATION_MS || 30000,
      }
    );

    // Announce worker presence in Redis immediately
    await this._sendHeartbeat();
    this._heartbeatTimer = setInterval(() => {
      this._sendHeartbeat().catch(() => {});
    }, this._heartbeatIntervalMs);
    if (this._heartbeatTimer.unref) {
      this._heartbeatTimer.unref();
    }

    this.worker.on("ready", async () => {
      console.log(`🚀 [TaskWorker] Worker '${this.workerId}' ready. Concurrency: ${this.concurrency}.`);
      await this._sendHeartbeat();
    });

    this.worker.on("completed", (job, result) => {
      if (result && !result.skipped) {
        console.log(`✅ [TaskWorker] Job completed: ${job.id} (${job.data.nodeId}) in ${result.durationMs || 0}ms`);
      }
    });

    this.worker.on("failed", (job, err) => {
      console.warn(`❌ [TaskWorker] Job failed: ${job?.id} (${job?.data?.nodeId}): ${err.message}`);
    });

    this.worker.on("stalled", (jobId) => {
      console.warn(`⚠️  [TaskWorker] Job stalled: ${jobId}`);
    });

    this.worker.on("error", (err) => {
      console.error(`💥 [TaskWorker Error] ${err.message}`);
    });

    return this;
  }

  /**
   * Closes the worker and drains active jobs cleanly.
   * @param {number} [timeoutMs]
   */
  async stop(timeoutMs = env.WORKER_SHUTDOWN_TIMEOUT_MS || 10000) {
    if (this.isShuttingDown) return;
    this.isShuttingDown = true;
    console.log(`🛑 [TaskWorker] Stopping worker '${this.workerId}' (timeout: ${timeoutMs}ms)...`);

    if (this._heartbeatTimer) {
      clearInterval(this._heartbeatTimer);
      this._heartbeatTimer = null;
    }

    if (this.worker) {
      await Promise.race([
        this.worker.close(),
        new Promise((resolve) => setTimeout(resolve, timeoutMs)),
      ]);
    }

    if (this.redisConnection) {
      // Remove heartbeat key on clean shutdown
      try {
        await this.redisConnection.del(`${REDIS_KEYS.WORKER_HEARTBEAT_PREFIX}${this.workerId}`);
      } catch {}
      await this.redisConnection.quit().catch(() => this.redisConnection.disconnect());
      this.redisConnection = null;
    }

    console.log(`🏁 [TaskWorker] Worker '${this.workerId}' stopped.`);
  }
}

// Standalone executable process bootstrap
if (require.main === module) {
  const workerInstance = new TaskWorker();

  async function bootstrap() {
    try {
      await workerInstance.start();

      // Start periodic outbox dispatcher and crash recovery services on primary worker
      defaultOutboxService.startDispatcher(3000);
      defaultRecoveryService.startReconciler(15000);

      const shutdownHandler = async (sig) => {
        console.log(`\nReceived ${sig}. Shutting down worker...`);
        defaultOutboxService.stopDispatcher();
        defaultRecoveryService.stopReconciler();
        await workerInstance.stop();
        await closeRedisConnections();
        await prisma.$disconnect();
        process.exit(0);
      };

      process.on("SIGINT", () => shutdownHandler("SIGINT"));
      process.on("SIGTERM", () => shutdownHandler("SIGTERM"));
    } catch (err) {
      console.error("Failed to start TaskWorker:", err);
      process.exit(1);
    }
  }

  bootstrap();
}

module.exports = {
  TaskWorker,
};
