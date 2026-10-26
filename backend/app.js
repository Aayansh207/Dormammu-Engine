const express = require("express");
const cors = require("cors");
const env = require("./env");
const prisma = require("./src/config/db");
const apiRoutes = require("./src/routes");
const { createUser } = require("./src/controllers/user.controller");

const app = express();

app.set("trust proxy", 1);
app.set("json spaces", 2);

const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:5174",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:5174",
  env.FRONTEND_URL,
].filter(Boolean);

if (env.FRONTEND_URL) {
  try {
    const parsedOrigin = new URL(env.FRONTEND_URL).origin;
    if (!allowedOrigins.includes(parsedOrigin)) {
      allowedOrigins.push(parsedOrigin);
    }
  } catch (e) {
    if (!allowedOrigins.includes(env.FRONTEND_URL)) {
      allowedOrigins.push(env.FRONTEND_URL);
    }
  }
}

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin 
    if (!origin || allowedOrigins.includes(origin) || origin.endsWith(".vercel.app") || env.NODE_ENV !== "production") {
      return callback(null, true);
    }
    return callback(null, true); // Permissive fallback for Vercel / Render deployments
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-Requested-With",
    "Accept",
    "x-refresh-token",
  ],
}));

app.options(/(.*)/, cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));

// Normalize request URLs so requests like //api/auth/verify-email resolve properly to /api/auth/verify-email
app.use((req, res, next) => {
  if (req.url.startsWith("//")) {
    req.url = req.url.replace(/^\/+/, "/");
  }
  next();
});

app.get("/", (req, res) => {
  res.send("Dormammu Engine backend is running!");
});

app.get("/health", (req, res) => {
  res.json({ success: true, message: "API is running" });
});

app.get("/health/db", async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({
      success: true,
      message: "Database connection is working",
    });
  } catch (error) {
    console.error("Database connection failed:", error.message);
    res.status(500).json({
      success: false,
      message: "Database connection failed",
    });
  }
});

app.post("/users", createUser);

app.use("/api", apiRoutes);

app.use("/api", (req, res) => {
  res.status(404).json({
    success: false,
    message: `API route not found: ${req.method} ${req.originalUrl}`,
  });
});

app.use((err, req, res, next) => {
  const isDbConnectionError =
    err.message?.includes("Connection terminated") ||
    err.message?.includes("connection timeout") ||
    err.code === "ECONNRESET" ||
    err.code === "57P01";

  const status = err.statusCode || (isDbConnectionError ? 503 : 500);

  if (status >= 500) {
    console.error(`[${req.method} ${req.originalUrl}] Server error (${status}):`, err.message || err);
  } else {
    console.warn(`[${req.method} ${req.originalUrl}] Handled client error (${status}): ${err.message}`);
  }

  res.status(status).json({
    success: false,
    message: isDbConnectionError
      ? "Database is temporarily reconnecting. Please retry in a few seconds."
      : (err.message || "Internal server error"),
  });
});

module.exports = app;
