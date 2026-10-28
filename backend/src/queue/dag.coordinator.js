/**
 * Dormammu Engine - Distributed DAG Execution Coordinator
 * Reuses core planner, validation, branching, skipped propagation, and merge semantics
 * to coordinate asynchronous, distributed worker task executions.
 */

const prisma = require("../config/db");
const { createExecutionPlan } = require("../engine/planner/execution.planner");
const { findDownstreamDescendants } = require("../engine/scheduler/dag.scheduler");
const { defaultRegistry } = require("../engine/registry/node.registry");
const { getRetryPolicy } = require("./retry.policy");
const { enqueueBulkTaskJobs, enqueueTaskJob } = require("./queue.producer");
const { defaultSseService } = require("../services/sse.service");
const { sanitizePayload } = require("../utils/payload.sanitizer");

// Bounded in-memory plan cache keyed by immutable workflowVersionId
const planCache = new Map();
const MAX_PLAN_CACHE_SIZE = 200;

/**
 * Retrieves or builds an immutable execution plan for a workflow version.
 * @param {string} workflowVersionId
 * @param {Object} definition
 * @returns {Object} Execution Plan
 */
function getExecutionPlan(workflowVersionId, definition) {
  if (workflowVersionId && planCache.has(workflowVersionId)) {
    return planCache.get(workflowVersionId);
  }

  if (!definition) {
    return null;
  }

  const plan = createExecutionPlan(definition, defaultRegistry);

  if (workflowVersionId) {
    if (planCache.size >= MAX_PLAN_CACHE_SIZE) {
      const firstKey = planCache.keys().next().value;
      planCache.delete(firstKey);
    }
    planCache.set(workflowVersionId, plan);
  }

  return plan;
}

/**
 * Extracts delay duration in milliseconds from a node configuration.
 * @param {Object} node
 * @returns {number}
 */
function extractNodeDelayMs(node) {
  if (node?.type !== "flow.delay") return 0;
  const config = node.config || {};
  if (config.durationMs !== undefined) {
    return Math.max(0, Number(config.durationMs) || 0);
  }
  if (config.duration !== undefined) {
    const unit = (config.unit || "milliseconds").toLowerCase();
    const mult = unit.startsWith("sec") ? 1000 : unit.startsWith("min") ? 60000 : 1;
    return Math.max(0, (Number(config.duration) || 0) * mult);
  }
  return 0;
}

/**
 * Builds the complete standalone execution report from database state.
 */
function assembleRunReport({
  run,
  workflow,
  versionRecord,
  definition,
  tasks,
  status,
  startedAt,
  completedAt,
  durationMs,
  finalOutput,
  error,
}) {
  const nodes = tasks.map((t) => ({
    id: t.nodeId,
    nodeId: t.nodeId,
    nodeType: t.nodeType || null,
    nodeName: t.nodeName || t.nodeId,
    status: t.status,
    attempts: t.attempts || 1,
    input: sanitizePayload(t.input),
    output: sanitizePayload(t.output),
    startedAt: t.startedAt ? t.startedAt.toISOString() : null,
    completedAt: t.finishedAt ? t.finishedAt.toISOString() : null,
    durationMs: t.durationMs !== undefined ? t.durationMs : null,
    error: t.error || null,
    logs: [],
  }));

  return {
    schemaVersion: 1,
    runId: run.id,
    workflow: {
      id: workflow ? workflow.id : run.workflowId,
      name: workflow ? workflow.name : "Workflow",
      version: versionRecord ? versionRecord.version : 1,
      definition,
    },
    trigger: {
      type: run.triggerType || "MANUAL",
      metadata: {},
    },
    input: sanitizePayload(run.input),
    execution: {
      status,
      startedAt: startedAt ? (startedAt.toISOString ? startedAt.toISOString() : startedAt) : null,
      completedAt: completedAt ? (completedAt.toISOString ? completedAt.toISOString() : completedAt) : null,
      durationMs,
    },
    nodes,
    events: [],
    finalOutput: sanitizePayload(finalOutput),
    error: error || null,
  };
}

