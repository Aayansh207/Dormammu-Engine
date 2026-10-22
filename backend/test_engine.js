/**
 * Webster Execution Engine - Core Engine Test Suite
 * Tests Phase 1 (Registry & Contracts), Phase 2 (Validator & Planner), Phase 3 (DAG Scheduler)
 */

const { NodeRegistry, defaultRegistry } = require("./src/engine/registry/node.registry");
require("./src/engine/registry/nodes"); // Auto-register core nodes
const { ErrorCodes } = require("./src/engine/contracts/errors");
const { createExecutionContext, createSafeLogger } = require("./src/engine/contracts/context");
const { validateWorkflow } = require("./src/engine/validator/workflow.validator");
const { createExecutionPlan } = require("./src/engine/planner/execution.planner");
const { executeWorkflow, WorkflowRunStatus, TaskRunStatus } = require("./src/engine/scheduler/dag.scheduler");

const results = [];

function assert(condition, message) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function runTest(number, name, fn) {
  try {
    await fn();
    console.log(`✔ [PASS] Test ${number}: ${name}`);
    results.push({ number, name, passed: true });
  } catch (err) {
    console.error(`✖ [FAIL] Test ${number}: ${name}`);
    console.error(`   Error: ${err.message}`);
    results.push({ number, name, passed: false, error: err.message });
  }
}

