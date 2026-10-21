
const express = require("express");
const prisma = require("./src/config/db");

const app = express();

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

module.exports = app;