class DistributedDagCoordinator {
  /**
   * Initializes durable run state: creates TaskExecution records and enqueues initial ready tasks.
   * @param {Object} options
   * @param {Object} options.run - WorkflowRun Prisma record
   * @param {Object} options.workflow - Workflow Prisma record
   * @param {Object} options.versionRecord - WorkflowVersion Prisma record
   * @param {Object} options.definition - Workflow definition JSON
   * @param {any} [options.triggerData={}]
   * @param {import('@prisma/client').PrismaClient} [options.tx]
   */
  async initializeRun({ run, workflow, versionRecord, definition, triggerData = {}, tx = null }) {
    const client = tx || prisma;
    const plan = getExecutionPlan(versionRecord.id, definition);

    const taskCreateData = [];
    for (const [nodeId, node] of plan.nodes.entries()) {
      const isEntry = plan.entryNodeIds.includes(nodeId);
      const retryPolicy = getRetryPolicy(node);

      taskCreateData.push({
        id: `${run.id}_${nodeId}`,
        runId: run.id,
        nodeId,
        nodeType: node.type,
        nodeName: node.name || nodeId,
        status: isEntry ? "READY" : "PENDING",
        attempts: 0,
        maxAttempts: retryPolicy.maxAttempts,
        input: isEntry ? sanitizePayload(triggerData) : null,
      });
    }

    // Insert task execution records atomically
    await client.taskExecution.createMany({
      data: taskCreateData,
      skipDuplicates: true,
    });

    // Emit workflow started event
    defaultSseService.emitRunEvent(run.id, "workflow:started", {
      runId: run.id,
      workflowId: workflow.id,
      workflowName: workflow.name,
      status: "RUNNING",
      startedAt: run.startedAt ? run.startedAt.toISOString() : new Date().toISOString(),
    });

    // Enqueue entry nodes to BullMQ (respect native BullMQ delay for flow.delay)
    const readyEntries = taskCreateData.filter((t) => t.status === "READY");
    const enqueueList = readyEntries.map((t) => {
      const node = plan.nodes.get(t.nodeId);
      const delay = extractNodeDelayMs(node);
      return {
        runId: run.id,
        workflowId: workflow.id,
        workflowVersionId: versionRecord.id,
        nodeId: t.nodeId,
        taskExecutionId: t.id,
        attempt: 1,
        delay,
      };
    });

    await enqueueBulkTaskJobs(enqueueList);

    for (const t of readyEntries) {
      defaultSseService.emitRunEvent(run.id, "task:ready", {
        runId: run.id,
        nodeId: t.nodeId,
        nodeName: t.nodeName,
        status: "READY",
      });
    }

    return { runId: run.id, readyCount: readyEntries.length, taskCreateData };
  }

