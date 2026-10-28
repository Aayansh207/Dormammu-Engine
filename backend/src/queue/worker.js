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
const { defaultOutboxService } = require("./outbox.service");

class TaskWorker {
  constructor(options = {}) {
    this.concurrency = options.concurrency || env.WORKER_CONCURRENCY || 5;
    this.workerId = options.workerId || `worker_${process.pid}_${Math.random().toString(36).slice(2, 7)}`;
    this.redisConnection = null;
    this.worker = null;
    this.isShuttingDown = false;
  }

  /**
   * Initializes and starts the BullMQ worker.
   */
  async start() {
    this.redisConnection = createRedisClient();

    this.worker = new Worker(
      QUEUES.WORKFLOW_TASKS,
      async (job) => {
        return processTaskJob(job, this.workerId);
      },
      {
        connection: this.redisConnection,
        concurrency: this.concurrency,
        stalledInterval: 15000,
        maxStalledCount: 2,
        lockDuration: env.TASK_LOCK_DURATION_MS || 30000,
      }
    );

    this.worker.on("ready", () => {
      console.log(`🚀 [TaskWorker] Worker '${this.workerId}' ready. Concurrency: ${this.concurrency}.`);
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

    if (this.worker) {
      await Promise.race([
        this.worker.close(),
        new Promise((resolve) => setTimeout(resolve, timeoutMs)),
      ]);
    }

    if (this.redisConnection) {
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
