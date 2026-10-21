const express = require("express");
const cors = require("cors");
const env = require("./env");
const prisma = require("./src/config/db");

const { createUser } = require("./src/controllers/user.controller");

const app = express();
app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Dormammu Engine backend is running!");
});

app.get("/health", (req, res) => {
  res.json({ success: true, message: "API is running" });
});

app.get("/health/db", async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ success: true, message: "Database connection is working" });
  } catch (error) {
    console.error("Database health check failed:", error.message);
    res.status(500).json({ success: false, message: "Database connection failed" });
  }
});

app.post("/users", createUser);

const server = app.listen(env.PORT, () => {
  console.log(`Server is running on port ${env.PORT}`);
});

let shuttingDown = false;

async function gracefulShutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`Received ${signal}. Shutting down...`);

  server.close(async () => {
    try {
      await prisma.$disconnect();
      process.exit(0);
    } catch (error) {
      console.error("Error disconnecting Prisma:", error.message);
      process.exit(1);
    }
  });
}

process.on("SIGINT", () => gracefulShutdown("SIGINT"));
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));