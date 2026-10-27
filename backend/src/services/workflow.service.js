/**
 * Webster Execution Engine - Workflow Persistence & Execution Service
 */

const prisma = require("../config/db");
const { validateWorkflow } = require("../engine/validator/workflow.validator");
const { executeWorkflow } = require("../engine/scheduler/dag.scheduler");
const { defaultRegistry } = require("../engine/registry/node.registry");
const { ErrorCodes } = require("../engine/contracts/errors");
const { defaultSseService } = require("./sse.service");
const { defaultCronScheduler } = require("./cron.service");
const workspaceService = require("./workspace.service");

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
   * Resolves a workflow by ID and determines the caller's role (OWNER, EDITOR, VIEWER).
   * Supports both workspace-assigned workflows and private author workflows.
   */
  async resolveWorkflowAccess(userId, workflowId) {
    const workflow = await prisma.workflow.findUnique({
      where: { id: workflowId },
      include: {
        workspace: {
          select: { id: true, name: true, ownerId: true },
        },
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

    let role = null;
    if (workflow.workspaceId) {
      role = await workspaceService.getUserWorkspaceRole(userId, workflow.workspaceId);
    }

    // Direct workflow owner always has OWNER role
    if (!role && workflow.ownerId === userId) {
      role = "OWNER";
    }

    if (!role) {
      const err = new Error("Forbidden: You do not have permission to access this workflow");
      err.statusCode = 403;
      throw err;
    }

    return {
      workflow,
      role,
      canModify: role === "OWNER" || role === "EDITOR",
      canExecute: role === "OWNER" || role === "EDITOR",
      canDelete: role === "OWNER",
    };
  }

  /**
   * Creates a new workflow with version 1 in a database transaction.
   * @param {string} userId - Authenticated user ID (owner)
   * @param {Object} data - { name, description, definition, workspaceId }
   */
  async createWorkflow(userId, { name, description = "", definition = null, workspaceId = null }) {
    if (workspaceId) {
      const role = await workspaceService.getUserWorkspaceRole(userId, workspaceId);
      if (!role || role === "VIEWER") {
        const err = new Error("Forbidden: You must be an Owner or Editor in this workspace to create workflows");
        err.statusCode = 403;
        throw err;
      }
    }

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
          workspaceId: workspaceId || null,
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
        version: versionRecord.version,
        currentVersion: versionRecord.version,
        schemaVersion: versionRecord.schemaVersion,
        definition: versionRecord.definitionJson,
        validation,
        currentUserRole: "OWNER",
      };
    });

    // Automatically sync schedule if definition contains trigger.cron
    defaultCronScheduler.syncWorkflowDefinition(result.id, userId, initialDefinition);

    return result;
  }

  /**
   * Lists all workflows accessible to the user (personal and workspace shared).
   * @param {string} userId
   * @param {string} [workspaceId=null]
   */
  async listWorkflows(userId, workspaceId = null) {
    let whereClause;

    if (workspaceId) {
      const role = await workspaceService.getUserWorkspaceRole(userId, workspaceId);
      if (!role) {
        const err = new Error("Forbidden: You do not have access to this workspace");
        err.statusCode = 403;
        throw err;
      }
      whereClause = { workspaceId };
    } else {
      const userMemberships = await prisma.workspaceMember.findMany({
        where: { userId },
        select: { workspaceId: true },
      });
      const memberWorkspaceIds = userMemberships.map((m) => m.workspaceId);

      whereClause = {
        OR: [
          { ownerId: userId },
          ...(memberWorkspaceIds.length > 0 ? [{ workspaceId: { in: memberWorkspaceIds } }] : []),
        ],
      };
    }

    const workflows = await prisma.workflow.findMany({
      where: whereClause,
      orderBy: { updatedAt: "desc" },
      include: {
        workspace: {
          select: { id: true, name: true },
        },
        user: {
          select: { id: true, name: true, email: true },
        },
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

    // Batch resolve roles for memberships
    const memberships = await prisma.workspaceMember.findMany({
      where: { userId },
      select: { workspaceId: true, role: true },
    });
    const roleMap = new Map(memberships.map((m) => [m.workspaceId, m.role]));

    return workflows.map((wf) => {
      const latestVersion = wf.versions[0] || null;
      const def = latestVersion ? latestVersion.definitionJson : null;
      const nodesCount = def && Array.isArray(def.nodes) ? def.nodes.length : 0;
      const edgesCount = def && Array.isArray(def.edges) ? def.edges.length : 0;

      let role = "VIEWER";
      if (wf.ownerId === userId) {
        role = "OWNER";
      } else if (wf.workspaceId && roleMap.has(wf.workspaceId)) {
        role = roleMap.get(wf.workspaceId);
      }

      return {
        id: wf.id,
        ownerId: wf.ownerId,
        owner: wf.user,
        workspaceId: wf.workspaceId,
        workspace: wf.workspace,
        name: wf.name,
        description: wf.description,
        createdAt: wf.createdAt,
        updatedAt: wf.updatedAt,
        latestVersion: latestVersion ? latestVersion.version : 1,
        latestVersionId: latestVersion ? latestVersion.id : null,
        nodesCount,
        edgesCount,
        totalVersions: wf._count.versions,
        currentUserRole: role,
      };
    });
  }

  /**
   * Retrieves a workflow by ID with caller's permission role.
   * @param {string} userId
   * @param {string} workflowId
   */
  async getWorkflowById(userId, workflowId) {
    const { workflow, role } = await this.resolveWorkflowAccess(userId, workflowId);

    const latestVersion = workflow.versions[0] || null;
    const definition = latestVersion ? latestVersion.definitionJson : null;
    const validation = definition ? validateWorkflow(definition, defaultRegistry) : { valid: false, errors: [], warnings: [] };

    return {
      id: workflow.id,
      ownerId: workflow.ownerId,
      workspaceId: workflow.workspaceId,
      workspace: workflow.workspace,
      name: workflow.name,
      description: workflow.description,
      createdAt: workflow.createdAt,
      updatedAt: workflow.updatedAt,
      version: latestVersion ? latestVersion.version : 1,
      versionId: latestVersion ? latestVersion.id : null,
      schemaVersion: latestVersion ? latestVersion.schemaVersion : "1.0",
      definition,
      validation,
      currentUserRole: role,
    };
  }

  /**
   * Saves an updated workflow definition as a new immutable version.
   * Viewers are forbidden from modifying.
   * @param {string} userId
   * @param {string} workflowId
   * @param {Object} data - { name, description, definition }
   */
  async updateWorkflow(userId, workflowId, { name, description, definition }) {
    const { workflow: existing, role } = await this.resolveWorkflowAccess(userId, workflowId);

    if (role !== "OWNER" && role !== "EDITOR") {
      const err = new Error("Forbidden: Viewers do not have permission to modify workflows");
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
        workspaceId: updatedWorkflow.workspaceId,
        workspace: existing.workspace,
        name: updatedWorkflow.name,
        description: updatedWorkflow.description,
        createdAt: updatedWorkflow.createdAt,
        updatedAt: updatedWorkflow.updatedAt,
        version: versionRecord.version,
        versionId: versionRecord.id,
        schemaVersion: versionRecord.schemaVersion,
        definition: versionRecord.definitionJson,
        validation,
        currentUserRole: role,
      };
    });

    // Automatically sync updated schedule if definition contains or removes trigger.cron
    defaultCronScheduler.syncWorkflowDefinition(result.id, userId, definition);

    return result;
  }

  /**
   * Deletes a workflow and all associated versions/runs.
   * Only Owners can delete workflows.
   * @param {string} userId
   * @param {string} workflowId
   */
  async deleteWorkflow(userId, workflowId) {
    const { workflow: existing, role } = await this.resolveWorkflowAccess(userId, workflowId);

    if (role !== "OWNER") {
      const err = new Error("Forbidden: Only workspace owners can delete workflows");
      err.statusCode = 403;
      throw err;
    }

    await prisma.workflow.delete({
      where: { id: workflowId },
    });

    // Unregister schedule if registered
    defaultCronScheduler.unregisterSchedule(workflowId);

    return { success: true, message: "Workflow deleted successfully" };
  }

  /**
   * Lists all immutable versions of a workflow.
   */
  async listWorkflowVersions(userId, workflowId) {
    const { workflow, role } = await this.resolveWorkflowAccess(userId, workflowId);

    const versions = await prisma.workflowVersion.findMany({
      where: { workflowId },
      orderBy: { version: "desc" },
      select: {
        id: true,
        version: true,
        schemaVersion: true,
        createdAt: true,
        definitionJson: true,
      },
    });

    return versions.map((v) => {
      const def = v.definitionJson || {};
      return {
        id: v.id,
        version: v.version,
        schemaVersion: v.schemaVersion,
        createdAt: v.createdAt,
        name: def.name || workflow.name,
        nodesCount: Array.isArray(def.nodes) ? def.nodes.length : 0,
        edgesCount: Array.isArray(def.edges) ? def.edges.length : 0,
        currentUserRole: role,
      };
    });
  }

  /**
   * Retrieves a specific version definition of a workflow.
   */
  async getWorkflowVersion(userId, workflowId, versionNumberOrId) {
    const { workflow, role } = await this.resolveWorkflowAccess(userId, workflowId);

    const isNum = !isNaN(Number(versionNumberOrId));
    const versionRecord = await prisma.workflowVersion.findFirst({
      where: {
        workflowId,
        ...(isNum ? { version: Number(versionNumberOrId) } : { id: String(versionNumberOrId) }),
      },
    });

    if (!versionRecord) {
      const err = new Error(`Workflow version '${versionNumberOrId}' not found`);
      err.statusCode = 404;
      throw err;
    }

    return {
      ...versionRecord,
      currentUserRole: role,
    };
  }

  /**
   * Restores an earlier workflow version as a new incremented version.
   * Viewers cannot restore versions.
   */
  async restoreWorkflowVersion(userId, workflowId, targetVersionNumber) {
    const { workflow, role } = await this.resolveWorkflowAccess(userId, workflowId);

    if (role !== "OWNER" && role !== "EDITOR") {
      const err = new Error("Forbidden: Viewers do not have permission to restore workflow versions");
      err.statusCode = 403;
      throw err;
    }

    const targetVersion = await prisma.workflowVersion.findUnique({
      where: {
        workflowId_version: {
          workflowId,
          version: Number(targetVersionNumber),
        },
      },
    });

    if (!targetVersion) {
      const err = new Error(`Target version ${targetVersionNumber} not found`);
      err.statusCode = 404;
      throw err;
    }

    const latest = await prisma.workflowVersion.findFirst({
      where: { workflowId },
      orderBy: { version: "desc" },
    });

    const nextVersion = (latest ? latest.version : 0) + 1;
    const definition = targetVersion.definitionJson;

    // Validate restored definition
    const validation = validateWorkflow(definition, defaultRegistry);

    const result = await prisma.$transaction(async (tx) => {
      const newVersionRecord = await tx.workflowVersion.create({
        data: {
          workflowId,
          version: nextVersion,
          schemaVersion: targetVersion.schemaVersion,
          definitionJson: definition,
        },
      });

      const updatedWorkflow = await tx.workflow.update({
        where: { id: workflowId },
        data: {
          updatedAt: new Date(),
        },
      });

      return {
        id: updatedWorkflow.id,
        name: updatedWorkflow.name,
        restoredFromVersion: targetVersion.version,
        newVersion: newVersionRecord.version,
        version: newVersionRecord.version,
        versionId: newVersionRecord.id,
        definition: newVersionRecord.definitionJson,
        validation,
        currentUserRole: role,
        workflow: {
          ...updatedWorkflow,
          version: newVersionRecord.version,
          definition: newVersionRecord.definitionJson,
        },
      };
    });

    // Sync schedule
    defaultCronScheduler.syncWorkflowDefinition(workflowId, userId, definition);

    return result;
  }

  /**
   * Validates a workflow definition against all standard rules without saving.
   * @param {Object} definition
   */
  validateDefinition(definition) {
    return validateWorkflow(definition, defaultRegistry);
  }

  /**
   * Durably initializes an execution run record in PostgreSQL in RUNNING state.
   * Useful for asynchronous triggers that acknowledge receipt immediately.
   * @param {string} userId
   * @param {string} workflowId
   * @param {Object} [options={}]
   */
  async createInitialRun(userId, workflowId, { versionId = null, triggerData = {}, triggerType = "MANUAL" } = {}) {
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

    const versionRecord = workflow.versions[0];
    if (!versionRecord) {
      const err = new Error("No saved version found for this workflow");
      err.statusCode = 400;
      throw err;
    }

    const sanitizedInput = sanitizePayload(triggerData) || {};
    return prisma.workflowRun.create({
      data: {
        workflowId: workflow.id,
        workflowVersionId: versionRecord.id,
        status: "RUNNING",
        triggerType,
        input: sanitizedInput,
        startedAt: new Date(),
      },
    });
  }

  /**
   * Executes a workflow version and records complete run and task state in PostgreSQL.
   * @param {string} userId
   * @param {string} workflowId
   * @param {Object} [options={}] - { versionId, triggerData, triggerType, triggerMetadata, existingRunId }
   */
  async executeWorkflowRun(userId, workflowId, { versionId = null, triggerData = {}, triggerType = null, triggerMetadata = {}, existingRunId = null } = {}) {
    const { workflow, role } = await this.resolveWorkflowAccess(userId, workflowId);

    if (role !== "OWNER" && role !== "EDITOR") {
      const err = new Error("Forbidden: Viewers do not have permission to execute workflows");
      err.statusCode = 403;
      throw err;
    }

    const versionRecord = versionId
      ? await prisma.workflowVersion.findFirst({ where: { workflowId, id: versionId } })
      : workflow.versions[0];
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

    // 2. Obtain or create durable WorkflowRun record in RUNNING state
    let runRecord = null;
    if (existingRunId) {
      runRecord = await prisma.workflowRun.findUnique({ where: { id: existingRunId } });
    }
    if (!runRecord) {
      runRecord = await prisma.workflowRun.create({
        data: {
          workflowId: workflow.id,
          workflowVersionId: versionRecord.id,
          status: "RUNNING",
          triggerType: resolvedTriggerType,
          input: sanitizedInput,
          startedAt: new Date(startedAt),
        },
      });
    }

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
              select: { id: true, name: true, ownerId: true, workspaceId: true },
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

    const wf = run.workflowVersion?.workflow;
    if (wf) {
      let isAuthorized = wf.ownerId === userId || userRole === "ADMIN";
      if (!isAuthorized && wf.workspaceId) {
        const wsRole = await workspaceService.getUserWorkspaceRole(userId, wf.workspaceId);
        if (wsRole) isAuthorized = true;
      }
      if (!isAuthorized) {
        const err = new Error("Forbidden: You do not have permission to view this execution run");
        err.statusCode = 403;
        throw err;
      }
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
    const { workflow } = await this.resolveWorkflowAccess(userId, workflowId);

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

    if (options.search && typeof options.search === "string" && options.search.trim()) {
      const q = options.search.trim();
      where.OR = [
        { id: { contains: q, mode: "insensitive" } },
        { workflowVersion: { workflow: { name: { contains: q, mode: "insensitive" } } } },
      ];
    }

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
