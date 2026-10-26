/**
 * Webster Execution Engine - Workflow Persistence & Execution Service
 */

const prisma = require("../config/db");
const { validateWorkflow } = require("../engine/validator/workflow.validator");
const { executeWorkflow } = require("../engine/scheduler/dag.scheduler");
const { defaultRegistry } = require("../engine/registry/node.registry");
const { ErrorCodes } = require("../engine/contracts/errors");
const { defaultSseService } = require("./sse.service");

/**
 * Recursively sanitizes payloads to ensure sensitive credentials, tokens, and secrets
 * are masked before persistence in execution reports.
 * Also enforces safety boundaries on unbounded payloads.
 */
function sanitizePayload(data, depth = 0) {
  if (depth > 10) return "[Max Depth Reached]";
  if (data === null || data === undefined) return data;
  if (typeof data !== "object") {
    if (typeof data === "string" && data.length > 50000) {
      return data.slice(0, 50000) + "... [Truncated]";
    }
    return data;
  }
  if (Array.isArray(data)) {
    if (data.length > 500) {
      return data.slice(0, 500).map((item) => sanitizePayload(item, depth + 1)).concat(["... [Truncated array]"]);
    }
    return data.map((item) => sanitizePayload(item, depth + 1));
  }
  const sanitized = {};
  for (const [key, val] of Object.entries(data)) {
    const lower = key.toLowerCase();
    if (
      lower.includes("password") ||
      lower.includes("secret") ||
      lower.includes("cookie") ||
      lower === "authorization" ||
      lower === "apikey" ||
      lower === "api_key" ||
      lower === "x-webhook-token" ||
      lower === "x-api-key"
    ) {
      sanitized[key] = "[REDACTED]";
    } else {
      sanitized[key] = sanitizePayload(val, depth + 1);
    }
  }
  return sanitized;
}

/**
 * Assembles a complete, self-contained, durable execution report for a workflow run.
 */
