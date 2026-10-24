/**
 * Webster Execution Engine - Sequential In-Process DAG Scheduler
 */

const { createExecutionPlan } = require("../planner/execution.planner");
const { validateWorkflow } = require("../validator/workflow.validator");
const { executeNodeRuntime } = require("../runtime/node.runtime");
const { createExecutionContext, createSafeLogger } = require("../contracts/context");
const { ErrorCodes, EngineError } = require("../contracts/errors");
const { defaultRegistry } = require("../registry/node.registry");

const WorkflowRunStatus = {
  CREATED: "CREATED",
  VALIDATING: "VALIDATING",
  RUNNING: "RUNNING",
  SUCCEEDED: "SUCCEEDED",
  FAILED: "FAILED",
  CANCELLED: "CANCELLED",
};

const TaskRunStatus = {
  PENDING: "PENDING",
  READY: "READY",
  RUNNING: "RUNNING",
  SUCCEEDED: "SUCCEEDED",
  FAILED: "FAILED",
  BLOCKED: "BLOCKED",
  SKIPPED: "SKIPPED",
  CANCELLED: "CANCELLED",
};

/**
 * Finds all downstream descendant nodes in the DAG reachable from a given node.
 * @param {string} startNodeId
 * @param {Map<string, Array<string>>} adjacencyList
 * @returns {Set<string>}
 */
function findDownstreamDescendants(startNodeId, adjacencyList) {
  const descendants = new Set();
  const queue = [...(adjacencyList.get(startNodeId) || [])];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!descendants.has(current)) {
      descendants.add(current);
      const nextTargets = adjacencyList.get(current) || [];
      for (const t of nextTargets) {
        if (!descendants.has(t)) {
          queue.push(t);
        }
      }
    }
  }
  return descendants;
}

/**
 * Executes a workflow definition sequentially using the DAG scheduler.
 * @param {Object} workflow - Validated or unvalidated workflow definition
 * @param {Object} [options={}]
 * @param {string} [options.runId] - Optional run identifier (defaults to uuid)
 * @param {Object} [options.triggerData={}] - Run inputs / trigger payload
 * @param {AbortSignal} [options.abortSignal] - AbortSignal for cancellation
 * @param {Object} [options.logger] - Safe logger instance
 * @param {import('../registry/node.registry').NodeRegistry} [options.registry=defaultRegistry]
 * @param {Function} [options.onTaskStateChange] - Callback for task state persistence
 * @returns {Promise<Object>} Run Summary
 */
