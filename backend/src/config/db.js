const env = require("../../env");
const { PrismaPg } = require("@prisma/adapter-pg");
const { PrismaClient } = require("@prisma/client");

if (!env.DATABASE_URL) {
  throw new Error("Missing DATABASE_URL. Check your .env file.");
}

const adapter = new PrismaPg({
  connectionString: env.DATABASE_URL,
});

const prisma = new PrismaClient({ adapter });

module.exports = prisma;