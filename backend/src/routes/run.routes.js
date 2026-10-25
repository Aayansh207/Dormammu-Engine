/**
 * Webster Execution Engine - Run Inspection Routes
 */

const express = require("express");
const { requireAuth } = require("../middleware/auth.middleware");
const workflowController = require("../controllers/workflow.controller");

const router = express.Router();

router.use(requireAuth);

router.get("/:runId", workflowController.getRunDetails);
router.get("/:runId/tasks", workflowController.getRunTasks);
router.get("/:runId/events", workflowController.streamRunEvents);

module.exports = router;
