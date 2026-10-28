/**
 * Webster Execution Engine - Workflow & Run Controller
 */

const workflowService = require("../services/workflow.service");
const { defaultSseService } = require("../services/sse.service");

class WorkflowController {
  async createWorkflow(req, res, next) {
    try {
      const userId = req.user.id;
      const { name, description, definition, workspaceId } = req.body;
      const workflow = await workflowService.createWorkflow(userId, { name, description, definition, workspaceId });
      return res.status(201).json({
        success: true,
        data: workflow,
      });
    } catch (err) {
      next(err);
    }
  }

  async listWorkflows(req, res, next) {
    try {
      const userId = req.user.id;
      const { workspaceId } = req.query;
      const workflows = await workflowService.listWorkflows(userId, workspaceId);
      return res.status(200).json({
        success: true,
        data: workflows,
      });
    } catch (err) {
      next(err);
    }
  }

  async getWorkflow(req, res, next) {
    try {
      const userId = req.user.id;
      const { id } = req.params;
      const workflow = await workflowService.getWorkflowById(userId, id);
      return res.status(200).json({
        success: true,
        data: workflow,
      });
    } catch (err) {
      next(err);
    }
  }

  async updateWorkflow(req, res, next) {
    try {
      const userId = req.user.id;
      const { id } = req.params;
      const { name, description, definition } = req.body;
      const updated = await workflowService.updateWorkflow(userId, id, { name, description, definition });
      return res.status(200).json({
        success: true,
        data: updated,
      });
    } catch (err) {
      next(err);
    }
  }

  async deleteWorkflow(req, res, next) {
    try {
      const userId = req.user.id;
      const { id } = req.params;
      const result = await workflowService.deleteWorkflow(userId, id);
      return res.status(200).json({
        success: true,
        ...result,
      });
    } catch (err) {
      next(err);
    }
  }

  async validateSavedWorkflow(req, res, next) {
    try {
      const userId = req.user.id;
      const { id } = req.params;
      const workflow = await workflowService.getWorkflowById(userId, id);
      const validation = workflowService.validateDefinition(workflow.definition);
      return res.status(200).json({
        success: true,
        data: validation,
      });
    } catch (err) {
      next(err);
    }
  }

  async validateRawWorkflow(req, res, next) {
    try {
      const definition = req.body.definition || req.body;
      const validation = workflowService.validateDefinition(definition);
      return res.status(200).json({
        success: true,
        data: validation,
      });
    } catch (err) {
      next(err);
    }
  }

  async executeWorkflowRun(req, res, next) {
    try {
      const userId = req.user.id;
      const { id } = req.params;
      const { versionId, triggerData } = req.body || {};
      const idempotencyKey = req.headers["idempotency-key"] || req.headers["x-idempotency-key"] || req.body?.idempotencyKey;
      const isAsync = req.query.async === "true" || req.headers["x-execution-mode"] === "async" || req.body?.mode === "async";

      if (isAsync) {
        const dispatchResult = await workflowService.dispatchWorkflowRun(userId, id, {
          versionId,
          triggerData,
          triggerType: "MANUAL",
          idempotencyKey,
        });

        const host = (typeof req.get === "function" ? req.get("host") : req.headers?.host) || "localhost:5001";
        const protocol = req.headers?.["x-forwarded-proto"] || req.protocol || "http";
        const apiBase = `${protocol}://${host}`;

        return res.status(202).json({
          success: true,
          data: {
            ...dispatchResult,
            resultUrl: `${apiBase}/api/runs/${dispatchResult.runId}`,
            reportUrl: `${apiBase}/api/runs/${dispatchResult.runId}/report`,
            eventsUrl: `${apiBase}/api/runs/${dispatchResult.runId}/events`,
          },
        });
      }

      const runResult = await workflowService.executeWorkflowRun(userId, id, {
        versionId,
        triggerData,
        idempotencyKey,
      });

      return res.status(200).json({
        success: true,
        data: runResult,
      });
    } catch (err) {
      next(err);
    }
  }

  async listWorkflowRuns(req, res, next) {
    try {
      const userId = req.user.id;
      const { id } = req.params;
      const { page, limit, status, triggerType } = req.query;
      const runs = await workflowService.listRunsForWorkflow(userId, id, { page, limit, status, triggerType });
      return res.status(200).json({
        success: true,
        data: runs,
        pagination: runs.pagination,
      });
    } catch (err) {
      next(err);
    }
  }

  async listAllUserRuns(req, res, next) {
    try {
      const userId = req.user.id;
      const { page, limit, status, triggerType, workflowId, search } = req.query;
      const runs = await workflowService.listAllUserRuns(userId, { page, limit, status, triggerType, workflowId, search });
      return res.status(200).json({
        success: true,
        data: runs,
        pagination: runs.pagination,
      });
    } catch (err) {
      next(err);
    }
  }

  async getRunDetails(req, res, next) {
    try {
      const { runId } = req.params;
      const run = await workflowService.getRunById(req.user, runId);
      return res.status(200).json({
        success: true,
        data: run,
      });
    } catch (err) {
      next(err);
    }
  }

