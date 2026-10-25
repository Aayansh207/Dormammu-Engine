/**
 * Webster Execution Engine - Comprehensive Unit & Engine Test Suite
 * Tests every node handler, validator rules, planner, and DAG scheduler.
 */

const assert = require("assert");
const { NodeRegistry, defaultRegistry } = require("./src/engine/registry/node.registry");
const { validateWorkflow } = require("./src/engine/validator/workflow.validator");
const { createExecutionPlan } = require("./src/engine/planner/execution.planner");
const { executeWorkflow, WorkflowRunStatus, TaskRunStatus } = require("./src/engine/scheduler/dag.scheduler");
const { ErrorCodes } = require("./src/engine/contracts/errors");
const { createExecutionContext } = require("./src/engine/contracts/context");

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

async function runWorkflowEngineTests() {
  console.log("\n=======================================================");
  console.log(" Webster Engine Unit & Integration Test Suite");
  console.log("=======================================================\n");

  console.log("--- 1. Node Handler Unit Tests (All 20 Nodes) ---");

  await test("trigger.manual: extracts triggerData payload", async () => {
    const nodeDef = defaultRegistry.get("trigger.manual");
    const ctx = createExecutionContext({ runId: "r1", taskId: "t1", nodeId: "n1", triggerData: 42 });
    const res = await nodeDef.handler({}, { config: {} }, ctx);
    assert.strictEqual(res.output, 42);
  });

  await test("trigger.manual: falls back to defaultPayload when no triggerData", async () => {
    const nodeDef = defaultRegistry.get("trigger.manual");
    const ctx = createExecutionContext({ runId: "r1", taskId: "t1", nodeId: "n1", triggerData: null });
    const res = await nodeDef.handler({}, { config: { defaultPayload: { foo: "bar" } } }, ctx);
    assert.deepStrictEqual(res.output, { foo: "bar" });
  });

  await test("data.input: extracts key from triggerData", async () => {
    const nodeDef = defaultRegistry.get("data.input");
    const ctx = createExecutionContext({ runId: "r1", taskId: "t1", nodeId: "n1", triggerData: { amount: 150 } });
    const res = await nodeDef.handler({}, { config: { key: "amount" } }, ctx);
    assert.strictEqual(res.output, 150);
  });

  await test("data.input: returns defaultValue if key is missing in triggerData", async () => {
    const nodeDef = defaultRegistry.get("data.input");
    const ctx = createExecutionContext({ runId: "r1", taskId: "t1", nodeId: "n1", triggerData: {} });
    const res = await nodeDef.handler({}, { config: { key: "missing", defaultValue: 99 } }, ctx);
    assert.strictEqual(res.output, 99);
  });

  await test("math.add: calculates sum of a and b or input + addend", async () => {
    const nodeDef = defaultRegistry.get("math.add");
    const res1 = await nodeDef.handler({ a: 10, b: 25 }, { config: {} });
    assert.strictEqual(res1.output, 35);

    const res2 = await nodeDef.handler({ input: 10 }, { config: { addend: 5 } });
    assert.strictEqual(res2.output, 15);
  });

  await test("math.subtract: calculates difference a - b or input - subtrahend", async () => {
    const nodeDef = defaultRegistry.get("math.subtract");
    const res = await nodeDef.handler({ a: 100, b: 30 }, { config: {} });
    assert.strictEqual(res.output, 70);

    const res2 = await nodeDef.handler({ input: 50 }, { config: { subtrahend: 15 } });
    assert.strictEqual(res2.output, 35);
  });

  await test("math.multiply: multiplies values or applies factor", async () => {
    const nodeDef = defaultRegistry.get("math.multiply");
    const res = await nodeDef.handler({ a: 6, b: 7 }, { config: {} });
    assert.strictEqual(res.output, 42);

    const res2 = await nodeDef.handler({ input: 8 }, { config: { factor: 5 } });
    assert.strictEqual(res2.output, 40);
  });

  await test("math.divide: performs division and rejects division by zero", async () => {
    const nodeDef = defaultRegistry.get("math.divide");
    const res = await nodeDef.handler({ a: 100, b: 4 }, { config: {} });
    assert.strictEqual(res.output, 25);

    await assert.rejects(
      async () => nodeDef.handler({ a: 10, b: 0 }, { id: "div1", config: {} }),
      (err) => err.code === ErrorCodes.DIVISION_BY_ZERO
    );
  });

  await test("math.modulo: computes remainder and rejects modulo by zero", async () => {
    const nodeDef = defaultRegistry.get("math.modulo");
    const res = await nodeDef.handler({ a: 17, b: 5 }, { config: {} });
    assert.strictEqual(res.output, 2);

    await assert.rejects(
      async () => nodeDef.handler({ a: 10, b: 0 }, { id: "mod1", config: {} }),
      (err) => err.code === ErrorCodes.DIVISION_BY_ZERO
    );
  });

  await test("math.power: computes base ^ exponent", async () => {
    const nodeDef = defaultRegistry.get("math.power");
    const res = await nodeDef.handler({ base: 2, exponent: 8 }, { config: {} });
    assert.strictEqual(res.output, 256);

    const res2 = await nodeDef.handler({ input: 3 }, { config: { exponent: 3 } });
    assert.strictEqual(res2.output, 27);
  });

  await test("math.round: handles precision and rounding modes (round, floor, ceil)", async () => {
    const nodeDef = defaultRegistry.get("math.round");
    const resRound = await nodeDef.handler({ value: 3.14159 }, { config: { precision: 2, mode: "round" } });
    assert.strictEqual(resRound.output, 3.14);

    const resFloor = await nodeDef.handler({ value: 3.89 }, { config: { precision: 0, mode: "floor" } });
    assert.strictEqual(resFloor.output, 3);

    const resCeil = await nodeDef.handler({ value: 3.11 }, { config: { precision: 0, mode: "ceil" } });
    assert.strictEqual(resCeil.output, 4);
  });

  await test("math.abs: returns absolute value of positive and negative numbers", async () => {
    const nodeDef = defaultRegistry.get("math.abs");
    const res1 = await nodeDef.handler({ value: -42 }, {});
    assert.strictEqual(res1.output, 42);
    const res2 = await nodeDef.handler({ value: 42 }, {});
    assert.strictEqual(res2.output, 42);
  });

  await test("math.min & math.max: correctly evaluate bounds", async () => {
    const minDef = defaultRegistry.get("math.min");
    const maxDef = defaultRegistry.get("math.max");

    const minRes = await minDef.handler({ a: 15, b: 8 }, { config: {} });
    assert.strictEqual(minRes.output, 8);

    const maxRes = await maxDef.handler({ a: 15, b: 8 }, { config: {} });
    assert.strictEqual(maxRes.output, 15);
  });

  await test("math.average: computes mean of provided values", async () => {
    const nodeDef = defaultRegistry.get("math.average");
    const res = await nodeDef.handler({ a: 10, b: 20 }, {});
    assert.strictEqual(res.output, 15);
  });

  await test("json.parse: parses valid JSON and throws structured INVALID_JSON error for invalid JSON", async () => {
    const nodeDef = defaultRegistry.get("json.parse");
    const res = await nodeDef.handler({ input: '{"name":"Webster","active":true}' }, { config: {} });
    assert.deepStrictEqual(res.output, { name: "Webster", active: true });

    await assert.rejects(
      async () => nodeDef.handler({ input: '{broken json' }, { id: "jp1", config: {} }),
      (err) => err.code === ErrorCodes.INVALID_JSON
    );
  });

  await test("json.get: extracts nested properties with dot and bracket notation", async () => {
    const nodeDef = defaultRegistry.get("json.get");
    const sourceObj = { user: { profile: { email: "test@dormammu.dev" }, items: [10, 20, 30] } };

    const res1 = await nodeDef.handler({ input: sourceObj, path: "user.profile.email" }, { config: {} });
    assert.strictEqual(res1.output, "test@dormammu.dev");

    const res2 = await nodeDef.handler({ input: sourceObj, path: "user.items[1]" }, { config: {} });
    assert.strictEqual(res2.output, 20);

    const resMissing = await nodeDef.handler({ input: sourceObj, path: "user.notFound" }, { config: { defaultValue: "fallback" } });
    assert.strictEqual(resMissing.output, "fallback");
  });

  await test("text.concat: combines strings with separator and suffix", async () => {
    const nodeDef = defaultRegistry.get("text.concat");
    const res = await nodeDef.handler({ a: "Hello", b: "World" }, { config: { separator: " ", suffix: "!" } });
    assert.strictEqual(res.output, "Hello World!");
  });

  await test("utility.uuid: generates valid RFC 4122 v4 UUID", async () => {
    const nodeDef = defaultRegistry.get("utility.uuid");
    const res = await nodeDef.handler({}, {});
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    assert.match(res.output, uuidRegex);
  });

  await test("utility.datetime: returns timestamp and formatted string", async () => {
    const nodeDef = defaultRegistry.get("utility.datetime");
    const res = await nodeDef.handler({}, { config: { format: "iso" } });
    assert.ok(typeof res.timestamp === "number");
    assert.ok(typeof res.output === "string");
    assert.ok(!isNaN(new Date(res.output).getTime()));
  });

  await test("output.log: logs message safely and passes output through", async () => {
    const nodeDef = defaultRegistry.get("output.log");
    const logBuffer = [];
    const ctx = createExecutionContext({
      runId: "r1",
      taskId: "t1",
      nodeId: "log1",
      logger: {
        info: (msg, data) => logBuffer.push({ msg, data }),
      },
    });

    const res = await nodeDef.handler({ input: { status: "ok" } }, { id: "log1", config: { level: "info" } }, ctx);
    assert.deepStrictEqual(res.output, { status: "ok" });
    assert.strictEqual(logBuffer.length, 1);
  });

  await test("output.return: extracts final workflow return value", async () => {
    const nodeDef = defaultRegistry.get("output.return");
    const res = await nodeDef.handler({ input: 12345 });
    assert.strictEqual(res.output, 12345);
  });

  console.log("\n--- 2. Validation & Graph Integrity Tests ---");

  await test("Validator: accepts valid linear workflow", async () => {
    const workflow = {
      schemaVersion: 1,
      name: "Linear Flow",
      nodes: [
        { id: "n1", type: "trigger.manual", version: 1, position: { x: 0, y: 0 }, config: {} },
        { id: "n2", type: "math.multiply", version: 1, position: { x: 200, y: 0 }, config: { factor: 3 } },
        { id: "n3", type: "output.return", version: 1, position: { x: 400, y: 0 }, config: {} },
      ],
      edges: [
        { id: "e1", source: "n1", sourcePort: "output", target: "n2", targetPort: "input" },
        { id: "e2", source: "n2", sourcePort: "output", target: "n3", targetPort: "input" },
      ],
    };

    const result = validateWorkflow(workflow, defaultRegistry);
    assert.strictEqual(result.valid, true);
    assert.strictEqual(result.errors.length, 0);
  });

  await test("Validator: detects self-loop and rejects with CYCLE_DETECTED", async () => {
    const workflow = {
      schemaVersion: 1,
      nodes: [
        { id: "n1", type: "trigger.manual", version: 1, config: {} },
      ],
      edges: [
        { id: "e1", source: "n1", sourcePort: "output", target: "n1", targetPort: "input" },
      ],
    };

    const result = validateWorkflow(workflow, defaultRegistry);
    assert.strictEqual(result.valid, false);
    assert.ok(result.errors.some((e) => e.code === ErrorCodes.CYCLE_DETECTED));
  });

  await test("Validator: detects multi-node cycle (A -> B -> C -> A)", async () => {
    const workflow = {
      schemaVersion: 1,
      nodes: [
        { id: "nA", type: "math.add", version: 1, config: {} },
        { id: "nB", type: "math.multiply", version: 1, config: {} },
        { id: "nC", type: "math.subtract", version: 1, config: {} },
      ],
      edges: [
        { id: "e1", source: "nA", sourcePort: "output", target: "nB", targetPort: "input" },
        { id: "e2", source: "nB", sourcePort: "output", target: "nC", targetPort: "input" },
        { id: "e3", source: "nC", sourcePort: "output", target: "nA", targetPort: "input" },
      ],
    };

    const result = validateWorkflow(workflow, defaultRegistry);
    assert.strictEqual(result.valid, false);
    assert.ok(result.errors.some((e) => e.code === ErrorCodes.CYCLE_DETECTED));
  });

  await test("Validator: detects nonexistent source and target nodes", async () => {
    const workflow = {
      schemaVersion: 1,
      nodes: [
        { id: "n1", type: "trigger.manual", version: 1, config: {} },
      ],
      edges: [
        { id: "e1", source: "n1", sourcePort: "output", target: "ghost_node", targetPort: "input" },
      ],
    };

    const result = validateWorkflow(workflow, defaultRegistry);
    assert.strictEqual(result.valid, false);
    assert.ok(result.errors.some((e) => e.code === ErrorCodes.EDGE_TARGET_NOT_FOUND));
  });

  await test("Validator: detects invalid configuration values", async () => {
    const workflow = {
      schemaVersion: 1,
      nodes: [
        { id: "n1", type: "math.divide", version: 1, config: { divisor: 0 } },
      ],
      edges: [],
    };

    const result = validateWorkflow(workflow, defaultRegistry);
    assert.strictEqual(result.valid, false);
    assert.ok(result.errors.some((e) => e.code === ErrorCodes.NODE_CONFIG_INVALID));
  });

  await test("Validator: detects unknown node types", async () => {
    const workflow = {
      schemaVersion: 1,
      nodes: [
        { id: "n1", type: "invalid.unknown_node_type", version: 1, config: {} },
      ],
      edges: [],
    };

    const result = validateWorkflow(workflow, defaultRegistry);
    assert.strictEqual(result.valid, false);
    assert.ok(result.errors.some((e) => e.code === ErrorCodes.UNKNOWN_NODE_TYPE));
  });

  console.log("\n--- 3. Sequential DAG Execution Engine Tests ---");

  await test("Scheduler: executes linear DAG and returns final value", async () => {
    const workflow = {
      schemaVersion: 1,
      name: "Multiply and Add Flow",
      nodes: [
        { id: "trigger_01", type: "trigger.manual", version: 1, config: {} },
        { id: "math_mult", type: "math.multiply", version: 1, config: { factor: 5 } },
        { id: "math_add", type: "math.add", version: 1, config: { addend: 10 } },
        { id: "out_01", type: "output.return", version: 1, config: {} },
      ],
      edges: [
        { id: "e1", source: "trigger_01", sourcePort: "output", target: "math_mult", targetPort: "input" },
        { id: "e2", source: "math_mult", sourcePort: "output", target: "math_add", targetPort: "input" },
        { id: "e3", source: "math_add", sourcePort: "output", target: "out_01", targetPort: "input" },
      ],
    };

    // Trigger with 10: 10 * 5 = 50; 50 + 10 = 60
    const summary = await executeWorkflow(workflow, { triggerData: 10 });
    assert.strictEqual(summary.status, WorkflowRunStatus.SUCCEEDED);
    assert.strictEqual(summary.finalOutput, 60);
    assert.strictEqual(summary.tasks.trigger_01.status, TaskRunStatus.SUCCEEDED);
    assert.strictEqual(summary.tasks.math_mult.status, TaskRunStatus.SUCCEEDED);
    assert.strictEqual(summary.tasks.math_add.status, TaskRunStatus.SUCCEEDED);
    assert.strictEqual(summary.tasks.out_01.status, TaskRunStatus.SUCCEEDED);
  });

  await test("Scheduler: executes branching and joining DAG with multiple predecessors", async () => {
    // Flow:
    // start (10)
    // branch1: math.multiply by 2 (= 20)
    // branch2: math.multiply by 3 (= 30)
    // join: math.add (a: 20, b: 30) = 50
    // return (50)
    const workflow = {
      schemaVersion: 1,
      name: "Branch & Join",
      nodes: [
        { id: "start", type: "trigger.manual", version: 1, config: {} },
        { id: "b1", type: "math.multiply", version: 1, config: { factor: 2 } },
        { id: "b2", type: "math.multiply", version: 1, config: { factor: 3 } },
        { id: "join", type: "math.add", version: 1, config: {} },
        { id: "ret", type: "output.return", version: 1, config: {} },
      ],
      edges: [
        { id: "e1", source: "start", sourcePort: "output", target: "b1", targetPort: "input" },
        { id: "e2", source: "start", sourcePort: "output", target: "b2", targetPort: "input" },
        { id: "e3", source: "b1", sourcePort: "output", target: "join", targetPort: "a" },
        { id: "e4", source: "b2", sourcePort: "output", target: "join", targetPort: "b" },
        { id: "e5", source: "join", sourcePort: "output", target: "ret", targetPort: "input" },
      ],
    };

    const summary = await executeWorkflow(workflow, { triggerData: 10 });
    assert.strictEqual(summary.status, WorkflowRunStatus.SUCCEEDED);
    assert.strictEqual(summary.finalOutput, 50);
  });

  await test("Scheduler: produces identical deterministic results regardless of node/edge array order", async () => {
    const wfNormal = {
      schemaVersion: 1,
      nodes: [
        { id: "A", type: "trigger.manual", version: 1, config: {} },
        { id: "B", type: "math.add", version: 1, config: { addend: 5 } },
        { id: "C", type: "math.multiply", version: 1, config: { factor: 2 } },
        { id: "D", type: "output.return", version: 1, config: {} },
      ],
      edges: [
        { id: "e1", source: "A", sourcePort: "output", target: "B", targetPort: "input" },
        { id: "e2", source: "B", sourcePort: "output", target: "C", targetPort: "input" },
        { id: "e3", source: "C", sourcePort: "output", target: "D", targetPort: "input" },
      ],
    };

    const wfShuffled = {
      schemaVersion: 1,
      nodes: [
        { id: "C", type: "math.multiply", version: 1, config: { factor: 2 } },
        { id: "D", type: "output.return", version: 1, config: {} },
        { id: "A", type: "trigger.manual", version: 1, config: {} },
        { id: "B", type: "math.add", version: 1, config: { addend: 5 } },
      ],
      edges: [
        { id: "e3", source: "C", sourcePort: "output", target: "D", targetPort: "input" },
        { id: "e1", source: "A", sourcePort: "output", target: "B", targetPort: "input" },
        { id: "e2", source: "B", sourcePort: "output", target: "C", targetPort: "input" },
      ],
    };

    const sum1 = await executeWorkflow(wfNormal, { triggerData: 10 });
    const sum2 = await executeWorkflow(wfShuffled, { triggerData: 10 });

    assert.strictEqual(sum1.finalOutput, (10 + 5) * 2);
    assert.strictEqual(sum2.finalOutput, (10 + 5) * 2);
    assert.strictEqual(sum1.status, sum2.status);
  });

  await test("Scheduler: fail-fast marks downstream nodes as BLOCKED on node failure", async () => {
    // start (10) -> zero (subtract 10 - 10 = 0) -> divide.b
    // start (10) -> divide.input / zero.output -> throws DIVISION_BY_ZERO -> downstream BLOCKED
    const workflow = {
      schemaVersion: 1,
      name: "Failure Cascade Test",
      nodes: [
        { id: "start", type: "trigger.manual", version: 1, config: {} },
        { id: "zero_node", type: "math.subtract", version: 1, config: { subtrahend: 10 } },
        { id: "bad_divide", type: "math.divide", version: 1, config: {} },
        { id: "downstream", type: "math.add", version: 1, config: { addend: 10 } },
        { id: "ret", type: "output.return", version: 1, config: {} },
      ],
      edges: [
        { id: "e1", source: "start", sourcePort: "output", target: "zero_node", targetPort: "input" },
        { id: "e2", source: "start", sourcePort: "output", target: "bad_divide", targetPort: "input" },
        { id: "e3", source: "zero_node", sourcePort: "output", target: "bad_divide", targetPort: "b" },
        { id: "e4", source: "bad_divide", sourcePort: "output", target: "downstream", targetPort: "input" },
        { id: "e5", source: "downstream", sourcePort: "output", target: "ret", targetPort: "input" },
      ],
    };

    const summary = await executeWorkflow(workflow, {
      triggerData: 10,
    });

    assert.strictEqual(summary.status, WorkflowRunStatus.FAILED);
    assert.strictEqual(summary.tasks.bad_divide.status, TaskRunStatus.FAILED);
    assert.strictEqual(summary.tasks.bad_divide.error.code, ErrorCodes.DIVISION_BY_ZERO);
    assert.strictEqual(summary.tasks.downstream.status, TaskRunStatus.BLOCKED);
    assert.strictEqual(summary.tasks.ret.status, TaskRunStatus.BLOCKED);
  });

  await test("Scheduler: respects cancellation signal and marks unstarted tasks CANCELLED", async () => {
    const workflow = {
      schemaVersion: 1,
      nodes: [
        { id: "n1", type: "trigger.manual", version: 1, config: {} },
        { id: "n2", type: "math.multiply", version: 1, config: { factor: 2 } },
      ],
      edges: [
        { id: "e1", source: "n1", sourcePort: "output", target: "n2", targetPort: "input" },
      ],
    };

    const controller = new AbortController();
    controller.abort(); // already aborted

    const summary = await executeWorkflow(workflow, { abortSignal: controller.signal });
    assert.strictEqual(summary.status, WorkflowRunStatus.CANCELLED);
    assert.ok(summary.tasks.n1.status === TaskRunStatus.CANCELLED || summary.tasks.n2.status === TaskRunStatus.CANCELLED);
  });

  console.log("\n-------------------------------------------------------");
  console.log(` Results: ${passed} passed, ${failed} failed`);
  console.log("-------------------------------------------------------\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runWorkflowEngineTests().catch((err) => {
  console.error("Unhandled error in test runner:", err);
  process.exit(1);
});
