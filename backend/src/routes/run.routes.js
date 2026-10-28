/**
 * Webster Execution Engine - Run Inspection Routes
 */

const express = require("express");
const { requireAuth } = require("../middleware/auth.middleware");
const workflowController = require("../controllers/workflow.controller");

const router = express.Router();

router.use(requireAuth);

// Queue metrics and DLQ inspection (defined before :runId param)
router.get("/queue/metrics", workflowController.getQueueMetrics);
router.get("/dlq", workflowController.listDeadLetterJobs);
router.post("/dlq/:jobId/retry", workflowController.retryDeadLetterJob);

router.get("/", workflowController.listAllUserRuns);
router.get("/:runId", workflowController.getRunDetails);
router.get("/:runId/report", workflowController.getRunReport);
router.get("/:runId/tasks", workflowController.getRunTasks);
router.get("/:runId/events", workflowController.streamRunEvents);

module.exports = router;
