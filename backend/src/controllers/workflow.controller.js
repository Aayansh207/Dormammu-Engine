/**
 * Webster Execution Engine - Workflow & Run Controller
 */

const workflowService = require("../services/workflow.service");

class WorkflowController {
  async createWorkflow(req, res, next) {
    try {
      const userId = req.user.id;
      const { name, description, definition } = req.body;
      const workflow = await workflowService.createWorkflow(userId, { name, description, definition });
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
      const workflows = await workflowService.listWorkflows(userId);
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
      const runResult = await workflowService.executeWorkflowRun(userId, id, { versionId, triggerData });
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
      const runs = await workflowService.listRunsForWorkflow(userId, id);
      return res.status(200).json({
        success: true,
        data: runs,
      });
    } catch (err) {
      next(err);
    }
  }

  async getRunDetails(req, res, next) {
    try {
      const userId = req.user.id;
      const { runId } = req.params;
      const run = await workflowService.getRunById(userId, runId);
      return res.status(200).json({
        success: true,
        data: run,
      });
    } catch (err) {
      next(err);
    }
  }

  async getRunTasks(req, res, next) {
    try {
      const userId = req.user.id;
      const { runId } = req.params;
      const run = await workflowService.getRunById(userId, runId);
      return res.status(200).json({
        success: true,
        data: run.taskRuns,
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new WorkflowController();
