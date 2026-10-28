require("dotenv").config();

const env = {
  PORT: Number(process.env.PORT) || 5000,
  NODE_ENV: process.env.NODE_ENV || "development",
  DATABASE_URL: process.env.DATABASE_URL,
  DIRECT_URL: process.env.DIRECT_URL,

  // JWT & Security Secrets
  JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET || "dormammu_jwt_access_secret_dev_32char_key_min",
  JWT_ACCESS_EXPIRATION: process.env.JWT_ACCESS_EXPIRATION || "15m",
  REFRESH_TOKEN_EXPIRATION_DAYS: Number(process.env.REFRESH_TOKEN_EXPIRATION_DAYS) || 7,
  EMAIL_VERIFICATION_EXPIRATION_HOURS: Number(process.env.EMAIL_VERIFICATION_EXPIRATION_HOURS) || 24,
  REQUIRE_EMAIL_VERIFICATION: process.env.REQUIRE_EMAIL_VERIFICATION !== "false", // Mandatory by default!

  // URLs - strip trailing slashes to guarantee clean path joins
  FRONTEND_URL: (process.env.FRONTEND_URL || "http://localhost:5174").replace(/\/+$/, ""),
  BACKEND_URL: (process.env.BACKEND_URL || `http://localhost:${Number(process.env.PORT) || 5000}`).replace(/\/+$/, ""),

  // Mailjet Email Service
  MAILJET_API_KEY: process.env.MAILJET_API_KEY || "",
  MAILJET_SECRET_KEY: process.env.MAILJET_SECRET_KEY || "",
  MAILJET_SENDER_EMAIL: process.env.MAILJET_SENDER_EMAIL || "noreply@dormammuloop.dev",
  MAILJET_SENDER_NAME: process.env.MAILJET_SENDER_NAME || "Dormammu Loop Workflow Engine",

  // Google OAuth
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || "",
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET || "",
  GOOGLE_CALLBACK_URL: process.env.GOOGLE_CALLBACK_URL || `http://localhost:${Number(process.env.PORT) || 5000}/api/auth/google/callback`,

  // Cloudinary Image Storage
  CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME || "",
  CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY || "",
  CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET || "",
  CLOUDINARY_FOLDER: process.env.CLOUDINARY_FOLDER || "dormammu/avatars",

  // Redis & BullMQ Queue Configuration (Supports local Redis & Upstash rediss:// endpoints)
  REDIS_URL: process.env.REDIS_URL || "redis://127.0.0.1:6379",
  WORKER_CONCURRENCY: Number(process.env.WORKER_CONCURRENCY) || 5,
  TASK_LOCK_DURATION_MS: Number(process.env.TASK_LOCK_DURATION_MS) || 30000,
  WORKER_SHUTDOWN_TIMEOUT_MS: Number(process.env.WORKER_SHUTDOWN_TIMEOUT_MS) || 10000,
  WORKER_HEARTBEAT_INTERVAL_MS: Number(process.env.WORKER_HEARTBEAT_INTERVAL_MS) || 10000,
  WORKER_HEARTBEAT_TTL_SECONDS: Number(process.env.WORKER_HEARTBEAT_TTL_SECONDS) || 30,
  DLQ_MAX_JOBS: Number(process.env.DLQ_MAX_JOBS) || 1000,
};

module.exports = env;