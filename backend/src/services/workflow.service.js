/**
 * Webster Execution Engine - Workflow Persistence & Execution Service
 */

const prisma = require("../config/db");
const { validateWorkflow } = require("../engine/validator/workflow.validator");
const { executeWorkflow } = require("../engine/scheduler/dag.scheduler");
const { defaultRegistry } = require("../engine/registry/node.registry");
const { ErrorCodes } = require("../engine/contracts/errors");

class WorkflowService {
  /**
   * Creates a new workflow with version 1 in a database transaction.
   * @param {string} userId - Authenticated user ID (owner)
   * @param {Object} data - { name, description, definition }
   */
  async createWorkflow(userId, { name, description = "", definition = null }) {
    const workflowName = (name || (definition && definition.name) || "Untitled Workflow").trim();

    const initialDefinition = definition || {
      schemaVersion: 1,
      name: workflowName,
      nodes: [],
      edges: [],
    };

    // Validate initial definition structurally
    const validation = validateWorkflow(initialDefinition, defaultRegistry);

    const result = await prisma.$transaction(async (tx) => {
      const workflow = await tx.workflow.create({
        data: {
          ownerId: userId,
          name: workflowName,
          description: description || null,
        },
      });

      const versionRecord = await tx.workflowVersion.create({
        data: {
          workflowId: workflow.id,
          version: 1,
          schemaVersion: String(initialDefinition.schemaVersion || "1.0"),
          definitionJson: initialDefinition,
        },
      });

      return {
        ...workflow,
        currentVersion: versionRecord.version,
        schemaVersion: versionRecord.schemaVersion,
        definition: versionRecord.definitionJson,
        validation,
      };
    });

    return result;
  }

  /**
   * Lists all workflows owned by the user.
   * @param {string} userId
   */
  async listWorkflows(userId) {
    const workflows = await prisma.workflow.findMany({
      where: { ownerId: userId },
      orderBy: { updatedAt: "desc" },
      include: {
        versions: {
          orderBy: { version: "desc" },
          take: 1,
          select: {
            id: true,
            version: true,
            schemaVersion: true,
            createdAt: true,
            definitionJson: true,
          },
        },
        _count: {
          select: {
            versions: true,
          },
        },
      },
    });

    return workflows.map((wf) => {
      const latestVersion = wf.versions[0] || null;
      const def = latestVersion ? latestVersion.definitionJson : null;
      const nodesCount = def && Array.isArray(def.nodes) ? def.nodes.length : 0;
      const edgesCount = def && Array.isArray(def.edges) ? def.edges.length : 0;

      return {
        id: wf.id,
        ownerId: wf.ownerId,
        name: wf.name,
        description: wf.description,
        createdAt: wf.createdAt,
        updatedAt: wf.updatedAt,
        latestVersion: latestVersion ? latestVersion.version : 1,
        latestVersionId: latestVersion ? latestVersion.id : null,
        nodesCount,
        edgesCount,
        totalVersions: wf._count.versions,
      };
    });
  }

  /**
   * Retrieves a workflow by ID, ensuring user ownership.
   * @param {string} userId
   * @param {string} workflowId
   */
  async getWorkflowById(userId, workflowId) {
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
      const err = new Error("Workflow not found");
      err.statusCode = 404;
      throw err;
    }

    if (workflow.ownerId !== userId) {
      const err = new Error("Forbidden: You do not have permission to access this workflow");
      err.statusCode = 403;
      throw err;
    }

    const latestVersion = workflow.versions[0] || null;
    const definition = latestVersion ? latestVersion.definitionJson : null;
    const validation = definition ? validateWorkflow(definition, defaultRegistry) : { valid: false, errors: [], warnings: [] };

