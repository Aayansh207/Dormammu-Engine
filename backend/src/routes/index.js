const express = require("express");
const authRoutes = require("./auth.routes");
const sessionRoutes = require("./session.routes");
const userRoutes = require("./user.routes");

const router = express.Router();

router.use("/auth", authRoutes);
router.use("/sessions", sessionRoutes);
router.use("/users", userRoutes);

module.exports = router;
