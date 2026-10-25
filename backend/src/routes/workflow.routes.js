/**
 * Webster Execution Engine - Workflow Routes
 */

const express = require("express");
const { requireAuth } = require("../middleware/auth.middleware");
const workflowController = require("../controllers/workflow.controller");
const webhookController = require("../controllers/webhook.controller");

const router = express.Router();

// Public/Raw Validation endpoint (can also be called unauthenticated or with auth)
router.post("/validate", workflowController.validateRawWorkflow);

// Public Webhook trigger endpoint
router.post("/:id/webhook", webhookController.handleWebhook);
router.put("/:id/webhook", webhookController.handleWebhook);

// Authenticated workflow endpoints
router.use(requireAuth);

router.post("/", workflowController.createWorkflow);
router.get("/", workflowController.listWorkflows);
router.get("/:id", workflowController.getWorkflow);
router.put("/:id", workflowController.updateWorkflow);
router.delete("/:id", workflowController.deleteWorkflow);
router.post("/:id/validate", workflowController.validateSavedWorkflow);
router.post("/:id/runs", workflowController.executeWorkflowRun);
router.get("/:id/runs", workflowController.listWorkflowRuns);

module.exports = router;
