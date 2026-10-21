const app = require("./app");
const env = require("./env");
const prisma = require("./src/config/db");

const server = app.listen(env.PORT, () => {
  console.log(`Server is running on port ${env.PORT}`);
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

async function gracefulShutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`\nReceived ${signal}. Shutting down gracefully...`);

  server.close(async () => {
    try {
      await prisma.$disconnect();
      console.log("Database disconnected. Server stopped.");
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