  /**
   * Called by a worker when a task successfully completes.
   * Evaluates downstream dependencies and enqueues newly eligible tasks or finalizes the run.
   * @param {Object} options
   * @param {string} options.runId
   * @param {string} options.nodeId
   * @param {Object} options.outputs
   */
  async onTaskCompleted({ runId, nodeId, outputs }) {
    // 1. Fetch run with workflow version
    const run = await prisma.workflowRun.findUnique({
      where: { id: runId },
      include: {
        workflowVersion: {
          include: {
            workflow: true,
          },
        },
      },
    });

    if (!run || ["SUCCEEDED", "FAILED", "CANCELLED"].includes(run.status)) {
      return; // Run already reached terminal state
    }

    const versionRecord = run.workflowVersion;
    const definition = versionRecord.definitionJson;
    const plan = getExecutionPlan(versionRecord.id, definition);

    // 2. Fetch all current task executions for this run in one targeted select (lightweight columns)
    const allTasks = await prisma.taskExecution.findMany({
      where: { runId },
      select: {
        id: true,
        nodeId: true,
        nodeType: true,
        nodeName: true,
        status: true,
        output: true,
      },
    });

    const tasksMap = new Map();
    const nodeOutputsStore = new Map();
    for (const t of allTasks) {
      tasksMap.set(t.nodeId, t);
      if (t.output !== null && t.output !== undefined) {
        nodeOutputsStore.set(t.nodeId, t.output);
      }
    }
    // Ensure currently completed task outputs are present
    nodeOutputsStore.set(nodeId, outputs);

    // 3. Compute edge states
    // An edge is ACTIVE if source is SUCCEEDED and source emitted the sourcePort (or default output/result)
    // An edge is SKIPPED if source is SKIPPED, or source is SUCCEEDED but did not emit the sourcePort
    // An edge is PENDING if source is PENDING, READY, or RUNNING
    const edgeStates = new Map();
    for (const edge of plan.edges) {
      const sourceTask = tasksMap.get(edge.source);
      if (!sourceTask || ["PENDING", "READY", "RUNNING"].includes(sourceTask.status)) {
        edgeStates.set(edge.id, "PENDING");
      } else if (sourceTask.status === "SKIPPED" || sourceTask.status === "BLOCKED" || sourceTask.status === "FAILED") {
        edgeStates.set(edge.id, "SKIPPED");
      } else if (sourceTask.status === "SUCCEEDED") {
        const sourceOutputs = nodeOutputsStore.get(edge.source) || {};
        const hasPort =
          sourceOutputs[edge.sourcePort] !== undefined ||
          (edge.sourcePort === "output" && sourceOutputs["result"] !== undefined) ||
          (edge.sourcePort === "result" && sourceOutputs["output"] !== undefined);

        edgeStates.set(edge.id, hasPort ? "ACTIVE" : "SKIPPED");
      }
    }

    const newlyReadyNodeIds = [];
    const newlySkippedNodeIds = [];

    // Helper to evaluate target readiness recursively
    const evaluateTarget = (targetId) => {
      const targetTask = tasksMap.get(targetId);
      if (!targetTask || targetTask.status !== "PENDING") return;

      const inEdges = plan.incomingEdgesByNode.get(targetId) || [];
      const isAllInEdgesResolved = inEdges.every((e) => edgeStates.get(e.id) !== "PENDING");
      if (!isAllInEdgesResolved) return; // Wait for upstream dependencies to resolve

      const targetNode = plan.nodes.get(targetId);
      const activeInEdges = inEdges.filter((e) => edgeStates.get(e.id) === "ACTIVE");
      const skippedInEdges = inEdges.filter((e) => edgeStates.get(e.id) === "SKIPPED");

      if (targetNode.type === "flow.merge") {
        // flow.merge executes if at least one branch is active; skips only if ALL branches were skipped
        if (activeInEdges.length > 0) {
          targetTask.status = "READY";
          newlyReadyNodeIds.push(targetId);
        } else {
          markNodeSkipped(targetId, "all_branches_skipped");
        }
      } else {
        // Ordinary node: if ANY incoming branch was skipped, node is skipped
        if (skippedInEdges.length > 0) {
          markNodeSkipped(targetId, "inactive_branch");
        } else {
          targetTask.status = "READY";
          newlyReadyNodeIds.push(targetId);
        }
      }
    };

    const markNodeSkipped = (skipNodeId, reason) => {
      const task = tasksMap.get(skipNodeId);
      if (!task || task.status === "SKIPPED") return;

      task.status = "SKIPPED";
      task.finishedAt = new Date();
      task.durationMs = 0;
      newlySkippedNodeIds.push(skipNodeId);

      // All outgoing edges from skipped node become SKIPPED
      const outgoing = plan.outgoingEdgesByNode.get(skipNodeId) || [];
      for (const outEdge of outgoing) {
        edgeStates.set(outEdge.id, "SKIPPED");
        evaluateTarget(outEdge.target);
      }
    };

    // Evaluate outgoing edges from the node that just completed
    const directOutgoing = plan.outgoingEdgesByNode.get(nodeId) || [];
    for (const outEdge of directOutgoing) {
      evaluateTarget(outEdge.target);
    }

    // 4. Persist newly skipped tasks
    if (newlySkippedNodeIds.length > 0) {
      await prisma.taskExecution.updateMany({
        where: {
          runId,
          nodeId: { in: newlySkippedNodeIds },
        },
        data: {
          status: "SKIPPED",
          finishedAt: new Date(),
          durationMs: 0,
        },
      });

      for (const skippedId of newlySkippedNodeIds) {
        defaultSseService.emitRunEvent(runId, "task:skipped", {
          runId,
          nodeId: skippedId,
          status: "SKIPPED",
        });
      }
    }

    // 5. Persist and enqueue newly ready tasks
    if (newlyReadyNodeIds.length > 0) {
      await prisma.taskExecution.updateMany({
        where: {
          runId,
          nodeId: { in: newlyReadyNodeIds },
        },
        data: {
          status: "READY",
        },
      });

      const tasksToEnqueue = newlyReadyNodeIds.map((rId) => {
        const taskRec = tasksMap.get(rId);
        const node = plan.nodes.get(rId);
        const delay = extractNodeDelayMs(node);
        return {
          runId,
          workflowId: run.workflowVersion?.workflow?.id || run.workflowId,
          workflowVersionId: versionRecord.id,
          nodeId: rId,
          taskExecutionId: taskRec.id,
          attempt: 1,
          delay,
        };
      });

      await enqueueBulkTaskJobs(tasksToEnqueue);

      for (const rId of newlyReadyNodeIds) {
        const tRec = tasksMap.get(rId);
        defaultSseService.emitRunEvent(runId, "task:ready", {
          runId,
          nodeId: rId,
          nodeName: tRec?.nodeName || rId,
          status: "READY",
        });
      }
    }

    // 6. Check for Workflow Completion
    const updatedTasks = Array.from(tasksMap.values());
    const unfinishedTasks = updatedTasks.filter((t) =>
      ["PENDING", "READY", "RUNNING"].includes(t.status)
    );

    if (unfinishedTasks.length === 0) {
      // All tasks reached terminal state!
      await this.finalizeWorkflowRun(run, plan, versionRecord, updatedTasks);
    }
  }

