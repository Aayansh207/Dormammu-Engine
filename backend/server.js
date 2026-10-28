const app = require("./app");
const env = require("./env");
const prisma = require("./src/config/db");

const nodeService = require("./src/services/node.service");
const { defaultCronScheduler } = require("./src/services/cron.service");
const { defaultCollaborationServer } = require("./src/collaboration/yjs.server");

const server = app.listen(env.PORT, async () => {
  console.log(`Server is running on port ${env.PORT}`);

  // Attach real-time Yjs CRDT WebSocket collaboration server
  defaultCollaborationServer.init(server);

  try {
    const syncRes = await nodeService.seedNodeDefinitions();
    console.log(`✅ Synchronized ${syncRes.upserted} node definitions with PostgreSQL.`);
  } catch (err) {
    console.warn("⚠️  Could not sync node definitions on startup:", err.message);
  }

  try {
    defaultCronScheduler.start();
    const cronSync = await defaultCronScheduler.syncFromDatabase();
    console.log(`🕒 Cron Scheduler started. Active scheduled workflows: ${cronSync.registered}.`);
  } catch (err) {
    console.warn("⚠️  Could not initialize Cron Scheduler on startup:", err.message);
  }

  // Auto-start background worker in development mode (or if EMBEDDED_WORKER=true)
  if (process.env.NODE_ENV !== "production" || process.env.EMBEDDED_WORKER === "true") {
    if (process.env.DISABLE_WORKER !== "true") {
      try {
        const { TaskWorker } = require("./src/queue/worker");
        devWorker = new TaskWorker({ concurrency: env.WORKER_CONCURRENCY || 5 });
        await devWorker.start();
        console.log(`🚀 [Distributed Engine] Background TaskWorker active (concurrency: ${devWorker.concurrency}).`);
      } catch (workerErr) {
        console.warn("⚠️  Could not start background worker:", workerErr.message);
      }
    }
  }
});

server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.error(`❌ Port ${env.PORT} is already in use by another process.`);
    console.error(`   To free port ${env.PORT}, run: lsof -ti :${env.PORT} | xargs kill -9`);
  } else {
    console.error("❌ Server startup error:", error);
  }
  process.exit(1);
});

let shuttingDown = false;
let devWorker = null;

async function gracefulShutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`\nReceived ${signal}. Shutting down gracefully...`);

  server.close(async () => {
    try {
      defaultCronScheduler.stop();
      if (devWorker) {
        try {
          await devWorker.stop();
        } catch (_) {}
      }
      try {
        const { closeRedisConnections } = require("./src/queue/redis.connection");
        const { closeTaskQueue } = require("./src/queue/queue.producer");
        await closeTaskQueue();
        await closeRedisConnections();
      } catch (qErr) {
        // Ignore if queue wasn't initialized
      }
      await prisma.$disconnect();
      console.log("Database and Redis disconnected. Server stopped.");
      process.exit(0);
    } catch (error) {
      console.error("Error disconnecting Prisma:", error.message);
      process.exit(1);
    }
  });
}

process.on("SIGINT", () => gracefulShutdown("SIGINT"));
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled Promise Rejection:", reason);
});

process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error);
  gracefulShutdown("uncaughtException");
});