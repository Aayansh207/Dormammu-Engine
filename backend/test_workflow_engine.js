/**
 * Comprehensive Workflow & Engine Verification Suite
 */

const { defaultRegistry } = require("./src/engine/registry/node.registry");
const { validateWorkflow } = require("./src/engine/validator/workflow.validator");
const { executeWorkflow } = require("./src/engine/scheduler/dag.scheduler");
const { createExecutionPlan } = require("./src/engine/planner/execution.planner");
const workflowService = require("./src/services/workflow.service");
const prisma = require("./src/config/db");

async function runTests() {
  console.log("==================================================");
  console.log("🧪 STARTING WEBSTER WORKFLOW STANDARDS & ENGINE TESTS");
  console.log("==================================================\n");

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
      failed++;
    }
  }

  // TEST SUITE 1: Node Catalogue & Registry
  console.log("--- 1. Authoritative Node Catalogue & Registry ---");
  const catalogue = defaultRegistry.list();
  assert(catalogue.length >= 16, `Catalogue has at least 16 nodes (found: ${catalogue.length})`);

  const multiplyNode = defaultRegistry.getMetadata("math.multiply");
  assert(multiplyNode !== null, "math.multiply exists in registry");
  assert(multiplyNode.category === "mathematical", "math.multiply category is 'mathematical'");
  assert(multiplyNode.configSchema && multiplyNode.configSchema.factor, "math.multiply has configSchema.factor");
  assert(multiplyNode.inputs.input !== undefined, "math.multiply has 'input' port");
  assert(multiplyNode.outputs.output !== undefined, "math.multiply has 'output' port");

  const returnNode = defaultRegistry.getMetadata("output.return");
  assert(returnNode.inputs.input !== undefined, "output.return has 'input' port");
  assert(returnNode.outputs.output !== undefined, "output.return has 'output' port");

  // TEST SUITE 2: Standard Reference Workflow (from Specification Section 5)
  console.log("\n--- 2. Specification Section 5 Canonical Workflow ---");
  const canonicalWorkflow = {
    schemaVersion: 1,
    name: "My First Workflow",
    nodes: [
      {
        id: "trigger_01",
        type: "trigger.manual",
        version: 1,
        name: "Manual Trigger",
        position: { x: 100, y: 200 },
        config: {},
      },
      {
        id: "math_01",
        type: "math.multiply",
        version: 1,
        name: "Multiply",
        position: { x: 350, y: 200 },
        config: { factor: 5 },
      },
      {
        id: "output_01",
        type: "output.return",
        version: 1,
        name: "Return Result",
        position: { x: 600, y: 200 },
        config: {},
      },
    ],
    edges: [
      {
        id: "edge_01",
        source: "trigger_01",
        sourcePort: "output",
        target: "math_01",
        targetPort: "input",
      },
      {
        id: "edge_02",
        source: "math_01",
        sourcePort: "output",
        target: "output_01",
        targetPort: "input",
      },
    ],
  };

  const valResult = validateWorkflow(canonicalWorkflow);
  assert(valResult.valid === true, "Canonical workflow passes validation with 0 errors");
  assert(valResult.errors.length === 0, "Errors array is empty");

  // TEST SUITE 3: Execution of Canonical Workflow
  console.log("\n--- 3. Canonical Workflow Execution (Sequential DAG) ---");
  const execResult = await executeWorkflow(canonicalWorkflow, {
    triggerData: 10,
  });
  assert(execResult.status === "SUCCEEDED", `Execution status is SUCCEEDED (got: ${execResult.status})`);
  assert(execResult.finalOutput === 50, `Final output is 10 * 5 = 50 (got: ${execResult.finalOutput})`);
  assert(execResult.tasks.trigger_01.status === "SUCCEEDED", "trigger_01 status is SUCCEEDED");
  assert(execResult.tasks.math_01.status === "SUCCEEDED", "math_01 status is SUCCEEDED");
  assert(execResult.tasks.output_01.status === "SUCCEEDED", "output_01 status is SUCCEEDED");

  // TEST SUITE 4: Cycle Detection
  console.log("\n--- 4. Cycle Detection & Graph Validation ---");
  const cyclicWorkflow = {
    schemaVersion: 1,
    name: "Cyclic Workflow",
    nodes: [
      { id: "node_A", type: "math.add", version: 1, name: "A", position: { x: 0, y: 0 }, config: {} },
      { id: "node_B", type: "math.add", version: 1, name: "B", position: { x: 0, y: 0 }, config: {} },
    ],
    edges: [
      { id: "e1", source: "node_A", sourcePort: "output", target: "node_B", targetPort: "input" },
      { id: "e2", source: "node_B", sourcePort: "output", target: "node_A", targetPort: "input" },
    ],
  };
  const cycleVal = validateWorkflow(cyclicWorkflow);
  assert(cycleVal.valid === false, "Cyclic workflow is rejected");
  const cycleErr = cycleVal.errors.find((e) => e.code === "CYCLE_DETECTED");
  assert(cycleErr !== undefined, "CYCLE_DETECTED error code is returned");

  // Self loop
  const selfLoopWorkflow = {
    schemaVersion: 1,
    name: "Self Loop",
    nodes: [{ id: "node_A", type: "math.add", version: 1, name: "A", position: { x: 0, y: 0 }, config: {} }],
    edges: [{ id: "e1", source: "node_A", sourcePort: "output", target: "node_A", targetPort: "input" }],
  };
  const selfVal = validateWorkflow(selfLoopWorkflow);
  assert(selfVal.valid === false, "Self-loop is rejected");

  // TEST SUITE 5: Invalid Node Config Validation
  console.log("\n--- 5. Node Config Validation ---");
  const invalidConfigWf = {
    schemaVersion: 1,
    name: "Invalid Config",
    nodes: [
      {
        id: "math_01",
        type: "math.multiply",
        version: 1,
        name: "Bad Factor",
        position: { x: 0, y: 0 },
        config: { factor: "not_a_number" },
      },
    ],
    edges: [],
  };
  const configVal = validateWorkflow(invalidConfigWf);
  assert(configVal.valid === false, "Invalid factor config is rejected");
  const configErr = configVal.errors.find((e) => e.code === "NODE_CONFIG_INVALID");
  assert(configErr !== undefined, "NODE_CONFIG_INVALID error code returned");
  assert(configErr.nodeId === "math_01", "Error references offending nodeId");
  assert(configErr.field === "config.factor", "Error references offending field");

  // TEST SUITE 6: Database Persistence & Versioning Service
  console.log("\n--- 6. Database Persistence & Immutable Versioning ---");
  // Find or create test user
  let testUser = await prisma.user.findFirst({ where: { email: "workflow_test@example.com" } });
  if (!testUser) {
    testUser = await prisma.user.create({
      data: {
        email: "workflow_test@example.com",
        name: "Workflow Tester",
        role: "USER",
        emailVerified: true,
      },
    });
  }

  // 1. Create workflow
  const createdWf = await workflowService.createWorkflow(testUser.id, {
    name: "Test DB Pipeline",
    description: "Automated test pipeline",
    definition: canonicalWorkflow,
  });
  assert(createdWf.id !== undefined, "Workflow created with UUID in DB");
  assert(createdWf.currentVersion === 1, "Initial workflow version is 1");

  // 2. Fetch workflow
  const fetchedWf = await workflowService.getWorkflowById(testUser.id, createdWf.id);
  assert(fetchedWf.name === "Test DB Pipeline", "Fetched workflow matches name");
  assert(fetchedWf.definition.nodes.length === 3, "Fetched definition has 3 nodes");

  // 3. Update workflow (creates version 2)
  const updatedDef = JSON.parse(JSON.stringify(canonicalWorkflow));
  updatedDef.nodes[1].config.factor = 10;
  const updatedWf = await workflowService.updateWorkflow(testUser.id, createdWf.id, {
    name: "Test DB Pipeline v2",
    definition: updatedDef,
  });
  assert(updatedWf.version === 2, "Updated workflow creates immutable version 2");

  // Verify version 1 is still preserved in DB
  const version1Record = await prisma.workflowVersion.findUnique({
    where: {
      workflowId_version: {
        workflowId: createdWf.id,
        version: 1,
      },
    },
  });
  assert(version1Record !== null, "Version 1 record still exists in database");
  assert(version1Record.definitionJson.nodes[1].config.factor === 5, "Version 1 definition retains factor=5");

  // 4. Execute workflow run
  console.log("\n--- 7. Workflow Run Execution & Task Run Persistence ---");
  const runResult = await workflowService.executeWorkflowRun(testUser.id, createdWf.id, {
    triggerData: 20,
  });
  assert(runResult.status === "SUCCEEDED", "Workflow run status is SUCCEEDED");
  assert(runResult.finalOutput === 200, `Final output is 20 * 10 = 200 (got: ${runResult.finalOutput})`);

  // Verify TaskRun records in DB
  const taskRunsInDb = await prisma.taskRun.findMany({
    where: { workflowRunId: runResult.runId },
  });
  assert(taskRunsInDb.length === 3, `All 3 node executions persisted to task_runs table (found: ${taskRunsInDb.length})`);
  const mathTask = taskRunsInDb.find((t) => t.nodeId === "math_01");
  assert(mathTask && mathTask.status === "SUCCEEDED", "TaskRun for math_01 is SUCCEEDED");

  // 5. Test Authorization & Ownership Check
  console.log("\n--- 8. Security & Ownership Enforcement ---");
  let unauthorizedBlocked = false;
  try {
    await workflowService.getWorkflowById("random-other-user-id", createdWf.id);
  } catch (err) {
    unauthorizedBlocked = err.statusCode === 403;
  }
  assert(unauthorizedBlocked, "Accessing another user's workflow rejected with 403 Forbidden");

  // Cleanup test workflow
  await workflowService.deleteWorkflow(testUser.id, createdWf.id);
  const deletedCheck = await prisma.workflow.findUnique({ where: { id: createdWf.id } });
  assert(deletedCheck === null, "Workflow deleted cleanly");

  console.log("\n==================================================");
  console.log(`📊 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log("==================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runTests()
  .then(() => {
    prisma.$disconnect();
    process.exit(0);
  })
  .catch((err) => {
    console.error("Test execution fatal error:", err);
    prisma.$disconnect();
    process.exit(1);
  });
