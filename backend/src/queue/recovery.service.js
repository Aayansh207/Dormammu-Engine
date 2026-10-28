/**
 * Dormammu Engine - Crash Recovery & State Reconciliation Service
 * Detects orphaned tasks, expired worker leases, stalled jobs, and unfinalized runs.
 */

const prisma = require("../config/db");
const { defaultDagCoordinator, getExecutionPlan } = require("./dag.coordinator");
const { enqueueTaskJob } = require("./queue.producer");

class RecoveryService {
  constructor() {
    this._reconcileInterval = null;
    this._isReconciling = false;
  }

  /**
   * Reconciles a single active WorkflowRun.
   * Checks for expired leases, unqueued ready tasks, or terminal completion.
   * @param {string} runId
   * @returns {Promise<Object>} Reconciliation summary
   */
  async reconcileRun(runId) {
    const run = await prisma.workflowRun.findUnique({
      where: { id: runId },
      include: {
        workflowVersion: {
          include: {
            workflow: true,
          },
        },
        tasks: true,
      },
    });

    if (!run || ["SUCCEEDED", "FAILED", "CANCELLED"].includes(run.status)) {
      return { status: run?.status || "NOT_FOUND", reconciled: false };
    }

    const now = new Date();
    const versionRecord = run.workflowVersion;
    const definition = versionRecord.definitionJson;
    const plan = getExecutionPlan(versionRecord.id, definition);

    let recoveredTasksCount = 0;

    // 1. Recover expired leases: tasks marked RUNNING whose claim has expired
    const expiredClaimTasks = run.tasks.filter(
      (t) => t.status === "RUNNING" && t.claimExpiresAt && new Date(t.claimExpiresAt) < now
    );

    for (const t of expiredClaimTasks) {
      await prisma.taskExecution.update({
        where: { id: t.id },
        data: {
          status: "READY",
          claimedBy: null,
          claimExpiresAt: null,
        },
      });

      await enqueueTaskJob({
        runId: run.id,
        workflowId: run.workflowVersion?.workflow?.id || run.workflowId,
        workflowVersionId: versionRecord.id,
        nodeId: t.nodeId,
        taskExecutionId: t.id,
        attempt: (t.attempts || 0) + 1,
      });

      recoveredTasksCount++;
    }

    // 2. Re-enqueue stranded tasks in READY state (only those untouched for at least 10s grace period)
    const readyGraceThreshold = new Date(Date.now() - 10000);
    const readyTasks = run.tasks.filter((t) => t.status === "READY" && (!t.updatedAt || new Date(t.updatedAt) < readyGraceThreshold));
    for (const t of readyTasks) {
      await enqueueTaskJob({
        runId: run.id,
        workflowId: run.workflowVersion?.workflow?.id || run.workflowId,
        workflowVersionId: versionRecord.id,
        nodeId: t.nodeId,
        taskExecutionId: t.id,
        attempt: (t.attempts || 0) + 1,
      });
      recoveredTasksCount++;
    }

    // 3. Check if all tasks have resolved to terminal states
    const refreshedTasks = await prisma.taskExecution.findMany({
      where: { runId: run.id },
    });

    const unfinished = refreshedTasks.filter((t) =>
      ["PENDING", "READY", "RUNNING"].includes(t.status)
    );

    if (unfinished.length === 0) {
      // Check if any failed
      const hasFailed = refreshedTasks.some((t) => t.status === "FAILED");
      if (hasFailed) {
        const failedTask = refreshedTasks.find((t) => t.status === "FAILED");
        await defaultDagCoordinator.onTaskFailed({
          runId: run.id,
          nodeId: failedTask ? failedTask.nodeId : "unknown",
          error: failedTask ? (failedTask.error || { message: "Task execution failed" }) : { message: "Failure detected" },
        });
      } else {
        await defaultDagCoordinator.finalizeWorkflowRun(run, plan, versionRecord, refreshedTasks);
      }
      return { status: "FINALIZED", recoveredTasksCount };
    }

    return { status: "RUNNING", recoveredTasksCount, unfinishedCount: unfinished.length };
  }

  /**
   * Scans all RUNNING runs in PostgreSQL and reconciles active states.
   * @returns {Promise<{ checkedRuns: number, reconciledRuns: number }>}
   */
  async reconcileAllActiveRuns() {
    if (this._isReconciling) return { checkedRuns: 0, reconciledRuns: 0 };
    this._isReconciling = true;

    try {
      const activeRuns = await prisma.workflowRun.findMany({
        where: { status: "RUNNING" },
        select: { id: true },
        take: 50,
      });

      let reconciledRuns = 0;
      for (const run of activeRuns) {
        try {
          const res = await this.reconcileRun(run.id);
          if (res.recoveredTasksCount > 0 || res.status === "FINALIZED") {
            reconciledRuns++;
          }
        } catch (err) {
          console.warn(`[RecoveryService] Error reconciling run '${run.id}':`, err.message);
        }
      }

      return { checkedRuns: activeRuns.length, reconciledRuns };
    } finally {
      this._isReconciling = false;
    }
  }

  /**
   * Starts periodic background reconciliation loop.
   * @param {number} [intervalMs=15000]
   */
  startReconciler(intervalMs = 15000) {
    if (this._reconcileInterval) return;
    this._reconcileInterval = setInterval(() => {
      this.reconcileAllActiveRuns().catch((err) => {
        console.warn(`[RecoveryService] Reconciler error: ${err.message}`);
      });
    }, intervalMs);
    if (this._reconcileInterval.unref) {
      this._reconcileInterval.unref();
    }
  }

  /**
   * Stops periodic reconciler.
   */
  stopReconciler() {
    if (this._reconcileInterval) {
      clearInterval(this._reconcileInterval);
      this._reconcileInterval = null;
    }
  }
}

const defaultRecoveryService = new RecoveryService();

module.exports = {
  RecoveryService,
  defaultRecoveryService,
};