  async getRunReport(req, res, next) {
    try {
      const { runId } = req.params;
      const report = await workflowService.getRunReport(req.user, runId);
      return res.status(200).json({
        success: true,
        data: report,
      });
    } catch (err) {
      next(err);
    }
  }

  async getRunTasks(req, res, next) {
    try {
      const { runId } = req.params;
      const run = await workflowService.getRunById(req.user, runId);
      return res.status(200).json({
        success: true,
        data: run.taskRuns,
      });
    } catch (err) {
      next(err);
    }
  }

  async streamRunEvents(req, res, next) {
    try {
      const userId = req.user.id;
      const { runId } = req.params;
      const run = await workflowService.getRunById(userId, runId);

      defaultSseService.subscribe(runId, res);

      // If already in a terminal state, stream existing tasks and completion immediately
      if (["SUCCEEDED", "FAILED", "CANCELLED"].includes(run.status)) {
        for (const task of run.taskRuns || []) {
          defaultSseService.sendRaw(res, `task:${task.status.toLowerCase()}`, {
            runId: run.id,
            nodeId: task.nodeId,
            status: task.status,
            attempts: task.attempts,
            inputs: task.input,
            outputs: task.output,
            input: task.input,
            output: task.output,
            error: task.error,
            startedAt: task.startedAt,
            completedAt: task.finishedAt,
            finishedAt: task.finishedAt,
            durationMs: task.finishedAt && task.startedAt
              ? Math.max(0, new Date(task.finishedAt).getTime() - new Date(task.startedAt).getTime())
              : 0,
          });
        }
        defaultSseService.sendRaw(res, "workflow:completed", {
          runId: run.id,
          workflowId: run.workflowId,
          status: run.status,
          finalOutput: run.output,
          output: run.output,
          error: run.error,
          startedAt: run.startedAt,
          finishedAt: run.finishedAt,
          completedAt: run.finishedAt,
          durationMs: run.durationMs,
        });
      }
    } catch (err) {
      next(err);
    }
  }

  async listWorkflowVersions(req, res, next) {
    try {
      const userId = req.user.id;
      const { id } = req.params;
      const versions = await workflowService.listWorkflowVersions(userId, id);
      return res.status(200).json({
        success: true,
        data: versions,
      });
    } catch (err) {
      next(err);
    }
  }

  async getWorkflowVersion(req, res, next) {
    try {
      const userId = req.user.id;
      const { id, version } = req.params;
      const versionRecord = await workflowService.getWorkflowVersion(userId, id, version);
      return res.status(200).json({
        success: true,
        data: versionRecord,
      });
    } catch (err) {
      next(err);
    }
  }

  async restoreWorkflowVersion(req, res, next) {
    try {
      const userId = req.user.id;
      const { id, version } = req.params;
      const restored = await workflowService.restoreWorkflowVersion(userId, id, version);
      return res.status(200).json({
        success: true,
        message: `Restored version ${version} as new active version`,
        data: restored,
      });
    } catch (err) {
      next(err);
    }
  }

  async getQueueMetrics(req, res, next) {
    try {
      const { getQueueMetrics, getDlqMetrics } = require("../queue/queue.producer");
      const { TaskWorker } = require("../queue/worker");
      const { defaultDbMetrics } = require("../utils/db.metrics");
      const { checkRedisHealth } = require("../queue/redis.connection");

      const [taskQueueMetrics, dlqMetrics, activeWorkers, isRedisHealthy] = await Promise.all([
        getQueueMetrics().catch(() => ({ waiting: 0, active: 0, delayed: 0, failed: 0, completed: 0 })),
        getDlqMetrics().catch(() => ({ waiting: 0, active: 0, delayed: 0, failed: 0, completed: 0 })),
        TaskWorker.getActiveWorkers().catch(() => []),
        checkRedisHealth().catch(() => false),
      ]);

      const dbMetrics = defaultDbMetrics.getMetricsSummary();

      return res.status(200).json({
        success: true,
        data: {
          redis: {
            healthy: isRedisHealthy,
          },
          queues: {
            workflowTasks: taskQueueMetrics,
            deadLetterQueue: dlqMetrics,
          },
          workers: {
            activeCount: activeWorkers.length,
            pool: activeWorkers,
          },
          database: dbMetrics,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (err) {
      next(err);
    }
  }

  async listDeadLetterJobs(req, res, next) {
    try {
      const { getDlqJobs } = require("../queue/queue.producer");
      const start = Math.max(0, parseInt(req.query.start, 10) || 0);
      const end = Math.min(100, Math.max(start, parseInt(req.query.end, 10) || start + 49));
      const jobs = await getDlqJobs(start, end);
      return res.status(200).json({
        success: true,
        data: jobs,
        pagination: { start, end, count: jobs.length },
      });
    } catch (err) {
      next(err);
    }
  }

  async retryDeadLetterJob(req, res, next) {
    try {
      const { retryDlqJob } = require("../queue/queue.producer");
      const { jobId } = req.params;
      const result = await retryDlqJob(jobId);
      return res.status(200).json({
        success: true,
        message: `Dead-letter job '${jobId}' re-enqueued for execution`,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new WorkflowController();

