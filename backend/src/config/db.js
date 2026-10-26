const env = require("../../env");
const { Pool } = require("pg");
const { PrismaPg } = require("@prisma/adapter-pg");
const { PrismaClient } = require("@prisma/client");

if (!env.DATABASE_URL) {
  throw new Error("Missing DATABASE_URL. Check your .env file.");
}

// Ensure connect_timeout=30 parameter is present in connectionString for Neon cold starts
let connectionUrl = env.DATABASE_URL;
try {
  const urlObj = new URL(connectionUrl);
  if (!urlObj.searchParams.has("connect_timeout")) {
    urlObj.searchParams.set("connect_timeout", "30");
    connectionUrl = urlObj.toString();
  }
} catch {
  // If parsing fails, proceed with raw connectionString
}

const pool = new Pool({
  connectionString: connectionUrl,
  max: 10,
  idleTimeoutMillis: 10000, // Evict idle connections quickly before serverless drops them
  connectionTimeoutMillis: 30000, // 30s allowance for Neon cold starts
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,
});

pool.on("error", (err) => {
  // Catch idle socket disconnects from Neon serverless sleep so they do not crash process
  console.warn("Neon pool connection refreshed:", err.message);
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

module.exports = prisma;