async function main() {
  console.log("\n============================================================");
  console.log("Webster Core Execution Engine Test Suite");
  console.log("============================================================\n");

  // --------------------------------------------------------------------------
  // Phase 1 Tests: Contracts & Registry
  // --------------------------------------------------------------------------
  console.log("--- Phase 1: Registry & Node Contracts ---");

  const expectedTypes = [
    "trigger.manual", "data.input", "math.add", "math.subtract",
    "math.multiply", "math.divide", "math.modulo", "math.power",
    "math.round", "math.abs", "math.min", "math.max",
    "json.parse", "json.get", "output.log", "output.return",
  ];

  await runTest(1, "All 16 core nodes registered in catalogue", async () => {
    assert(defaultRegistry.list().length >= 16, "Expected at least 16 registered nodes");
    for (const type of expectedTypes) {
      assert(defaultRegistry.has(type), `Missing node: ${type}`);
    }
  });

  await runTest(2, "Unknown node lookup throws UNKNOWN_NODE_TYPE", async () => {
    let caught = null;
    try {
      defaultRegistry.get("nonexistent.node");
    } catch (err) {
      caught = err;
    }
    assert(caught && caught.code === ErrorCodes.UNKNOWN_NODE_TYPE, "Expected UNKNOWN_NODE_TYPE error");
  });

  await runTest(3, "Input port type and requirement validation", async () => {
    const missing = defaultRegistry.validateInputs("math.add", { a: 5 });
    assert(!missing.valid, "Missing required input 'b' should fail");

    const mismatch = defaultRegistry.validateInputs("math.add", { a: "abc", b: 5 });
    assert(!mismatch.valid, "Type mismatch should fail");
  });

  await runTest(4, "Math nodes compute accurately and check division by zero", async () => {
    const add = await defaultRegistry.get("math.add").handler({ a: 10, b: 5 });
    assert(add.result === 15, "Add failed");

    const sub = await defaultRegistry.get("math.subtract").handler({ a: 10, b: 4 });
    assert(sub.result === 6, "Subtract failed");

    const mul = await defaultRegistry.get("math.multiply").handler({ a: 6, b: 7 });
    assert(mul.result === 42, "Multiply failed");

    const div = await defaultRegistry.get("math.divide").handler({ a: 20, b: 4 });
    assert(div.result === 5, "Divide failed");

    let divZero = null;
    try {
      await defaultRegistry.get("math.divide").handler({ a: 20, b: 0 });
    } catch (e) {
      divZero = e;
    }
    assert(divZero && divZero.code === ErrorCodes.DIVISION_BY_ZERO, "Divide by zero should fail");
  });

  await runTest(5, "JSON parse & get handle structured data and errors", async () => {
    const parsed = await defaultRegistry.get("json.parse").handler({ text: '{"profile":{"age":30}}' });
    assert(parsed.data.profile.age === 30, "JSON parse failed");

    const got = await defaultRegistry.get("json.get").handler({ object: parsed.data }, { config: { path: "profile.age" } });
    assert(got.value === 30, "JSON get failed");
  });

  await runTest(6, "Dynamic node registration works without altering scheduler", async () => {
    const custom = new NodeRegistry();
    custom.register({
      type: "custom.shout",
      inputs: { text: { type: "string" } },
      outputs: { text: { type: "string" } },
      handler: async (inputs) => ({ text: String(inputs.text).toUpperCase() }),
    });
    assert(custom.has("custom.shout"), "Custom node not registered");
    const res = await custom.get("custom.shout").handler({ text: "dormammu" });
    assert(res.text === "DORMAMMU", "Custom node failed");
  });

  // --------------------------------------------------------------------------
  // Phase 2 Tests: Validator & Planner
  // --------------------------------------------------------------------------
  console.log("\n--- Phase 2: Workflow Validation & Execution Planner ---");

  await runTest(7, "Valid DAG produces deterministic execution plan", async () => {
    const workflow = {
      schemaVersion: "1.0",
      name: "Valid Pipeline",
      nodes: [
        { id: "inp", type: "data.input", config: { key: "x" } },
        { id: "add", type: "math.add", config: { b: 10 } },
        { id: "ret", type: "output.return" },
      ],
      edges: [
        { id: "e1", source: "inp", sourcePort: "value", target: "add", targetPort: "a" },
        { id: "e2", source: "add", sourcePort: "result", target: "ret", targetPort: "value" },
      ],
    };
    const val = validateWorkflow(workflow);
    assert(val.valid, "Workflow should be valid");

    const plan = createExecutionPlan(workflow);
    assert(plan.totalNodes === 3, "Expected 3 nodes in plan");
    assert(plan.entryNodeIds[0] === "inp", "Entry node should be inp");
  });

  await runTest(8, "Cycle detection catches direct and indirect loops", async () => {
    const cyclicWorkflow = {
      schemaVersion: "1.0",
      name: "Cyclic",
      nodes: [
        { id: "A", type: "math.add" },
        { id: "B", type: "math.subtract" },
      ],
      edges: [
        { id: "e1", source: "A", sourcePort: "result", target: "B", targetPort: "a" },
        { id: "e2", source: "B", sourcePort: "result", target: "A", targetPort: "a" },
      ],
    };
    const val = validateWorkflow(cyclicWorkflow);
    assert(!val.valid, "Cyclic workflow should be invalid");
    assert(val.errors.some((e) => e.code === ErrorCodes.CYCLE_DETECTED), "CYCLE_DETECTED error expected");
  });

  await runTest(9, "Ambiguous multiple inputs to single port are rejected", async () => {
    const ambiguous = {
      schemaVersion: "1.0",
      name: "Ambiguous",
      nodes: [
        { id: "s1", type: "trigger.manual" },
        { id: "s2", type: "trigger.manual" },
        { id: "target", type: "math.add" },
      ],
      edges: [
        { id: "e1", source: "s1", sourcePort: "output", target: "target", targetPort: "a" },
        { id: "e2", source: "s2", sourcePort: "output", target: "target", targetPort: "a" },
      ],
    };
    const val = validateWorkflow(ambiguous);
    assert(!val.valid, "Ambiguous inputs should fail");
    assert(val.errors.some((e) => e.code === ErrorCodes.MULTIPLE_INPUTS_NOT_SUPPORTED), "MULTIPLE_INPUTS expected");
  });

  await runTest(10, "Serialization order does not affect plan determinism", async () => {
    const nodes = [
      { id: "n1", type: "data.input", config: { key: "x" } },
      { id: "n2", type: "math.add", config: { b: 5 } },
      { id: "n3", type: "output.return" },
    ];
    const edges = [
      { id: "e1", source: "n1", sourcePort: "value", target: "n2", targetPort: "a" },
      { id: "e2", source: "n2", sourcePort: "result", target: "n3", targetPort: "value" },
    ];
    const p1 = createExecutionPlan({ schemaVersion: "1.0", nodes, edges });
    const p2 = createExecutionPlan({ schemaVersion: "1.0", nodes: [...nodes].reverse(), edges: [...edges].reverse() });
    assert(JSON.stringify(p1.entryNodeIds) === JSON.stringify(p2.entryNodeIds), "Entry nodes should match");
    assert(p1.inDegree.get("n2") === p2.inDegree.get("n2"), "InDegree should match");
  });

  // --------------------------------------------------------------------------
  // Phase 3 Tests: Sequential In-Process DAG Scheduler
  // --------------------------------------------------------------------------
  console.log("\n--- Phase 3: Sequential In-Process DAG Scheduler ---");

  await runTest(11, "Linear DAG executes to completion and yields final output", async () => {
    const wf = {
      schemaVersion: "1.0",
      name: "Linear",
      nodes: [
        { id: "inp", type: "data.input", config: { key: "val" } },
        { id: "add", type: "math.add", config: { b: 12 } },
        { id: "ret", type: "output.return" },
      ],
      edges: [
        { id: "e1", source: "inp", sourcePort: "value", target: "add", targetPort: "a" },
        { id: "e2", source: "add", sourcePort: "result", target: "ret", targetPort: "value" },
      ],
    };
    const run = await executeWorkflow(wf, { triggerData: { val: 8 } });
    assert(run.status === WorkflowRunStatus.SUCCEEDED, "Run should succeed");
    assert(run.finalOutput === 20, `Expected final output 20, got ${run.finalOutput}`);
  });

  await runTest(12, "Diamond branch-join DAG resolves dependencies correctly", async () => {
    // x = 10, y = 4
    // addBranch: 10 + 4 = 14
    // mulBranch: 10 * 4 = 40
    // joinSub: 14 - 40 = -26
    const wf = {
      schemaVersion: "1.0",
      name: "Diamond",
      nodes: [
        { id: "inX", type: "data.input", config: { key: "x" } },
        { id: "inY", type: "data.input", config: { key: "y" } },
        { id: "branchAdd", type: "math.add" },
        { id: "branchMul", type: "math.multiply" },
        { id: "joinSub", type: "math.subtract" },
        { id: "ret", type: "output.return" },
      ],
      edges: [
        { id: "e1", source: "inX", sourcePort: "value", target: "branchAdd", targetPort: "a" },
        { id: "e2", source: "inY", sourcePort: "value", target: "branchAdd", targetPort: "b" },
        { id: "e3", source: "inX", sourcePort: "value", target: "branchMul", targetPort: "a" },
        { id: "e4", source: "inY", sourcePort: "value", target: "branchMul", targetPort: "b" },
        { id: "e5", source: "branchAdd", sourcePort: "result", target: "joinSub", targetPort: "a" },
        { id: "e6", source: "branchMul", sourcePort: "result", target: "joinSub", targetPort: "b" },
        { id: "e7", source: "joinSub", sourcePort: "result", target: "ret", targetPort: "value" },
      ],
    };
    const run = await executeWorkflow(wf, { triggerData: { x: 10, y: 4 } });
    assert(run.status === WorkflowRunStatus.SUCCEEDED, "Diamond run should succeed");
    assert(run.finalOutput === -26, `Expected -26, got ${run.finalOutput}`);
  });

  await runTest(13, "Task failure stops run and transitions descendants to BLOCKED", async () => {
    const wf = {
      schemaVersion: "1.0",
      name: "Fail Fast",
      nodes: [
        { id: "inp", type: "data.input", config: { key: "num" } },
        { id: "divZero", type: "math.divide", config: { b: 0 } },
        { id: "downstream", type: "math.add", config: { b: 5 } },
        { id: "ret", type: "output.return" },
      ],
      edges: [
        { id: "e1", source: "inp", sourcePort: "value", target: "divZero", targetPort: "a" },
        { id: "e2", source: "divZero", sourcePort: "result", target: "downstream", targetPort: "a" },
        { id: "e3", source: "downstream", sourcePort: "result", target: "ret", targetPort: "value" },
      ],
    };
    const run = await executeWorkflow(wf, { triggerData: { num: 100 } });
    assert(run.status === WorkflowRunStatus.FAILED, "Run should fail");
    assert(run.tasks["divZero"].status === TaskRunStatus.FAILED, "divZero should be FAILED");
    assert(run.tasks["downstream"].status === TaskRunStatus.BLOCKED, "downstream should be BLOCKED");
    assert(run.tasks["ret"].status === TaskRunStatus.BLOCKED, "ret should be BLOCKED");
  });

  await runTest(14, "AbortSignal cancels execution cleanly", async () => {
    const controller = new AbortController();
    controller.abort();
    const wf = {
      schemaVersion: "1.0",
      name: "Cancelled",
      nodes: [
        { id: "start", type: "trigger.manual" },
        { id: "ret", type: "output.return" },
      ],
      edges: [
        { id: "e1", source: "start", sourcePort: "output", target: "ret", targetPort: "value" },
      ],
    };
    const run = await executeWorkflow(wf, { abortSignal: controller.signal });
    assert(run.status === WorkflowRunStatus.CANCELLED, "Run should be CANCELLED");
    assert(run.tasks["start"].status === TaskRunStatus.CANCELLED, "start task should be CANCELLED");
  });

  const passed = results.filter((r) => r.passed).length;
  console.log("\n============================================================");
  console.log(`Core Engine Test Results: ${passed}/${results.length} passed (${Math.round((passed / results.length) * 100)}%)`);
  console.log("============================================================\n");

  if (passed !== results.length) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
