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
  REQUIRE_EMAIL_VERIFICATION: process.env.REQUIRE_EMAIL_VERIFICATION === "true", // false by default: instant login without email!

  // URLs
  FRONTEND_URL: process.env.FRONTEND_URL || "http://localhost:5174",
  BACKEND_URL: process.env.BACKEND_URL || `http://localhost:${Number(process.env.PORT) || 5000}`,

  // Mailjet Email Service
  MAILJET_API_KEY: process.env.MAILJET_API_KEY || "",
  MAILJET_SECRET_KEY: process.env.MAILJET_SECRET_KEY || "",
  MAILJET_SENDER_EMAIL: process.env.MAILJET_SENDER_EMAIL || "noreply@dormammuloop.dev",
  MAILJET_SENDER_NAME: process.env.MAILJET_SENDER_NAME || "Dormammu Loop Workflow Engine",

  // Google OAuth
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || "",
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET || "",
  GOOGLE_CALLBACK_URL: process.env.GOOGLE_CALLBACK_URL || `http://localhost:${Number(process.env.PORT) || 5000}/api/auth/google/callback`,
};

module.exports = env;