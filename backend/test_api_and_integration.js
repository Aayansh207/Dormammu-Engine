/**
 * Webster Comprehensive API & End-to-End Integration Test Suite
 */

const app = require("./app");
const prisma = require("./src/config/db");
const { generateAccessToken } = require("./src/utils/tokens");
const { executeWorkflow } = require("./src/engine/scheduler/dag.scheduler");

let server;
let baseUrl;
let token;
let testUser;

async function request(path, options = {}) {
  const url = `${baseUrl}${path}`;
  const headers = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };

  const response = await fetch(url, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({}));
  return { status: response.status, body: data };
}

async function runApiTests() {
  console.log("==================================================");
  console.log("🌐 STARTING WEBSTER REST API & END-TO-END TESTS");
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

  // Start HTTP server on ephemeral port
  server = app.listen(0);
  const port = server.address().port;
  baseUrl = `http://localhost:${port}`;

  // Find or create test user and generate auth token
  testUser = await prisma.user.findFirst({ where: { email: "api_tester@example.com" } });
  if (!testUser) {
    testUser = await prisma.user.create({
      data: {
        email: "api_tester@example.com",
        name: "API Tester",
        role: "USER",
        emailVerified: true,
      },
    });
  }

  token = generateAccessToken(testUser);

  try {
    // ----------------------------------------------------
    // TEST 1: Node Catalogue Endpoints (Public)
    // ----------------------------------------------------
    console.log("--- 1. Node Catalogue Endpoints ---");
    const listRes = await request("/api/nodes");
    assert(listRes.status === 200, "GET /api/nodes returns 200 OK");
    assert(Array.isArray(listRes.body.data), "GET /api/nodes data is an array");
    assert(listRes.body.data.length >= 16, `Catalogue has at least 16 nodes (found: ${listRes.body.data.length})`);

    const multiplyRes = await request("/api/nodes/math.multiply");
    assert(multiplyRes.status === 200, "GET /api/nodes/math.multiply returns 200 OK");
    assert(multiplyRes.body.data.type === "math.multiply", "Node type is math.multiply");
    assert(multiplyRes.body.data.configSchema !== undefined, "Node has configSchema");

    const unknownNodeRes = await request("/api/nodes/non.existent.node");
    assert(unknownNodeRes.status === 404, "GET /api/nodes/:type for unknown node returns 404");

    // ----------------------------------------------------
    // TEST 2: Raw Workflow Validation Endpoint
    // ----------------------------------------------------
    console.log("\n--- 2. Public / Raw Validation Endpoint ---");
    const validWf = {
      schemaVersion: 1,
      name: "Valid Pipeline",
      nodes: [
        { id: "t1", type: "trigger.manual", version: 1, name: "Trigger", position: { x: 0, y: 0 }, config: {} },
        { id: "o1", type: "output.return", version: 1, name: "Output", position: { x: 100, y: 0 }, config: {} },
      ],
      edges: [
        { id: "e1", source: "t1", sourcePort: "output", target: "o1", targetPort: "input" },
      ],
    };

    const valRes = await request("/api/workflows/validate", {
      method: "POST",
      body: JSON.stringify({ definition: validWf }),
    });
    assert(valRes.status === 200, "POST /api/workflows/validate returns 200 OK");
    assert(valRes.body.data.valid === true, "Valid workflow returns valid: true");

    // Cycle detection check
    const invalidWf = {
      schemaVersion: 1,
      name: "Cycle Pipeline",
      nodes: [
        { id: "n1", type: "math.add", version: 1, name: "A", position: { x: 0, y: 0 }, config: {} },
        { id: "n2", type: "math.add", version: 1, name: "B", position: { x: 0, y: 0 }, config: {} },
      ],
      edges: [
        { id: "e1", source: "n1", sourcePort: "output", target: "n2", targetPort: "input" },
        { id: "e2", source: "n2", sourcePort: "output", target: "n1", targetPort: "input" },
      ],
    };
    const invalidValRes = await request("/api/workflows/validate", {
      method: "POST",
      body: JSON.stringify({ definition: invalidWf }),
    });
    assert(invalidValRes.status === 200, "Validation endpoint responds with 200 for structured result");
    assert(invalidValRes.body.data.valid === false, "Cycle detected, valid: false");
    const cycleErr = invalidValRes.body.data.errors.find((e) => e.code === "CYCLE_DETECTED");
    assert(cycleErr !== undefined, "Errors array contains CYCLE_DETECTED");

    // ----------------------------------------------------
    // TEST 3: Unauthorized Access Prevention
    // ----------------------------------------------------
    console.log("\n--- 3. Authorization & Security ---");
    const unauthRes = await request("/api/workflows", {
      headers: { Authorization: "" }, // No token
    });
    assert(unauthRes.status === 401, "GET /api/workflows without token returns 401 Unauthorized");

    // ----------------------------------------------------
    // TEST 4: Workflow Lifecycle (Create, List, Get, Update, Run)
    // ----------------------------------------------------
    console.log("\n--- 4. Authenticated Workflow CRUD & Versioning ---");
    const createRes = await request("/api/workflows", {
      method: "POST",
      body: JSON.stringify({
        name: "Multiply Pipeline API Test",
        description: "Created via automated API test",
        definition: {
          schemaVersion: 1,
          name: "Multiply Pipeline API Test",
          nodes: [
            { id: "t1", type: "trigger.manual", version: 1, name: "Trigger", position: { x: 100, y: 200 }, config: {} },
            { id: "m1", type: "math.multiply", version: 1, name: "Multiply", position: { x: 350, y: 200 }, config: { factor: 4 } },
            { id: "o1", type: "output.return", version: 1, name: "Return", position: { x: 600, y: 200 }, config: {} },
          ],
          edges: [
            { id: "e1", source: "t1", sourcePort: "output", target: "m1", targetPort: "input" },
            { id: "e2", source: "m1", sourcePort: "output", target: "o1", targetPort: "input" },
          ],
        },
      }),
    });
    assert(createRes.status === 201, "POST /api/workflows returns 201 Created");
    const createdId = createRes.body.data.id;
    assert(createdId !== undefined, "Workflow ID returned");
    assert(createRes.body.data.currentVersion === 1, "Initial version is 1");

    // List
    const listWfRes = await request("/api/workflows");
    assert(listWfRes.status === 200, "GET /api/workflows returns 200 OK");
    const foundWf = listWfRes.body.data.find((w) => w.id === createdId);
    assert(foundWf !== undefined, "Created workflow is in user list");
    assert(foundWf.nodesCount === 3, "Workflow nodes count is 3");

    // Get by ID
    const getWfRes = await request(`/api/workflows/${createdId}`);
    assert(getWfRes.status === 200, "GET /api/workflows/:id returns 200 OK");
    assert(getWfRes.body.data.name === "Multiply Pipeline API Test", "Workflow name matches");

    // Update (Save new immutable version v2)
    const updateDef = JSON.parse(JSON.stringify(createRes.body.data.definition));
    updateDef.nodes[1].config.factor = 10;
    const updateRes = await request(`/api/workflows/${createdId}`, {
      method: "PUT",
      body: JSON.stringify({
        name: "Multiply Pipeline API Test v2",
        definition: updateDef,
      }),
    });
    assert(updateRes.status === 200, "PUT /api/workflows/:id returns 200 OK");
    assert(updateRes.body.data.version === 2, "New immutable version v2 created");

    // Execute Run
    console.log("\n--- 5. Workflow Run Execution Endpoint ---");
    const runRes = await request(`/api/workflows/${createdId}/runs`, {
      method: "POST",
      body: JSON.stringify({
        triggerData: 25,
      }),
    });
    assert(runRes.status === 200, "POST /api/workflows/:id/runs returns 200 OK");
    assert(runRes.body.data.status === "SUCCEEDED", "Run status is SUCCEEDED");
    assert(runRes.body.data.finalOutput === 250, "Final output is 25 * 10 = 250");
    const runId = runRes.body.data.runId;

    // Get Run Details
    const runDetailRes = await request(`/api/runs/${runId}`);
    assert(runDetailRes.status === 200, "GET /api/runs/:runId returns 200 OK");
    assert(runDetailRes.body.data.status === "SUCCEEDED", "Run detail status is SUCCEEDED");
    assert(Array.isArray(runDetailRes.body.data.taskRuns), "Run has taskRuns array");
    assert(runDetailRes.body.data.taskRuns.length === 3, "3 task runs recorded");

    // Get Run Tasks
    const runTasksRes = await request(`/api/runs/${runId}/tasks`);
    assert(runTasksRes.status === 200, "GET /api/runs/:runId/tasks returns 200 OK");
    assert(runTasksRes.body.data.length === 3, "3 tasks returned from /tasks");

    // List Runs for Workflow
    const workflowRunsRes = await request(`/api/workflows/${createdId}/runs`);
    assert(workflowRunsRes.status === 200, "GET /api/workflows/:id/runs returns 200 OK");
    assert(workflowRunsRes.body.data.length >= 1, "At least 1 run listed");

    // ----------------------------------------------------
    // TEST 6: Complex Branching and Merging Dependencies
    // ----------------------------------------------------
    console.log("\n--- 6. Complex Branching & Merging DAG Execution ---");
    const branchMergeWorkflow = {
      schemaVersion: 1,
      name: "Branch and Merge",
      nodes: [
        { id: "start", type: "data.input", version: 1, name: "Start", position: { x: 0, y: 0 }, config: { defaultValue: 10 } },
        { id: "add_branch", type: "math.add", version: 1, name: "Add 20", position: { x: 200, y: -50 }, config: { addend: 20 } },
        { id: "mult_branch", type: "math.multiply", version: 1, name: "Multiply 3", position: { x: 200, y: 50 }, config: { factor: 3 } },
        { id: "merge", type: "math.subtract", version: 1, name: "Merge (add - mult)", position: { x: 400, y: 0 }, config: {} },
        { id: "finish", type: "output.return", version: 1, name: "Finish", position: { x: 600, y: 0 }, config: {} },
      ],
      edges: [
        // start (10) -> add_branch (10 + 20 = 30)
        { id: "e1", source: "start", sourcePort: "output", target: "add_branch", targetPort: "input" },
        // start (10) -> mult_branch (10 * 3 = 30)
        { id: "e2", source: "start", sourcePort: "output", target: "mult_branch", targetPort: "input" },
        // add_branch (30) -> merge port a
        { id: "e3", source: "add_branch", sourcePort: "output", target: "merge", targetPort: "a" },
        // mult_branch (30) -> merge port b
        { id: "e4", source: "mult_branch", sourcePort: "output", target: "merge", targetPort: "b" },
        // merge (30 - 30 = 0) -> finish
        { id: "e5", source: "merge", sourcePort: "output", target: "finish", targetPort: "input" },
      ],
    };

    const branchSummary = await executeWorkflow(branchMergeWorkflow, { triggerData: {} });
    assert(branchSummary.status === "SUCCEEDED", "Branch and merge DAG executes successfully");
    assert(branchSummary.finalOutput === 0, `Branch and merge output is (10+20) - (10*3) = 0 (got: ${branchSummary.finalOutput})`);
    assert(branchSummary.tasks.merge.status === "SUCCEEDED", "Merge node reached and succeeded");

    // ----------------------------------------------------
    // TEST 7: Handler Failure & Downstream Blocking
    // ----------------------------------------------------
    console.log("\n--- 7. Handler Failure & Downstream Task Blocking ---");
    const failWorkflow = {
      schemaVersion: 1,
      name: "Runtime Divide by Zero Failure",
      nodes: [
        { id: "t1", type: "trigger.manual", version: 1, name: "T", position: { x: 0, y: 0 }, config: {} },
        { id: "zero_node", type: "data.input", version: 1, name: "Zero", position: { x: 0, y: 50 }, config: { defaultValue: 0 } },
        { id: "d1", type: "math.divide", version: 1, name: "Divide by zero at runtime", position: { x: 200, y: 0 }, config: {} },
        { id: "ret", type: "output.return", version: 1, name: "Should Be Blocked", position: { x: 400, y: 0 }, config: {} },
      ],
      edges: [
        { id: "e1", source: "t1", sourcePort: "output", target: "d1", targetPort: "a" },
        { id: "e2", source: "zero_node", sourcePort: "output", target: "d1", targetPort: "b" },
        { id: "e3", source: "d1", sourcePort: "output", target: "ret", targetPort: "input" },
      ],
    };

    const failSummary = await executeWorkflow(failWorkflow, { triggerData: 100 });
    assert(failSummary.status === "FAILED", "Workflow with runtime failure ends in FAILED");
    assert(failSummary.tasks && failSummary.tasks.d1.status === "FAILED", "math.divide task status is FAILED");
    assert(failSummary.tasks && failSummary.tasks.ret.status === "BLOCKED", "Downstream task 'ret' is BLOCKED");

    // Clean up created workflow
    await request(`/api/workflows/${createdId}`, { method: "DELETE" });

    console.log("\n==================================================");
    console.log(`📊 API TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log("==================================================");

    server.close();
    if (failed > 0) process.exit(1);
    else process.exit(0);
  } catch (err) {
    console.error("Fatal test error:", err);
    if (server) server.close();
    process.exit(1);
  }
}

runApiTests();