  /**
   * Called by a worker when a task permanently fails (retries exhausted or non-retryable error).
   * Marks downstream descendants as BLOCKED and finalizes the WorkflowRun as FAILED.
   * @param {Object} options
   * @param {string} options.runId
   * @param {string} options.nodeId
   * @param {Object} options.error
   */
  async onTaskFailed({ runId, nodeId, error }) {
    const run = await prisma.workflowRun.findUnique({
      where: { id: runId },
      include: {
        workflowVersion: {
          include: {
            workflow: true,
          },
        },
      },
    });

    if (!run || ["SUCCEEDED", "FAILED", "CANCELLED"].includes(run.status)) {
      return;
    }

    const versionRecord = run.workflowVersion;
    const definition = versionRecord.definitionJson;
    const plan = getExecutionPlan(versionRecord.id, definition);

    // Fail-fast: find all reachable downstream descendants and mark them BLOCKED
    const descendants = findDownstreamDescendants(nodeId, plan.adjacencyList);
    const blockedNodeIds = Array.from(descendants);

    if (blockedNodeIds.length > 0) {
      await prisma.taskExecution.updateMany({
        where: {
          runId,
          nodeId: { in: blockedNodeIds },
          status: { in: ["PENDING", "READY"] },
        },
        data: {
          status: "BLOCKED",
          finishedAt: new Date(),
          durationMs: 0,
        },
      });

      for (const bId of blockedNodeIds) {
        defaultSseService.emitRunEvent(runId, "task:blocked", {
          runId,
          nodeId: bId,
          status: "BLOCKED",
          blockedBy: nodeId,
        });
      }
    }

    // Fetch all tasks for final report
    const allTasks = await prisma.taskExecution.findMany({
      where: { runId },
    });

    const completedAt = new Date();
    const startedAt = run.startedAt ? new Date(run.startedAt) : completedAt;
    const durationMs = Math.max(0, completedAt.getTime() - startedAt.getTime());

    const structuredError = {
      code: error.code || "TASK_EXECUTION_FAILED",
      message: `Task '${nodeId}' failed: ${error.message || String(error)}`,
      failedNodeId: nodeId,
      details: error.details || {},
    };

    const report = assembleRunReport({
      run,
      workflow: run.workflowVersion?.workflow,
      versionRecord,
      definition,
      tasks: allTasks,
      status: "FAILED",
      startedAt,
      completedAt,
      durationMs,
      finalOutput: null,
      error: structuredError,
    });

    await prisma.workflowRun.update({
      where: { id: runId },
      data: {
        status: "FAILED",
        error: structuredError,
        durationMs,
        finishedAt: completedAt,
        report,
      },
    });

    defaultSseService.emitRunEvent(runId, "workflow:completed", {
      runId,
      workflowId: run.workflowId,
      status: "FAILED",
      finalOutput: null,
      error: structuredError,
      durationMs,
      startedAt: startedAt.toISOString(),
      completedAt: completedAt.toISOString(),
    });
  }

