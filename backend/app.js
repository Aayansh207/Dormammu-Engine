
const express = require("express");
const cors = require("cors");
const prisma = require("./src/config/db");

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
    res.send("Dormammu Engine backend is running!");
});

app.get("/health/db", async (req, res) => {
    try {
        await prisma.$queryRaw`SELECT 1`;

        res.status(200).json({
            status: "success",
            message: "Database connected successfully!",
        });
    } catch (error) {
        console.error("Database connection failed:", error);

        res.status(500).json({
            status: "error",
            message: "Database connection failed",
        });
    }
});

const { createUser } = require("./src/controllers/user.controller");

app.get("/health", (req, res) => {
    res.json({ success: true, message: "API is running" });
});

app.post("/users", createUser);

module.exports = app;
