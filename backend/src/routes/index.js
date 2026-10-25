const express = require("express");
const authRoutes = require("./auth.routes");
const sessionRoutes = require("./session.routes");
const userRoutes = require("./user.routes");
const workflowRoutes = require("./workflow.routes");
const nodeRoutes = require("./node.routes");
const runRoutes = require("./run.routes");
const webhookRoutes = require("./webhook.routes");
const mockRoutes = require("./mock.routes");

const router = express.Router();

router.use("/auth", authRoutes);
router.use("/sessions", sessionRoutes);
router.use("/users", userRoutes);
router.use("/workflows", workflowRoutes);
router.use("/nodes", nodeRoutes);
router.use("/runs", runRoutes);
router.use("/webhooks", webhookRoutes);
router.use("/mock", mockRoutes);

module.exports = router;