async function executeWorkflow(workflow, options = {}) {
  const runId = options.runId || `run_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const triggerData = options.triggerData || {};
  const registry = options.registry || defaultRegistry;
  const logger = options.logger || createSafeLogger(runId, "system");
  const abortSignal = options.abortSignal || null;
  const onTaskStateChange = typeof options.onTaskStateChange === "function" ? options.onTaskStateChange : () => {};

  const startedAt = new Date().toISOString();
  const executionTrace = [];

  // Helper to record state transitions
  const recordTrace = (nodeId, status, details = {}) => {
    executionTrace.push({
      nodeId,
      status,
      timestamp: new Date().toISOString(),
      ...details,
    });
  };

  // Step 2: Validate workflow definition before any side effects
  const validation = validateWorkflow(workflow, registry);
  if (!validation.valid) {
    const primaryError = validation.errors[0] || { code: "VALIDATION_FAILED", message: "Workflow validation failed" };
    return {
      runId,
      workflowName: (workflow && workflow.name) || "Untitled Workflow",
      schemaVersion: workflow && workflow.schemaVersion,
      status: WorkflowRunStatus.FAILED,
      finalOutput: null,
      startedAt,
      completedAt: new Date().toISOString(),
      durationMs: 0,
      tasks: {},
      executionTrace: [],
      error: {
        code: primaryError.code,
        message: primaryError.message,
        details: { allErrors: validation.errors },
      },
    };
  }

  // Step 3: Build execution plan
  const plan = createExecutionPlan(workflow, registry);

  // Initialize task records
  const tasks = {};
  const remainingDependencies = new Map();
  const nodeOutputsStore = new Map();

  for (const [nodeId, node] of plan.nodes.entries()) {
    tasks[nodeId] = {
      nodeId,
      nodeType: node.type,
      nodeName: node.name,
      status: TaskRunStatus.PENDING,
      attempts: 0,
      startedAt: null,
      completedAt: null,
      durationMs: null,
      inputs: null,
      outputs: null,
      error: null,
    };
    remainingDependencies.set(nodeId, plan.inDegree.get(nodeId));
  }

  // Step 4: Seed ready queue with entry nodes (in-degree == 0), sorted deterministically
  const readyQueue = [...plan.entryNodeIds];
  for (const entryId of readyQueue) {
    tasks[entryId].status = TaskRunStatus.READY;
    recordTrace(entryId, TaskRunStatus.READY);
    await onTaskStateChange(runId, tasks[entryId]);
  }

  let runStatus = WorkflowRunStatus.RUNNING;
  let runError = null;
  let finalOutput = null;

  // Step 5: Sequential execution loop
  while (readyQueue.length > 0) {
    // Sort deterministically so tie-breaking is predictable across runs
    readyQueue.sort();
    const currentNodeId = readyQueue.shift();
    const currentNode = plan.nodes.get(currentNodeId);
    const taskRecord = tasks[currentNodeId];

    // Check cancellation
    if (abortSignal && abortSignal.aborted) {
      runStatus = WorkflowRunStatus.CANCELLED;
      runError = {
        code: ErrorCodes.EXECUTION_CANCELLED,
        message: "Workflow run was cancelled by caller",
      };

      // Mark uncompleted tasks as CANCELLED
      for (const t of Object.values(tasks)) {
        if ([TaskRunStatus.PENDING, TaskRunStatus.READY].includes(t.status)) {
          t.status = TaskRunStatus.CANCELLED;
          recordTrace(t.nodeId, TaskRunStatus.CANCELLED);
          await onTaskStateChange(runId, t);
        }
      }
      break;
    }

    // Transition task to RUNNING
    taskRecord.status = TaskRunStatus.RUNNING;
    taskRecord.startedAt = new Date().toISOString();
    taskRecord.attempts += 1;
    recordTrace(currentNodeId, TaskRunStatus.RUNNING, { attempt: taskRecord.attempts });
    await onTaskStateChange(runId, taskRecord);

    const taskContext = createExecutionContext({
      runId,
      taskId: `${runId}_${currentNodeId}_${taskRecord.attempts}`,
      nodeId: currentNodeId,
      triggerData,
      abortSignal,
      logger,
    });

    try {
      const incomingEdges = plan.incomingEdgesByNode.get(currentNodeId) || [];
      const execResult = await executeNodeRuntime({
        node: currentNode,
        registry,
        nodeOutputsStore,
        incomingEdges,
        context: taskContext,
      });

      // Task succeeded
      taskRecord.status = TaskRunStatus.SUCCEEDED;
      taskRecord.completedAt = new Date().toISOString();
      taskRecord.durationMs = execResult.durationMs;
      taskRecord.inputs = execResult.inputs;
      taskRecord.outputs = execResult.outputs;
      nodeOutputsStore.set(currentNodeId, execResult.outputs);

      recordTrace(currentNodeId, TaskRunStatus.SUCCEEDED, { durationMs: execResult.durationMs });
      await onTaskStateChange(runId, taskRecord);

      // If this is an output.return node, capture the final return value
      if (currentNode.type === "output.return") {
        if (execResult.outputs.output !== undefined) {
          finalOutput = execResult.outputs.output;
        } else if (execResult.outputs.finalValue !== undefined) {
          finalOutput = execResult.outputs.finalValue;
        }
      }

      // Propagate readiness to downstream targets
      const outgoingTargets = plan.adjacencyList.get(currentNodeId) || [];
      for (const targetId of outgoingTargets) {
        const remaining = (remainingDependencies.get(targetId) || 1) - 1;
        remainingDependencies.set(targetId, remaining);

        if (remaining === 0 && tasks[targetId].status === TaskRunStatus.PENDING) {
          tasks[targetId].status = TaskRunStatus.READY;
          readyQueue.push(targetId);
          recordTrace(targetId, TaskRunStatus.READY);
          await onTaskStateChange(runId, tasks[targetId]);
        }
      }
    } catch (err) {
      // Task failed
      const structuredError = err.toJSON
        ? err.toJSON()
        : { code: err.code || ErrorCodes.HANDLER_EXECUTION_FAILED, message: err.message, details: err.details || {} };

      taskRecord.status = TaskRunStatus.FAILED;
      taskRecord.completedAt = new Date().toISOString();
      taskRecord.durationMs = Date.now() - new Date(taskRecord.startedAt).getTime();
      taskRecord.error = structuredError;
      if (err.resolvedInputs !== undefined) {
        taskRecord.inputs = err.resolvedInputs;
      }

      recordTrace(currentNodeId, TaskRunStatus.FAILED, { error: structuredError });
      await onTaskStateChange(runId, taskRecord);

      // Fail-fast policy: mark all reachable downstream nodes as BLOCKED
      const descendants = findDownstreamDescendants(currentNodeId, plan.adjacencyList);
      for (const descId of descendants) {
        if ([TaskRunStatus.PENDING, TaskRunStatus.READY].includes(tasks[descId].status)) {
          tasks[descId].status = TaskRunStatus.BLOCKED;
          recordTrace(descId, TaskRunStatus.BLOCKED, { blockedBy: currentNodeId });
          await onTaskStateChange(runId, tasks[descId]);
        }
      }

      runStatus = WorkflowRunStatus.FAILED;
      runError = {
        code: structuredError.code,
        message: `Task '${currentNodeId}' failed: ${structuredError.message}`,
        failedNodeId: currentNodeId,
        details: structuredError.details,
      };

      break; // Terminate sequential loop on failure
    }
  }

  // Step 7: Final state reconciliation & Deadlock check
  if (runStatus === WorkflowRunStatus.RUNNING) {
    const unfinishedNodes = Object.values(tasks).filter((t) =>
      [TaskRunStatus.PENDING, TaskRunStatus.READY].includes(t.status)
    );

    if (unfinishedNodes.length > 0) {
      // Deadlock detected
      runStatus = WorkflowRunStatus.FAILED;
      runError = {
        code: ErrorCodes.DEADLOCK_DETECTED,
        message: `Execution stalled: ${unfinishedNodes.length} task(s) remain pending but ready queue is exhausted`,
        unfinishedNodeIds: unfinishedNodes.map((t) => t.nodeId),
      };

      for (const unfinished of unfinishedNodes) {
        unfinished.status = TaskRunStatus.BLOCKED;
        recordTrace(unfinished.nodeId, TaskRunStatus.BLOCKED, { reason: "deadlock" });
        await onTaskStateChange(runId, unfinished);
      }
    } else {
      // All runnable tasks finished successfully
      runStatus = WorkflowRunStatus.SUCCEEDED;

      // If no output.return node explicitly captured finalOutput, capture terminal nodes' outputs
      if (finalOutput === null && !plan.hasReturnNode) {
        const terminalOutputs = {};
        for (const termId of plan.terminalNodeIds) {
          terminalOutputs[termId] = nodeOutputsStore.get(termId);
        }
        finalOutput = terminalOutputs;
      }
    }
  }

  const completedAt = new Date().toISOString();
  const durationMs = new Date(completedAt).getTime() - new Date(startedAt).getTime();

  return {
    runId,
    workflowName: workflow.name || "Untitled Workflow",
    schemaVersion: workflow.schemaVersion,
    status: runStatus,
    finalOutput,
    startedAt,
    completedAt,
    durationMs,
    tasks,
    executionTrace,
    error: runError,
  };
}

module.exports = {
  WorkflowRunStatus,
  TaskRunStatus,
  executeWorkflow,
  findDownstreamDescendants,
};