    return {
      id: workflow.id,
      ownerId: workflow.ownerId,
      name: workflow.name,
      description: workflow.description,
      createdAt: workflow.createdAt,
      updatedAt: workflow.updatedAt,
      version: latestVersion ? latestVersion.version : 1,
      versionId: latestVersion ? latestVersion.id : null,
      schemaVersion: latestVersion ? latestVersion.schemaVersion : "1.0",
      definition,
      validation,
    };
  }

  /**
   * Saves an updated workflow definition as a new immutable version.
   * @param {string} userId
   * @param {string} workflowId
   * @param {Object} data - { name, description, definition }
   */
  async updateWorkflow(userId, workflowId, { name, description, definition }) {
    const existing = await prisma.workflow.findUnique({
      where: { id: workflowId },
      include: {
        versions: {
          orderBy: { version: "desc" },
          take: 1,
        },
      },
    });

    if (!existing) {
      const err = new Error("Workflow not found");
      err.statusCode = 404;
      throw err;
    }

    if (existing.ownerId !== userId) {
      const err = new Error("Forbidden: You do not have permission to edit this workflow");
      err.statusCode = 403;
      throw err;
    }

    if (!definition || typeof definition !== "object") {
      const err = new Error("A valid workflow definition object is required");
      err.statusCode = 400;
      throw err;
    }

    // Run structural & semantic validation
    const validation = validateWorkflow(definition, defaultRegistry);

    const latestVersion = existing.versions[0];
    const nextVersionNumber = (latestVersion ? latestVersion.version : 0) + 1;
    const updatedName = (name || definition.name || existing.name).trim();

    const result = await prisma.$transaction(async (tx) => {
      // 1. Create immutable version record
      const versionRecord = await tx.workflowVersion.create({
        data: {
          workflowId: existing.id,
          version: nextVersionNumber,
          schemaVersion: String(definition.schemaVersion || "1.0"),
          definitionJson: definition,
        },
      });

      // 2. Update workflow metadata
      const updatedWorkflow = await tx.workflow.update({
        where: { id: existing.id },
        data: {
          name: updatedName,
          ...(description !== undefined ? { description } : {}),
          updatedAt: new Date(),
        },
      });

      return {
        id: updatedWorkflow.id,
        ownerId: updatedWorkflow.ownerId,
        name: updatedWorkflow.name,
        description: updatedWorkflow.description,
        createdAt: updatedWorkflow.createdAt,
        updatedAt: updatedWorkflow.updatedAt,
        version: versionRecord.version,
        versionId: versionRecord.id,
        schemaVersion: versionRecord.schemaVersion,
        definition: versionRecord.definitionJson,
        validation,
      };
    });

    return result;
  }

  /**
   * Deletes a workflow and all associated versions/runs.
   * @param {string} userId
   * @param {string} workflowId
   */
  async deleteWorkflow(userId, workflowId) {
    const existing = await prisma.workflow.findUnique({
      where: { id: workflowId },
    });

    if (!existing) {
      const err = new Error("Workflow not found");
      err.statusCode = 404;
      throw err;
    }

    if (existing.ownerId !== userId) {
      const err = new Error("Forbidden: You do not have permission to delete this workflow");
      err.statusCode = 403;
      throw err;
    }

    await prisma.workflow.delete({
      where: { id: workflowId },
    });

    return { success: true, message: "Workflow deleted successfully" };
  }

  /**
   * Validates a workflow definition against all standard rules without saving.
   * @param {Object} definition
   */
  validateDefinition(definition) {
    return validateWorkflow(definition, defaultRegistry);
  }

  /**
   * Executes a workflow version and records complete run and task state in PostgreSQL.
   * @param {string} userId
   * @param {string} workflowId
   * @param {Object} [options={}] - { versionId, triggerData }
   */
  async executeWorkflowRun(userId, workflowId, { versionId = null, triggerData = {} } = {}) {
    const workflow = await prisma.workflow.findUnique({
      where: { id: workflowId },
      include: {
        versions: {
          orderBy: { version: "desc" },
          ...(versionId ? { where: { id: versionId } } : { take: 1 }),
        },
      },
    });

    if (!workflow) {
      const err = new Error("Workflow not found");
      err.statusCode = 404;
      throw err;
    }

    if (workflow.ownerId !== userId) {
      const err = new Error("Forbidden: You do not have permission to execute this workflow");
      err.statusCode = 403;
      throw err;
    }

    const versionRecord = workflow.versions[0];
    if (!versionRecord) {
      const err = new Error("No saved version found for this workflow");
      err.statusCode = 400;
      throw err;
    }

    const definition = versionRecord.definitionJson;

    // 1. Initial Level 5 validation check before run creation
    const validation = validateWorkflow(definition, defaultRegistry);
    if (!validation.valid) {
      const primary = validation.errors[0];
      const err = new Error(`Cannot execute invalid workflow: ${primary.message}`);
      err.statusCode = 400;
      err.details = validation;
      throw err;
    }

    // 2. Create WorkflowRun in PENDING state
    const runRecord = await prisma.workflowRun.create({
      data: {
        workflowVersionId: versionRecord.id,
        status: "RUNNING",
        input: triggerData || {},
      },
    });

    // 3. Callback to persist/update TaskRun states as nodes execute
    const onTaskStateChange = async (runId, taskRecord) => {
      try {
        await prisma.taskRun.upsert({
          where: {
            workflowRunId_nodeId: {
              workflowRunId: runRecord.id,
              nodeId: taskRecord.nodeId,
            },
          },
          update: {
            status: taskRecord.status,
            attempts: taskRecord.attempts || 1,
            input: taskRecord.inputs !== undefined ? taskRecord.inputs : null,
            output: taskRecord.outputs !== undefined ? taskRecord.outputs : null,
            error: taskRecord.error !== undefined ? taskRecord.error : null,
            startedAt: taskRecord.startedAt ? new Date(taskRecord.startedAt) : null,
            finishedAt: taskRecord.completedAt ? new Date(taskRecord.completedAt) : null,
          },
          create: {
            workflowRunId: runRecord.id,
            nodeId: taskRecord.nodeId,
            status: taskRecord.status,
            attempts: taskRecord.attempts || 1,
            input: taskRecord.inputs !== undefined ? taskRecord.inputs : null,
            output: taskRecord.outputs !== undefined ? taskRecord.outputs : null,
            error: taskRecord.error !== undefined ? taskRecord.error : null,
            startedAt: taskRecord.startedAt ? new Date(taskRecord.startedAt) : null,
            finishedAt: taskRecord.completedAt ? new Date(taskRecord.completedAt) : null,
          },
        });
      } catch (err) {
        console.error(`Failed to persist TaskRun for node ${taskRecord.nodeId}:`, err.message);
      }
    };

    // 4. Execute through the in-process DAG scheduler
    const execSummary = await executeWorkflow(definition, {
      runId: runRecord.id,
      triggerData,
      registry: defaultRegistry,
      onTaskStateChange,
    });

    // 5. Finalize WorkflowRun status and outputs
    const finishedAt = new Date();
    await prisma.workflowRun.update({
      where: { id: runRecord.id },
      data: {
        status: execSummary.status,
        output: execSummary.finalOutput !== undefined ? execSummary.finalOutput : null,
        error: execSummary.error || null,
        finishedAt,
      },
    });

    return {
      runId: runRecord.id,
      workflowId: workflow.id,
      workflowName: workflow.name,
      workflowVersionId: versionRecord.id,
      version: versionRecord.version,
      status: execSummary.status,
      finalOutput: execSummary.finalOutput,
      durationMs: execSummary.durationMs,
      startedAt: execSummary.startedAt,
      completedAt: execSummary.completedAt,
      tasks: execSummary.tasks,
      executionTrace: execSummary.executionTrace,
      error: execSummary.error,
    };
  }

  /**
   * Retrieves a run by ID with all task run records.
   * @param {string} userId
   * @param {string} runId
   */
  async getRunById(userId, runId) {
    const run = await prisma.workflowRun.findUnique({
      where: { id: runId },
      include: {
        workflowVersion: {
          include: {
            workflow: {
              select: { id: true, name: true, ownerId: true },
            },
          },
        },
        taskRuns: {
          orderBy: { startedAt: "asc" },
        },
      },
    });

    if (!run) {
      const err = new Error("Workflow run not found");
      err.statusCode = 404;
      throw err;
    }

    if (run.workflowVersion.workflow.ownerId !== userId) {
      const err = new Error("Forbidden: You do not have permission to view this execution run");
      err.statusCode = 403;
      throw err;
    }

    return {
      id: run.id,
      workflowId: run.workflowVersion.workflow.id,
      workflowName: run.workflowVersion.workflow.name,
      version: run.workflowVersion.version,
      status: run.status,
      input: run.input,
      output: run.output,
      error: run.error,
      startedAt: run.startedAt,
      finishedAt: run.finishedAt,
      createdAt: run.createdAt,
      taskRuns: run.taskRuns,
    };
  }

  /**
   * Lists execution runs for a workflow.
   * @param {string} userId
   * @param {string} workflowId
   */
  async listRunsForWorkflow(userId, workflowId) {
    const workflow = await prisma.workflow.findUnique({
      where: { id: workflowId },
      select: { id: true, ownerId: true },
    });

    if (!workflow) {
      const err = new Error("Workflow not found");
      err.statusCode = 404;
      throw err;
    }

    if (workflow.ownerId !== userId) {
      const err = new Error("Forbidden: You do not have permission to view runs for this workflow");
      err.statusCode = 403;
      throw err;
    }

    const runs = await prisma.workflowRun.findMany({
      where: {
        workflowVersion: {
          workflowId,
        },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        workflowVersion: {
          select: { version: true },
        },
        _count: {
          select: { taskRuns: true },
        },
      },
    });

    return runs.map((r) => ({
      id: r.id,
      version: r.workflowVersion.version,
      status: r.status,
      output: r.output,
      error: r.error,
      startedAt: r.startedAt,
      finishedAt: r.finishedAt,
      createdAt: r.createdAt,
      taskCount: r._count.taskRuns,
    }));
  }
}

module.exports = new WorkflowService();