function buildExecutionReport({
  runId,
  workflow,
  versionRecord,
  definition,
  triggerType,
  triggerMetadata = {},
  input,
  status,
  startedAt,
  completedAt,
  durationMs,
  tasks = {},
  executionTrace = [],
  finalOutput = null,
  error = null,
}) {
  const nodes = Object.values(tasks).map((t) => ({
    id: t.nodeId,
    nodeId: t.nodeId,
    nodeType: t.nodeType || null,
    nodeName: t.nodeName || t.nodeId,
    status: t.status,
    attempts: t.attempts || 1,
    input: sanitizePayload(t.inputs !== undefined ? t.inputs : t.input),
    output: sanitizePayload(t.outputs !== undefined ? t.outputs : t.output),
    startedAt: t.startedAt || null,
    completedAt: t.completedAt || t.finishedAt || null,
    durationMs: t.durationMs !== undefined ? t.durationMs : null,
    error: t.error || null,
    logs: t.logs || [],
  }));

  return {
    schemaVersion: 1,
    runId,
    workflow: {
      id: workflow.id,
      name: workflow.name,
      version: versionRecord?.version || 1,
      definition,
    },
    trigger: {
      type: triggerType,
      metadata: sanitizePayload(triggerMetadata),
    },
    input: sanitizePayload(input),
    execution: {
      status,
      startedAt,
      completedAt,
      durationMs,
    },
    nodes,
    events: executionTrace || [],
    finalOutput: sanitizePayload(finalOutput),
    error: error || null,
  };
}

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
  async executeWorkflowRun(userId, workflowId, { versionId = null, triggerData = {}, triggerType = null, triggerMetadata = {} } = {}) {
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

    // 1. Level 1-4 validation check before run creation
    const validation = validateWorkflow(definition, defaultRegistry);
    if (!validation.valid) {
      const primary = validation.errors[0];
      const err = new Error(`Cannot execute invalid workflow: ${primary.message}`);
      err.statusCode = 400;
      err.details = validation;
      throw err;
    }

    const resolvedTriggerType = triggerType ||
      triggerData?.$triggerType ||
      (triggerData?.$webhook ? "WEBHOOK" : (triggerData?.$cron ? "CRON" : "MANUAL"));

    const startedAt = new Date().toISOString();
    const sanitizedInput = sanitizePayload(triggerData) || {};

    // 2. Create durable WorkflowRun record in RUNNING state
    const runRecord = await prisma.workflowRun.create({
      data: {
        workflowId: workflow.id,
        workflowVersionId: versionRecord.id,
        status: "RUNNING",
        triggerType: resolvedTriggerType,
        input: sanitizedInput,
        startedAt: new Date(startedAt),
      },
    });

    // 3. Callback for live SSE event streaming ONLY (no per-task database writes!)
    const onTaskStateChange = (runId, taskRecord) => {
      defaultSseService.emitRunEvent(runRecord.id, `task:${taskRecord.status.toLowerCase()}`, {
        runId: runRecord.id,
        nodeId: taskRecord.nodeId,
        nodeName: taskRecord.nodeName,
        status: taskRecord.status,
        startedAt: taskRecord.startedAt,
        completedAt: taskRecord.completedAt,
        durationMs: taskRecord.durationMs,
        inputs: taskRecord.inputs,
        outputs: taskRecord.outputs,
        error: taskRecord.error,
      });
    };

    // Emit workflow started event via SSE
    defaultSseService.emitRunEvent(runRecord.id, "workflow:started", {
      runId: runRecord.id,
      workflowId: workflow.id,
      workflowName: workflow.name,
      status: "RUNNING",
      startedAt,
    });

    // 4. Execute through the in-process DAG scheduler (collecting execution state in memory)
    let execSummary;
    try {
      execSummary = await executeWorkflow(definition, {
        runId: runRecord.id,
        triggerData,
        registry: defaultRegistry,
        onTaskStateChange,
      });
    } catch (err) {
      execSummary = {
        status: "FAILED",
        finalOutput: null,
        startedAt,
        completedAt: new Date().toISOString(),
        durationMs: Math.max(0, Date.now() - new Date(startedAt).getTime()),
        tasks: {},
        executionTrace: [],
        error: {
          code: err.code || "EXECUTION_ERROR",
          message: err.message,
        },
      };
    }

    // 5. Finalize WorkflowRun status, output, duration, and complete report atomically
    const completedAt = execSummary.completedAt || new Date().toISOString();
    const durationMs = execSummary.durationMs !== undefined && execSummary.durationMs !== null
      ? execSummary.durationMs
      : Math.max(0, new Date(completedAt).getTime() - new Date(startedAt).getTime());

    const report = buildExecutionReport({
      runId: runRecord.id,
      workflow,
      versionRecord,
      definition,
      triggerType: resolvedTriggerType,
      triggerMetadata,
      input: sanitizedInput,
      status: execSummary.status,
      startedAt,
      completedAt,
      durationMs,
      tasks: execSummary.tasks,
      executionTrace: execSummary.executionTrace,
      finalOutput: execSummary.finalOutput,
      error: execSummary.error,
    });

    await prisma.workflowRun.update({
      where: { id: runRecord.id },
      data: {
        status: execSummary.status,
        output: execSummary.finalOutput !== undefined ? execSummary.finalOutput : null,
        error: execSummary.error || null,
        durationMs,
        finishedAt: new Date(completedAt),
        report,
      },
    });

    // Emit workflow terminal state via SSE
    defaultSseService.emitRunEvent(runRecord.id, "workflow:completed", {
      runId: runRecord.id,
      workflowId: workflow.id,
      status: execSummary.status,
      finalOutput: execSummary.finalOutput,
      durationMs,
      startedAt,
      completedAt,
      error: execSummary.error,
    });

    return {
      id: runRecord.id,
      runId: runRecord.id,
      workflowId: workflow.id,
      workflowName: workflow.name,
      workflowVersionId: versionRecord.id,
      version: versionRecord.version,
      status: execSummary.status,
      triggerType: resolvedTriggerType,
      input: sanitizedInput,
      output: execSummary.finalOutput,
      finalOutput: execSummary.finalOutput,
      durationMs,
      startedAt,
      finishedAt: completedAt,
      completedAt,
      tasks: execSummary.tasks,
      nodeResults: execSummary.tasks,
      executionTrace: execSummary.executionTrace,
      error: execSummary.error,
      report,
    };
  }

  /**
   * Retrieves a run by ID with its complete execution report.
   * @param {string|Object} userOrId - Authenticated userId or user object
   * @param {string} runId
   */
  async getRunById(userOrId, runId) {
    const userId = typeof userOrId === "object" && userOrId ? userOrId.id : userOrId;
    const userRole = typeof userOrId === "object" && userOrId ? userOrId.role : null;

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
      },
    });

    if (!run) {
      const err = new Error("Workflow run not found");
      err.statusCode = 404;
      throw err;
    }

    const ownerId = run.workflowVersion?.workflow?.ownerId;
    if (ownerId && ownerId !== userId && userRole !== "ADMIN") {
      const err = new Error("Forbidden: You do not have permission to view this execution run");
      err.statusCode = 403;
      throw err;
    }

    let report = run.report;
    const nodeResults = {};

    if (report && Array.isArray(report.nodes)) {
      for (const n of report.nodes) {
        nodeResults[n.nodeId] = {
          nodeId: n.nodeId,
          nodeType: n.nodeType,
          nodeName: n.nodeName,
          status: n.status,
          attempts: n.attempts || 1,
          input: n.input,
          inputs: n.input,
          output: n.output,
          outputs: n.output,
          error: n.error,
          startedAt: n.startedAt,
          completedAt: n.completedAt,
          finishedAt: n.completedAt,
          durationMs: n.durationMs,
          logs: n.logs || [],
        };
      }
    } else {
      // Fallback for any legacy run lacking a report JSON
      const legacyTaskRuns = await prisma.taskRun.findMany({
        where: { workflowRunId: runId },
        orderBy: { startedAt: "asc" },
      });

      for (const tr of legacyTaskRuns) {
        nodeResults[tr.nodeId] = {
          nodeId: tr.nodeId,
          status: tr.status,
          attempts: tr.attempts,
          input: tr.input,
          inputs: tr.input,
          output: tr.output,
          outputs: tr.output,
          error: tr.error,
          startedAt: tr.startedAt,
          completedAt: tr.finishedAt,
          finishedAt: tr.finishedAt,
          durationMs: tr.finishedAt && tr.startedAt
            ? Math.max(0, new Date(tr.finishedAt).getTime() - new Date(tr.startedAt).getTime())
            : 0,
        };
      }
    }

    const durationMs = run.durationMs !== null && run.durationMs !== undefined
      ? run.durationMs
      : (run.finishedAt && run.startedAt
          ? Math.max(0, new Date(run.finishedAt).getTime() - new Date(run.startedAt).getTime())
          : 0);

    const triggerType = run.triggerType ||
      (run.input?.$triggerType || (run.input?.$webhook ? "WEBHOOK" : (run.input?.$cron ? "CRON" : "MANUAL")));

    const taskList = Object.values(nodeResults);

    return {
      id: run.id,
      runId: run.id,
      workflowId: run.workflowId || run.workflowVersion?.workflow?.id,
      workflowName: run.workflowVersion?.workflow?.name,
      version: run.workflowVersion?.version,
      status: run.status,
      triggerType,
      input: run.input,
      output: run.output,
      finalOutput: run.output,
      error: run.error,
      startedAt: run.startedAt,
      finishedAt: run.finishedAt,
      completedAt: run.finishedAt,
      durationMs,
      createdAt: run.createdAt,
      report: run.report,
      taskRuns: taskList,
      tasks: nodeResults,
      nodeResults,
    };
  }

  /**
   * Retrieves the complete standalone execution report for a run.
   * @param {string|Object} userOrId
   * @param {string} runId
   */
  async getRunReport(userOrId, runId) {
    const run = await this.getRunById(userOrId, runId);
    return run.report;
  }

  /**
   * Lists lightweight execution runs for a specific workflow with pagination and filtering.
   * Does NOT query large reports or task runs.
   * @param {string} userId
   * @param {string} workflowId
   * @param {Object} [options={}] - { page, limit, status, triggerType }
   */
  async listRunsForWorkflow(userId, workflowId, options = {}) {
    const workflow = await prisma.workflow.findUnique({
      where: { id: workflowId },
      select: { id: true, ownerId: true, name: true },
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

    const page = Math.max(1, parseInt(options.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(options.limit, 10) || 20));
    const skip = (page - 1) * limit;

    const where = {
      OR: [
        { workflowId },
        { workflowVersion: { workflowId } },
      ],
      ...(options.status ? { status: options.status } : {}),
      ...(options.triggerType ? { triggerType: options.triggerType } : {}),
    };

    const [total, runs] = await Promise.all([
      prisma.workflowRun.count({ where }),
      prisma.workflowRun.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        select: {
          id: true,
          workflowId: true,
          status: true,
          triggerType: true,
          durationMs: true,
          error: true,
          startedAt: true,
          finishedAt: true,
          createdAt: true,
          output: true,
          workflowVersion: {
            select: { version: true },
          },
        },
      }),
    ]);

    const formattedRuns = runs.map((r) => {
      const durationMs = r.durationMs !== null && r.durationMs !== undefined
        ? r.durationMs
        : (r.finishedAt && r.startedAt
            ? Math.max(0, new Date(r.finishedAt).getTime() - new Date(r.startedAt).getTime())
            : 0);

      return {
        id: r.id,
        runId: r.id,
        workflowId: r.workflowId || workflowId,
        workflowName: workflow.name,
        version: r.workflowVersion?.version || 1,
        status: r.status,
        triggerType: r.triggerType || "MANUAL",
        startedAt: r.startedAt,
        finishedAt: r.finishedAt,
        completedAt: r.finishedAt,
        durationMs,
        createdAt: r.createdAt,
        hasOutput: r.output !== null && r.output !== undefined,
        errorSummary: r.error ? (r.error.message || String(r.error)) : null,
      };
    });

    return Object.assign(formattedRuns, {
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  }

  /**
   * Lists lightweight execution runs across all workflows owned by the user.
   * @param {string} userId
   * @param {Object} [options={}] - { page, limit, status, triggerType, workflowId }
   */
  async listAllUserRuns(userId, options = {}) {
    const page = Math.max(1, parseInt(options.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(options.limit, 10) || 20));
    const skip = (page - 1) * limit;

    const where = {
      workflowVersion: {
        workflow: {
          ownerId: userId,
        },
      },
      ...(options.workflowId ? { workflowId: options.workflowId } : {}),
      ...(options.status ? { status: options.status } : {}),
      ...(options.triggerType ? { triggerType: options.triggerType } : {}),
    };

    const [total, runs] = await Promise.all([
      prisma.workflowRun.count({ where }),
      prisma.workflowRun.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        select: {
          id: true,
          workflowId: true,
          status: true,
          triggerType: true,
          durationMs: true,
          error: true,
          startedAt: true,
          finishedAt: true,
          createdAt: true,
          output: true,
          workflowVersion: {
            select: {
              version: true,
              workflow: {
                select: { id: true, name: true },
              },
            },
          },
        },
      }),
    ]);

    const formattedRuns = runs.map((r) => {
      const durationMs = r.durationMs !== null && r.durationMs !== undefined
        ? r.durationMs
        : (r.finishedAt && r.startedAt
            ? Math.max(0, new Date(r.finishedAt).getTime() - new Date(r.startedAt).getTime())
            : 0);

      return {
        id: r.id,
        runId: r.id,
        workflowId: r.workflowId || r.workflowVersion?.workflow?.id,
        workflowName: r.workflowVersion?.workflow?.name || "Workflow",
        version: r.workflowVersion?.version || 1,
        status: r.status,
        triggerType: r.triggerType || "MANUAL",
        startedAt: r.startedAt,
        finishedAt: r.finishedAt,
        completedAt: r.finishedAt,
        durationMs,
        createdAt: r.createdAt,
        hasOutput: r.output !== null && r.output !== undefined,
        errorSummary: r.error ? (r.error.message || String(r.error)) : null,
      };
    });

    return Object.assign(formattedRuns, {
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  }
}

module.exports = new WorkflowService();
