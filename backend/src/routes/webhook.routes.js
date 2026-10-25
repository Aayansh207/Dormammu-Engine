/**
 * Webster Execution Engine - Webhook Routes
 */

const express = require("express");
const webhookController = require("../controllers/webhook.controller");

const router = express.Router();

// Webhook ingestion endpoints
router.post("/:workflowId", webhookController.handleWebhook);
router.put("/:workflowId", webhookController.handleWebhook);

module.exports = router;
