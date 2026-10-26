/**
 * Webster Execution Engine - Backfill Execution Reports Migration Script
 * Assembles durable, self-contained reports for all legacy WorkflowRun records
 * from historical TaskRun data and updates WorkflowRun atomically.
 */

const prisma = require("../config/db");

async function backfillReports() {
  console.log("=== Starting Backfill Execution Reports ===");

  const allRuns = await prisma.workflowRun.findMany({
    include: {
      workflowVersion: {
        select: {
          workflowId: true,
          version: true,
          definitionJson: true,
          workflow: {
            select: { id: true, name: true },
          },
        },
      },
      taskRuns: {
        orderBy: { startedAt: "asc" },
      },
    },
  });

  const runs = allRuns.filter((r) => !r.report || !r.workflowId);

  console.log(`Found ${runs.length} runs requiring report / metadata backfill.`);

  let updatedCount = 0;
  for (const run of runs) {
    const workflowId = run.workflowId || run.workflowVersion?.workflowId || null;
    const workflowName = run.workflowVersion?.workflow?.name || "Workflow";
    const versionNumber = run.workflowVersion?.version || 1;
    const definition = run.workflowVersion?.definitionJson || {};

    const triggerType = run.triggerType !== "MANUAL"
      ? run.triggerType
      : (run.input?.$triggerType || (run.input?.$webhook ? "WEBHOOK" : (run.input?.$cron ? "CRON" : "MANUAL")));

    const durationMs = run.durationMs !== null && run.durationMs !== undefined
      ? run.durationMs
      : (run.finishedAt && run.startedAt
          ? Math.max(0, new Date(run.finishedAt).getTime() - new Date(run.startedAt).getTime())
          : 0);

    // Map definition nodes to node types/names for enrichment
    const defNodes = Array.isArray(definition.nodes) ? definition.nodes : [];
    const nodeMap = new Map();
    for (const n of defNodes) {
      if (n.id) nodeMap.set(n.id, n);
    }

    const nodes = (run.taskRuns || []).map((tr) => {
      const defNode = nodeMap.get(tr.nodeId);
      const taskDuration = tr.finishedAt && tr.startedAt
        ? Math.max(0, new Date(tr.finishedAt).getTime() - new Date(tr.startedAt).getTime())
        : 0;

      return {
        nodeId: tr.nodeId,
        nodeType: defNode?.type || null,
        nodeName: defNode?.name || tr.nodeId,
        status: tr.status,
        attempts: tr.attempts || 1,
        input: tr.input,
        output: tr.output,
        startedAt: tr.startedAt ? tr.startedAt.toISOString() : null,
        completedAt: tr.finishedAt ? tr.finishedAt.toISOString() : null,
        durationMs: taskDuration,
        error: tr.error || null,
        logs: [],
      };
    });

    const report = {
      schemaVersion: 1,
      isLegacyBackfill: true,
      runId: run.id,
      workflow: {
        id: workflowId,
        name: workflowName,
        version: versionNumber,
        definition,
      },
      trigger: {
        type: triggerType,
        metadata: {},
      },
      input: run.input || {},
      execution: {
        status: run.status,
        startedAt: run.startedAt ? run.startedAt.toISOString() : null,
        completedAt: run.finishedAt ? run.finishedAt.toISOString() : null,
        durationMs,
      },
      nodes,
      events: [],
      finalOutput: run.output,
      error: run.error || null,
    };

    await prisma.workflowRun.update({
      where: { id: run.id },
      data: {
        workflowId,
        triggerType,
        durationMs,
        report,
      },
    });

    updatedCount++;
    console.log(`  ✓ Backfilled run ${run.id} (${run.status}, ${nodes.length} nodes)`);
  }

  console.log(`\nSuccessfully backfilled ${updatedCount} historical runs with durable reports!`);
}

if (require.main === module) {
  backfillReports()
    .then(() => {
      console.log("=== Backfill Complete ===");
      process.exit(0);
    })
    .catch((err) => {
      console.error("Backfill failed:", err);
      process.exit(1);
    });
}

module.exports = { backfillReports };