  /**
   * Finalizes a successfully completed WorkflowRun.
   * @param {Object} run
   * @param {Object} plan
   * @param {Object} versionRecord
   * @param {Array<Object>} tasks
   */
  async finalizeWorkflowRun(run, plan, versionRecord, tasks) {
    const completedAt = new Date();
    const startedAt = run.startedAt ? new Date(run.startedAt) : completedAt;
    const durationMs = Math.max(0, completedAt.getTime() - startedAt.getTime());

    // Resolve final output: check if output.return node succeeded
    let finalOutput = null;
    const returnTask = tasks.find((t) => t.nodeType === "output.return" && t.status === "SUCCEEDED");
    if (returnTask && returnTask.output) {
      if (returnTask.output.output !== undefined) {
        finalOutput = returnTask.output.output;
      } else if (returnTask.output.finalValue !== undefined) {
        finalOutput = returnTask.output.finalValue;
      } else {
        finalOutput = returnTask.output;
      }
    }

    // Fallback: collect outputs of succeeded terminal nodes
    if (finalOutput === null) {
      const terminalOutputs = {};
      for (const termId of plan.terminalNodeIds) {
        const t = tasks.find((task) => task.nodeId === termId);
        if (t && t.status === "SUCCEEDED" && t.output !== null) {
          terminalOutputs[termId] = t.output;
        }
      }
      finalOutput = Object.keys(terminalOutputs).length > 0 ? terminalOutputs : null;
    }

    const report = assembleRunReport({
      run,
      workflow: run.workflowVersion?.workflow,
      versionRecord,
      definition: versionRecord.definitionJson,
      tasks,
      status: "SUCCEEDED",
      startedAt,
      completedAt,
      durationMs,
      finalOutput,
      error: null,
    });

    await prisma.workflowRun.update({
      where: { id: run.id },
      data: {
        status: "SUCCEEDED",
        output: finalOutput !== undefined ? finalOutput : null,
        durationMs,
        finishedAt: completedAt,
        report,
      },
    });

    defaultSseService.emitRunEvent(run.id, "workflow:completed", {
      runId: run.id,
      workflowId: run.workflowId,
      status: "SUCCEEDED",
      finalOutput,
      durationMs,
      startedAt: startedAt.toISOString(),
      completedAt: completedAt.toISOString(),
      error: null,
    });
  }
}

const defaultDagCoordinator = new DistributedDagCoordinator();

module.exports = {
  DistributedDagCoordinator,
  defaultDagCoordinator,
  getExecutionPlan,
  assembleRunReport,
};
