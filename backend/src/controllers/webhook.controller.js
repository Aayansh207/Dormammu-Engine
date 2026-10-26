/**
 * Webster Execution Engine - Webhook Ingestion Controller
 * Receives incoming HTTP webhook payloads and executes workflows through the core DAG engine.
 */

const prisma = require("../config/db");
const workflowService = require("../services/workflow.service");
const { validateWorkflow } = require("../engine/validator/workflow.validator");
const { defaultRegistry } = require("../engine/registry/node.registry");

class WebhookController {
  /**
   * Ingests webhook request for a target workflow.
   * Route: POST /api/webhooks/:workflowId
   * Also supports /api/workflows/:id/webhook
   */
  async handleWebhook(req, res, next) {
    try {
      const workflowId = req.params.workflowId || req.params.id;
      if (!workflowId) {
        return res.status(400).json({
          success: false,
          error: { code: "MISSING_WORKFLOW_ID", message: "Workflow ID is required" },
        });
      }

      // 1. Fetch workflow and latest version
      const workflow = await prisma.workflow.findUnique({
        where: { id: workflowId },
        include: {
          versions: {
            orderBy: { version: "desc" },
            take: 1,
          },
        },
      });

      if (!workflow) {
        return res.status(404).json({
          success: false,
          error: { code: "WORKFLOW_NOT_FOUND", message: `Workflow '${workflowId}' not found` },
        });
      }

      const versionRecord = workflow.versions[0];
      if (!versionRecord) {
        return res.status(400).json({
          success: false,
          error: { code: "NO_VERSION_FOUND", message: "Workflow has no saved version to execute" },
        });
      }

      const definition = versionRecord.definitionJson;
      const nodes = (definition && definition.nodes) || [];

      // 2. Locate entry trigger node (trigger.webhook or trigger.manual)
      const webhookNode = nodes.find((n) => n.type === "trigger.webhook") || nodes.find((n) => n.type === "trigger.manual");
      if (!webhookNode) {
        return res.status(400).json({
          success: false,
          error: {
            code: "NO_WEBHOOK_TRIGGER",
            message: "Workflow does not contain an active trigger node ('trigger.webhook' or 'trigger.manual')",
          },
        });
      }

      const config = webhookNode.config || {};

      // 3. Verify HTTP method
      const allowedMethods = Array.isArray(config.allowedMethods) && config.allowedMethods.length > 0
        ? config.allowedMethods.map((m) => String(m).toUpperCase())
        : ["POST", "PUT"];

      const reqMethod = req.method.toUpperCase();
      if (!allowedMethods.includes(reqMethod)) {
        return res.status(405).json({
          success: false,
          error: {
            code: "METHOD_NOT_ALLOWED",
            message: `Method ${reqMethod} not allowed. Allowed methods: ${allowedMethods.join(", ")}`,
          },
        });
      }

      // 4. Verify Secret Token if configured on webhook node
      const expectedToken = (config.webhookToken && String(config.webhookToken).trim() !== "")
        ? String(config.webhookToken).trim()
        : null;

      if (expectedToken) {
        const headerToken = req.headers["x-webhook-token"] || req.headers["x-api-key"];
        const queryToken = req.query.token;
        const authHeader = req.headers["authorization"];
        const bearerToken = authHeader && authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;

        const providedToken = headerToken || queryToken || bearerToken;
        if (!providedToken || providedToken !== expectedToken) {
          return res.status(401).json({
            success: false,
            error: {
              code: "UNAUTHORIZED_WEBHOOK",
              message: "Invalid or missing webhook authorization token",
            },
          });
        }
      }

      // 5. Validate workflow structure before execution
      const validation = validateWorkflow(definition, defaultRegistry);
      if (!validation.valid) {
        return res.status(400).json({
          success: false,
          error: {
            code: "INVALID_WORKFLOW",
            message: `Workflow validation failed: ${validation.errors[0]?.message}`,
            details: validation.errors,
          },
        });
      }

      // 6. Construct safe trigger payload
      // Sanitize headers to exclude sensitive credentials
      const safeHeaders = { ...req.headers };
      delete safeHeaders["authorization"];
      delete safeHeaders["cookie"];
      delete safeHeaders["x-webhook-token"];
      delete safeHeaders["x-api-key"];

      const triggerData = {
        $webhook: true,
        $triggerType: "WEBHOOK",
        body: req.body,
        headers: safeHeaders,
        query: req.query || {},
        method: reqMethod,
      };

      // 7. Execute through common execution pipeline (supports sync and async modes)
      const isAsync = req.query.async === "true" || req.headers["x-execution-mode"] === "async";

      if (isAsync) {
        // Durably initialize the run record in RUNNING state
        const initialRun = await workflowService.createInitialRun(workflow.ownerId, workflow.id, {
          versionId: versionRecord.id,
          triggerData,
          triggerType: "WEBHOOK",
        });

        // Trigger execution asynchronously without waiting
        workflowService.executeWorkflowRun(workflow.ownerId, workflow.id, {
          versionId: versionRecord.id,
          triggerData,
          triggerType: "WEBHOOK",
          triggerMetadata: {
            method: reqMethod,
            remoteIp: req.ip || req.connection?.remoteAddress,
            userAgent: req.headers["user-agent"],
          },
          existingRunId: initialRun.id,
        }).catch((err) => {
          console.error(`Async execution error for run ${initialRun.id}:`, err);
        });

        return res.status(202).json({
          success: true,
          runId: initialRun.id,
          status: "RUNNING",
          resultUrl: `/api/runs/${initialRun.id}`,
          reportUrl: `/api/runs/${initialRun.id}/report`,
          reportPageUrl: `/runs/${initialRun.id}`,
        });
      }

      // Synchronous execution (default)
      const runResult = await workflowService.executeWorkflowRun(workflow.ownerId, workflow.id, {
        versionId: versionRecord.id,
        triggerData,
        triggerType: "WEBHOOK",
        triggerMetadata: {
          method: reqMethod,
          remoteIp: req.ip || req.connection?.remoteAddress,
          userAgent: req.headers["user-agent"],
        },
      });

      const httpStatus = runResult.status === "SUCCEEDED" ? 200 : 422;

      return res.status(httpStatus).json({
        success: runResult.status === "SUCCEEDED",
        runId: runResult.runId,
        status: runResult.status,
        resultUrl: `/api/runs/${runResult.runId}`,
        reportUrl: `/api/runs/${runResult.runId}/report`,
        reportPageUrl: `/runs/${runResult.runId}`,
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new WebhookController();
