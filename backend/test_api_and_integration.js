/**
 * Webster Execution Engine - Database Persistence, Versioning, and API Integration Test Suite
 */

const assert = require("assert");
const prisma = require("./src/config/db");
const nodeService = require("./src/services/node.service");
const workflowService = require("./src/services/workflow.service");
const webhookController = require("./src/controllers/webhook.controller");
const { defaultRegistry } = require("./src/engine/registry/node.registry");

process.env.ALLOW_OFFLINE_MOCK = "true";

let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
    failed++;
  }
}

async function runApiAndIntegrationTests() {
  console.log("\n=======================================================");
  console.log(" Webster Persistence, Versioning & API Integration Suite");
  console.log("=======================================================\n");

  const testUserAId = `test_user_a_${Date.now()}`;
  const testUserBId = `test_user_b_${Date.now()}`;

  try {
    // Setup test users in PostgreSQL
    await prisma.user.create({
      data: {
        id: testUserAId,
        email: `${testUserAId}@example.com`,
        name: "Test User A",
        role: "USER",
      },
    });

    await prisma.user.create({
      data: {
        id: testUserBId,
        email: `${testUserBId}@example.com`,
        name: "Test User B",
        role: "USER",
      },
    });

    console.log("--- 1. Node Metadata PostgreSQL Persistence ---");

    await test(`PostgreSQL: seedNodeDefinitions upserts all ${defaultRegistry.list().length} nodes into database`, async () => {
      const seedResult = await nodeService.seedNodeDefinitions();
      const totalRegistered = defaultRegistry.list().length;
      assert.strictEqual(seedResult.total, totalRegistered);
      assert.strictEqual(seedResult.upserted, totalRegistered);

      const dbNodes = await prisma.nodeDefinition.findMany();
      assert.ok(dbNodes.length >= totalRegistered);
    });

    await test("PostgreSQL: repeated seeding is idempotent and does not create duplicates", async () => {
      const totalRegistered = defaultRegistry.list().length;
      const beforeCount = await prisma.nodeDefinition.count();
      const seedResult = await nodeService.seedNodeDefinitions();
      const afterCount = await prisma.nodeDefinition.count();

      assert.strictEqual(beforeCount, afterCount);
      assert.strictEqual(seedResult.upserted, totalRegistered);
    });

    await test("PostgreSQL: listNodes and getNodeMetadata return accurate metadata with handler status", async () => {
      const nodes = await nodeService.listNodes();
      assert.ok(nodes.length >= defaultRegistry.list().length);
      assert.ok(nodes.every((n) => n.hasExecutableHandler === true));

      const multiplyMeta = await nodeService.getNodeMetadata("math.multiply");
      assert.ok(multiplyMeta);
      assert.strictEqual(multiplyMeta.type, "math.multiply");
      assert.strictEqual(multiplyMeta.category, "mathematical");
      assert.strictEqual(multiplyMeta.hasExecutableHandler, true);
    });

    console.log("\n--- 2. Workflow Persistence, Versioning & Authorization ---");

    let createdWorkflowId;

    await test("Workflow: creates workflow and immutable version 1 in PostgreSQL", async () => {
      const def = {
        schemaVersion: 1,
        name: "Test Workflow Persistence",
        nodes: [
          { id: "n1", type: "trigger.manual", version: 1, config: {} },
          { id: "n2", type: "math.multiply", version: 1, config: { factor: 4 } },
          { id: "n3", type: "output.return", version: 1, config: {} },
        ],
        edges: [
          { id: "e1", source: "n1", sourcePort: "output", target: "n2", targetPort: "input" },
          { id: "e2", source: "n2", sourcePort: "output", target: "n3", targetPort: "input" },
        ],
      };

      const wf = await workflowService.createWorkflow(testUserAId, {
        name: "Test Workflow Persistence",
        description: "Test description",
        definition: def,
      });

      assert.ok(wf.id);
      assert.strictEqual(wf.ownerId, testUserAId);
      assert.strictEqual(wf.currentVersion, 1);
      assert.strictEqual(wf.validation.valid, true);

      createdWorkflowId = wf.id;

      // Verify in DB directly
      const versions = await prisma.workflowVersion.findMany({ where: { workflowId: wf.id } });
      assert.strictEqual(versions.length, 1);
      assert.strictEqual(versions[0].version, 1);
    });

    await test("Workflow: user can view their own workflow", async () => {
      const wf = await workflowService.getWorkflowById(testUserAId, createdWorkflowId);
      assert.strictEqual(wf.id, createdWorkflowId);
      assert.strictEqual(wf.version, 1);
    });

    await test("Authorization: other users are rejected with 403 Forbidden", async () => {
      await assert.rejects(
        async () => workflowService.getWorkflowById(testUserBId, createdWorkflowId),
        (err) => err.statusCode === 403
      );
    });

    await test("Workflow Versioning: updates create immutable version 2, leaving version 1 intact", async () => {
      const updatedDef = {
        schemaVersion: 1,
        name: "Updated Workflow v2",
        nodes: [
          { id: "n1", type: "trigger.manual", version: 1, config: {} },
          { id: "n2", type: "math.multiply", version: 1, config: { factor: 10 } },
          { id: "n3", type: "output.return", version: 1, config: {} },
        ],
        edges: [
          { id: "e1", source: "n1", sourcePort: "output", target: "n2", targetPort: "input" },
          { id: "e2", source: "n2", sourcePort: "output", target: "n3", targetPort: "input" },
        ],
      };

      const updated = await workflowService.updateWorkflow(testUserAId, createdWorkflowId, {
        name: "Updated Workflow v2",
        definition: updatedDef,
      });

      assert.strictEqual(updated.version, 2);

      // Verify database contains both version 1 and version 2
      const allVersions = await prisma.workflowVersion.findMany({
        where: { workflowId: createdWorkflowId },
        orderBy: { version: "asc" },
      });

      assert.strictEqual(allVersions.length, 2);
      assert.strictEqual(allVersions[0].version, 1);
      assert.strictEqual(allVersions[1].version, 2);
      assert.strictEqual(allVersions[0].definitionJson.nodes[1].config.factor, 4);
      assert.strictEqual(allVersions[1].definitionJson.nodes[1].config.factor, 10);
    });

    console.log("\n--- 3. Full Execution & Durable State Persistence ---");

    let runId;

    await test("Execution: runs immutable version 2 and persists WorkflowRun and TaskRuns in PostgreSQL", async () => {
      // Trigger: 5 * 10 = 50
      const runResult = await workflowService.executeWorkflowRun(testUserAId, createdWorkflowId, {
        triggerData: 5,
      });

      assert.ok(runResult.runId);
      assert.strictEqual(runResult.status, "SUCCEEDED");
      assert.strictEqual(runResult.finalOutput, 50);
      assert.strictEqual(runResult.version, 2);

      runId = runResult.runId;

      // Verify database record
      const dbRun = await prisma.workflowRun.findUnique({
        where: { id: runResult.runId },
        include: { taskRuns: true },
      });

      assert.ok(dbRun);
      assert.strictEqual(dbRun.status, "SUCCEEDED");
      assert.strictEqual(dbRun.output, 50);
      assert.strictEqual(dbRun.taskRuns.length, 3);

      const multTask = dbRun.taskRuns.find((t) => t.nodeId === "n2");
      assert.ok(multTask);
      assert.strictEqual(multTask.status, "SUCCEEDED");
      assert.deepStrictEqual(multTask.output, { output: 50 });
      assert.ok(multTask.startedAt);
      assert.ok(multTask.finishedAt);
    });

    await test("Execution Inspection: owner can retrieve run details and task runs", async () => {
      const runDetails = await workflowService.getRunById(testUserAId, runId);
      assert.strictEqual(runDetails.id, runId);
      assert.strictEqual(runDetails.status, "SUCCEEDED");
      assert.strictEqual(runDetails.taskRuns.length, 3);
    });

    await test("Execution Authorization: unauthorized user cannot access run history", async () => {
      await assert.rejects(
        async () => workflowService.getRunById(testUserBId, runId),
        (err) => err.statusCode === 403
      );
    });

    console.log("\n--- 4. Webhook Trigger Pipeline Integration ---");

    const webhookWorkflowDef = {
      schemaVersion: 1,
      name: "Webhook Ingestion Workflow",
      nodes: [
        {
          id: "trig_wb",
          type: "trigger.webhook",
          version: 1,
          config: { webhookToken: "secret-token-123", allowedMethods: ["POST"] },
        },
        {
          id: "ret_wb",
          type: "output.return",
          version: 1,
          config: {},
        },
      ],
      edges: [
        { id: "e1", source: "trig_wb", sourcePort: "output", target: "ret_wb", targetPort: "input" },
      ],
    };

    const webhookWf = await workflowService.createWorkflow(testUserAId, {
      name: "Webhook Test Workflow",
      definition: webhookWorkflowDef,
    });

    await test("Webhook: executes workflow and persists WorkflowRun with trigger payload", async () => {
      let responseStatus = 0;
      let responseBody = null;
      const mockReq = {
        params: { workflowId: webhookWf.id },
        method: "POST",
        headers: { "x-webhook-token": "secret-token-123" },
        body: { event: "stripe_charge", amount: 9900 },
        query: {},
      };
      const mockRes = {
        status: (s) => {
          responseStatus = s;
          return {
            json: (b) => {
              responseBody = b;
            },
          };
        },
      };

      await webhookController.handleWebhook(mockReq, mockRes, (err) => {
        if (err) throw err;
      });

      assert.strictEqual(responseStatus, 200);
      assert.strictEqual(responseBody.success, true);
      assert.strictEqual(responseBody.status, "SUCCEEDED");
      assert.deepStrictEqual(responseBody.output, { event: "stripe_charge", amount: 9900 });

      // Verify persistence in PostgreSQL
      const persistedRun = await prisma.workflowRun.findUnique({
        where: { id: responseBody.runId },
        include: { taskRuns: true },
      });
      assert.ok(persistedRun);
      assert.strictEqual(persistedRun.status, "SUCCEEDED");
      assert.strictEqual(persistedRun.taskRuns.length, 2);
    });

    await test("Webhook: rejects unauthorized request with 401 when token is invalid or missing", async () => {
      let responseStatus = 0;
      let responseBody = null;
      const mockReq = {
        params: { workflowId: webhookWf.id },
        method: "POST",
        headers: { "x-webhook-token": "wrong-token" },
        body: { event: "spoofed" },
        query: {},
      };
      const mockRes = {
        status: (s) => {
          responseStatus = s;
          return {
            json: (b) => {
              responseBody = b;
            },
          };
        },
      };

      await webhookController.handleWebhook(mockReq, mockRes, (err) => {
        if (err) throw err;
      });

      assert.strictEqual(responseStatus, 401);
      assert.strictEqual(responseBody.success, false);
      assert.strictEqual(responseBody.error.code, "UNAUTHORIZED_WEBHOOK");
    });

    console.log("\n--- 5. Flagship Operations Center Persistence ---");

    const opsCenterDef = require("./workflows/dormammu_ai_operations_center.json");
    const opsWorkflowRecord = await workflowService.createWorkflow(testUserAId, {
      name: "Dormammu AI Operations Center",
      definition: opsCenterDef,
    });

    await test("Flagship: Scenario 1 (Critical Outage) persists full 17-node execution in PostgreSQL", async () => {
      const execResult = await workflowService.executeWorkflowRun(testUserAId, opsWorkflowRecord.id, {
        triggerData: {
          ticketId: "TCK-8092",
          title: "Payment gateway returning HTTP 504 errors",
          description: "Multiple users cannot complete checkout.",
          service: "payment-gateway",
          customerTier: "enterprise",
          affectedUsers: 1200,
          errorRate: 0.42,
          region: "ap-south-1",
          source: "support-webhook",
        },
      });

      assert.strictEqual(execResult.status, "SUCCEEDED");
      assert.ok(execResult.runId);

      const dbRun = await workflowService.getRunById(testUserAId, execResult.runId);
      assert.strictEqual(dbRun.status, "SUCCEEDED");
      assert.strictEqual(dbRun.taskRuns.length, opsCenterDef.nodes.length);

      // Verify critical task succeeded and standard task skipped
      const critTask = dbRun.taskRuns.find((t) => t.nodeId === "action_critical");
      const normTask = dbRun.taskRuns.find((t) => t.nodeId === "action_normal");
      assert.ok(critTask);
      assert.strictEqual(critTask.status, "SUCCEEDED");
      assert.ok(normTask);
      assert.strictEqual(normTask.status, "SKIPPED");
    });

    await test("Flagship: Scenario 2 (Normal) persists with action_normal SUCCEEDED and action_critical SKIPPED", async () => {
      const execResult = await workflowService.executeWorkflowRun(testUserAId, opsWorkflowRecord.id, {
        triggerData: {
          ticketId: "TCK-4102",
          title: "Question about monthly invoice",
          description: "The customer wants clarification regarding prorated tax charges on invoice #8819.",
          service: "billing",
          customerTier: "standard",
          affectedUsers: 1,
          errorRate: 0.0,
          region: "ap-south-1",
          source: "support-webhook",
        },
      });

      assert.strictEqual(execResult.status, "SUCCEEDED");

      const dbRun = await workflowService.getRunById(testUserAId, execResult.runId);
      assert.strictEqual(dbRun.status, "SUCCEEDED");

      const normTask = dbRun.taskRuns.find((t) => t.nodeId === "action_normal");
      const critTask = dbRun.taskRuns.find((t) => t.nodeId === "action_critical");
      const warnTask = dbRun.taskRuns.find((t) => t.nodeId === "action_warning");

      assert.strictEqual(normTask?.status, "SUCCEEDED");
      assert.strictEqual(critTask?.status, "SKIPPED");
      assert.strictEqual(warnTask?.status, "SKIPPED");
    });

    await test("Flagship: Scenario 3 (Warning) persists with action_warning SUCCEEDED and others SKIPPED", async () => {
      const execResult = await workflowService.executeWorkflowRun(testUserAId, opsWorkflowRecord.id, {
        triggerData: {
          ticketId: "TCK-6204",
          title: "Periodic latency spikes in worker cluster",
          description: "Background job queue experiencing 250ms latency spikes.",
          service: "worker-pool",
          customerTier: "pro",
          affectedUsers: 150,
          errorRate: 0.05,
          region: "eu-west-1",
          source: "support-webhook",
        },
      });

      assert.strictEqual(execResult.status, "SUCCEEDED");

      const dbRun = await workflowService.getRunById(testUserAId, execResult.runId);
      assert.strictEqual(dbRun.status, "SUCCEEDED");

      const warnTask = dbRun.taskRuns.find((t) => t.nodeId === "action_warning");
      const critTask = dbRun.taskRuns.find((t) => t.nodeId === "action_critical");
      const normTask = dbRun.taskRuns.find((t) => t.nodeId === "action_normal");

      assert.strictEqual(warnTask?.status, "SUCCEEDED");
      assert.strictEqual(critTask?.status, "SKIPPED");
      assert.strictEqual(normTask?.status, "SKIPPED");
    });

    await test("Flagship: Scenario 4 (Invalid Input) persists run as FAILED and downstream tasks as BLOCKED", async () => {
      let failedRun = null;
      try {
        await workflowService.executeWorkflowRun(testUserAId, opsWorkflowRecord.id, {
          triggerData: {
            ticketId: "TCK-BROKEN",
            title: "Missing critical fields",
          },
        });
      } catch (err) {
        failedRun = err;
      }

      // Even if run fails, we check the latest persisted run for this workflow
      const latestRun = await prisma.workflowRun.findFirst({
        where: { workflowVersion: { workflowId: opsWorkflowRecord.id } },
        orderBy: { createdAt: "desc" },
        include: { taskRuns: true },
      });

      assert.ok(latestRun);
      assert.strictEqual(latestRun.status, "FAILED");

      const validateTask = latestRun.taskRuns.find((t) => t.nodeId === "validate_incident");
      const normalizeTask = latestRun.taskRuns.find((t) => t.nodeId === "normalize_incident");

      assert.ok(validateTask);
      assert.strictEqual(validateTask.status, "FAILED");
      assert.ok(normalizeTask);
      assert.strictEqual(normalizeTask.status, "BLOCKED");
    });

    await test("Webhook Security: rejects unsupported HTTP method with 405 Method Not Allowed", async () => {
      let responseStatus = 0;
      let responseBody = null;
      const mockReq = {
        params: { workflowId: webhookWf.id },
        method: "DELETE",
        headers: { "x-webhook-token": "secret-webhook-token-123" },
        body: {},
        query: {},
      };
      const mockRes = {
        status: (s) => {
          responseStatus = s;
          return {
            json: (b) => {
              responseBody = b;
            },
          };
        },
      };

      await webhookController.handleWebhook(mockReq, mockRes, (err) => {
        if (err) throw err;
      });

      assert.strictEqual(responseStatus, 405);
      assert.strictEqual(responseBody.success, false);
      assert.strictEqual(responseBody.error.code, "METHOD_NOT_ALLOWED");
    });

    await test("Webhook Security: rejects unknown workflow ID with 404 Not Found", async () => {
      let responseStatus = 0;
      let responseBody = null;
      const mockReq = {
        params: { workflowId: "nonexistent-workflow-id-999" },
        method: "POST",
        headers: {},
        body: {},
        query: {},
      };
      const mockRes = {
        status: (s) => {
          responseStatus = s;
          return {
            json: (b) => {
              responseBody = b;
            },
          };
        },
      };

      await webhookController.handleWebhook(mockReq, mockRes, (err) => {
        if (err) throw err;
      });

      assert.strictEqual(responseStatus, 404);
      assert.strictEqual(responseBody.success, false);
      assert.strictEqual(responseBody.error.code, "WORKFLOW_NOT_FOUND");
    });

    await test("Persistence Recovery: getRunById and getRunTasks retrieve full inspectable state", async () => {
      const runs = await workflowService.listRunsForWorkflow(testUserAId, opsWorkflowRecord.id);
      assert.ok(runs.length >= 3);

      const firstRunId = runs[0].id;
      const detailedRun = await workflowService.getRunById(testUserAId, firstRunId);
      assert.ok(detailedRun);
      assert.ok(detailedRun.taskRuns.length > 0);

      // Verify each task run has required inspectability fields
      for (const task of detailedRun.taskRuns) {
        assert.ok(task.id);
        assert.ok(task.nodeId);
        assert.ok(["SUCCEEDED", "SKIPPED", "FAILED", "BLOCKED"].includes(task.status));
      }
    });

    // Cleanup test data
    await prisma.workflow.deleteMany({ where: { ownerId: { in: [testUserAId, testUserBId] } } });
    await prisma.user.deleteMany({ where: { id: { in: [testUserAId, testUserBId] } } });
  } catch (err) {
    console.error("Test execution setup/cleanup error:", err);
    failed++;
  } finally {
    await prisma.$disconnect();
  }

  console.log("\n-------------------------------------------------------");
  console.log(` Results: ${passed} passed, ${failed} failed`);
  console.log("-------------------------------------------------------\n");

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runApiAndIntegrationTests().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
