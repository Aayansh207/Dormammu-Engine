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

  await test("trigger.manual: extracts targeted payload when multiple triggers exist", async () => {
    const nodeDef = defaultRegistry.get("trigger.manual");
    const multiPayload = {
      $multiTrigger: true,
      trig_orders: { orderId: "ord_101", total: 499 },
      trig_users: { userId: "usr_55", name: "Alice" },
    };

    // Test targeted by node.id
    const ctx1 = createExecutionContext({ runId: "r1", taskId: "t1", nodeId: "trig_orders", triggerData: multiPayload });
    const res1 = await nodeDef.handler({}, { id: "trig_orders", config: {} }, ctx1);
    assert.deepStrictEqual(res1.output, { orderId: "ord_101", total: 499 });

    // Test targeted by node.config.triggerKey
    const ctx2 = createExecutionContext({ runId: "r1", taskId: "t2", nodeId: "custom_node", triggerData: multiPayload });
    const res2 = await nodeDef.handler({}, { id: "custom_node", config: { triggerKey: "trig_users" } }, ctx2);
    assert.deepStrictEqual(res2.output, { userId: "usr_55", name: "Alice" });

    // Test fallback to defaultPayload when not in multi-trigger map
    const ctx3 = createExecutionContext({ runId: "r1", taskId: "t3", nodeId: "trig_other", triggerData: multiPayload });
    const res3 = await nodeDef.handler({}, { id: "trig_other", config: { defaultPayload: "fallback_val" } }, ctx3);
    assert.strictEqual(res3.output, "fallback_val");
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

  // --- New Production Node Handler Tests ---
  await test("logic.condition: evaluates equality, inequality, numbers, and emits active branch port", async () => {
    const nodeDef = defaultRegistry.get("logic.condition");

    // Test true condition: 10 > 5 -> emits 'true' and 'output: true'
    const resTrue = await nodeDef.handler({ a: 10, b: 5 }, { config: { operator: ">" } });
    assert.strictEqual(resTrue.output, true);
    assert.strictEqual(resTrue.true, 10);
    assert.strictEqual(resTrue.false, undefined);

    // Test false condition: 2 > 5 -> emits 'false' and 'output: false'
    const resFalse = await nodeDef.handler({ a: 2, b: 5 }, { config: { operator: ">" } });
    assert.strictEqual(resFalse.output, false);
    assert.strictEqual(resFalse.false, 2);
    assert.strictEqual(resFalse.true, undefined);

    // Test equality and passThrough: false
    const resEq = await nodeDef.handler({ a: "apple", b: "apple" }, { config: { operator: "===", passThrough: false } });
    assert.strictEqual(resEq.output, true);
    assert.strictEqual(resEq.true, true);
  });

  await test("logic.condition: handles falsy/truthy/empty/contains and rejects invalid operator", async () => {
    const nodeDef = defaultRegistry.get("logic.condition");

    // Test empty
    const resEmpty = await nodeDef.handler({ a: [] }, { config: { operator: "empty" } });
    assert.strictEqual(resEmpty.output, true);

    // Test contains
    const resContains = await nodeDef.handler({ a: "workflow automation", b: "automation" }, { config: { operator: "contains" } });
    assert.strictEqual(resContains.output, true);

    // Test invalid operator
    await assert.rejects(
      async () => nodeDef.handler({ a: 1, b: 2 }, { config: { operator: "invalid_op" } }),
      (err) => err.code === ErrorCodes.INVALID_CONDITION_OPERATOR
    );
  });

  await test("logic.switch: routes to matching case branch and default branch", async () => {
    const nodeDef = defaultRegistry.get("logic.switch");
    const cases = [
      { case: "urgent", port: "urgent" },
      { case: "billing", port: "billing" },
    ];

    // Matched case 'billing'
    const resMatch = await nodeDef.handler({ input: "billing" }, { config: { cases } });
    assert.strictEqual(resMatch.billing, "billing");
    assert.strictEqual(resMatch.output, "billing");
    assert.strictEqual(resMatch.urgent, undefined);
    assert.strictEqual(resMatch.default, undefined);

    // Unmatched case -> routes to 'default'
    const resDefault = await nodeDef.handler({ input: "unknown_topic" }, { config: { cases } });
    assert.strictEqual(resDefault.default, "unknown_topic");
    assert.strictEqual(resDefault.output, "default");
    assert.strictEqual(resDefault.urgent, undefined);
    assert.strictEqual(resDefault.billing, undefined);
  });

  await test("flow.merge: merges multiple branches in first_available, all, and coalesce modes", async () => {
    const nodeDef = defaultRegistry.get("flow.merge");

    // first_available mode
    const resFirst = await nodeDef.handler({ input: [undefined, "firstVal", "secondVal"] }, { config: { mode: "first_available" } });
    assert.strictEqual(resFirst.output, "firstVal");

    // coalesce mode (skips null/undefined)
    const resCoalesce = await nodeDef.handler({ input: [null, undefined, 42] }, { config: { mode: "coalesce" } });
    assert.strictEqual(resCoalesce.output, 42);

    // all mode
    const resAll = await nodeDef.handler({ a: "alpha", b: "beta" }, { config: { mode: "all" } });
    assert.deepStrictEqual(resAll.output, ["alpha", "beta"]);

    // object mode
    const resObj = await nodeDef.handler({ input: [{ id: 1 }, { name: "Alice" }] }, { config: { mode: "object" } });
    assert.deepStrictEqual(resObj.output, { id: 1, name: "Alice" });
  });

  await test("flow.delay: pauses execution for durationMs and respects AbortSignal cancellation", async () => {
    const nodeDef = defaultRegistry.get("flow.delay");

    // Fast delay
    const start = Date.now();
    const res = await nodeDef.handler({ input: "delayedData" }, { config: { durationMs: 20 } });
    assert.strictEqual(res.output, "delayedData");
    assert.ok(Date.now() - start >= 15);

    // Invalid durationMs
    await assert.rejects(
      async () => nodeDef.handler({}, { config: { durationMs: -100 } }),
      (err) => err.code === ErrorCodes.DELAY_DURATION_INVALID
    );

    // Cancelled delay
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 10);
    const ctx = createExecutionContext({ runId: "r1", taskId: "t1", nodeId: "d1", abortSignal: controller.signal });
    await assert.rejects(
      async () => nodeDef.handler({}, { config: { durationMs: 5000 } }, ctx),
      (err) => err.code === ErrorCodes.EXECUTION_CANCELLED
    );
  });

  await test("data.object: constructs nested objects, preserves falsy values, blocks prototype pollution", async () => {
    const nodeDef = defaultRegistry.get("data.object");

    // Construct nested object preserving falsy values (0, false, "")
    const fields = [
      { key: "user.id", value: 101 },
      { key: "user.flags.active", value: false },
      { key: "user.score", value: 0 },
      { key: "user.notes", value: "" },
    ];
    const res = await nodeDef.handler({}, { config: { fields } });
    assert.deepStrictEqual(res.output, {
      user: {
        id: 101,
        flags: { active: false },
        score: 0,
        notes: "",
      },
    });

    // Block prototype pollution
    await assert.rejects(
      async () => nodeDef.handler({}, { config: { fields: [{ key: "__proto__.polluted", value: true }] } }),
      (err) => err.code === ErrorCodes.DATA_OBJECT_INVALID_KEY
    );
  });

  await test("data.array.map: maps array items with safe operations and validates array type", async () => {
    const nodeDef = defaultRegistry.get("data.array.map");

    // extract_field
    const items = [{ name: "Alice", age: 30 }, { name: "Bob", age: 25 }];
    const resExtract = await nodeDef.handler({ input: items }, { config: { operation: "extract_field", field: "name" } });
    assert.deepStrictEqual(resExtract.output, ["Alice", "Bob"]);

    // to_uppercase
    const resUpper = await nodeDef.handler({ input: ["apple", "banana"] }, { config: { operation: "to_uppercase" } });
    assert.deepStrictEqual(resUpper.output, ["APPLE", "BANANA"]);

    // math_multiply
    const resMath = await nodeDef.handler({ input: [1, 2, 3] }, { config: { operation: "math_multiply", operand: 10 } });
    assert.deepStrictEqual(resMath.output, [10, 20, 30]);

    // Reject non-array input
    await assert.rejects(
      async () => nodeDef.handler({ input: "not an array" }, { config: { operation: "extract_field", field: "x" } }),
      (err) => err.code === ErrorCodes.ARRAY_MAP_INVALID_INPUT
    );
  });

  await test("text.template: renders {{variable}} templates, handles missing variables, escapes HTML", async () => {
    const nodeDef = defaultRegistry.get("text.template");

    // Valid interpolation with dot notation
    const data = { user: { name: "Antigravity", role: "AI Assistant" } };
    const res = await nodeDef.handler(
      { input: data },
      { config: { template: "Welcome {{user.name}}! Role: {{user.role}}" } }
    );
    assert.strictEqual(res.output, "Welcome Antigravity! Role: AI Assistant");

    // Missing variable with 'empty' policy
    const resEmpty = await nodeDef.handler(
      { input: {} },
      { config: { template: "Missing: [{{missingVal}}]", missingVariablePolicy: "empty" } }
    );
    assert.strictEqual(resEmpty.output, "Missing: []");

    // Missing variable with 'error' policy
    await assert.rejects(
      async () => nodeDef.handler({ input: {} }, { config: { template: "{{missing}}", missingVariablePolicy: "error" } }),
      (err) => err.code === ErrorCodes.TEMPLATE_SYNTAX_ERROR
    );

    // Syntax error: unclosed tag
    await assert.rejects(
      async () => nodeDef.handler({ input: {} }, { config: { template: "Hello {{unclosed" } }),
      (err) => err.code === ErrorCodes.TEMPLATE_SYNTAX_ERROR
    );
  });

  await test("http.request: enforces SSRF protection against private CIDRs and localhost", async () => {
    const nodeDef = defaultRegistry.get("http.request");

    // SSRF: localhost blocked
    await assert.rejects(
      async () => nodeDef.handler({ url: "http://localhost:8080/admin" }, { config: {} }),
      (err) => err.code === ErrorCodes.SSRF_BLOCKED
    );

    // SSRF: 127.0.0.1 blocked
    await assert.rejects(
      async () => nodeDef.handler({ url: "http://127.0.0.1:3000/api" }, { config: {} }),
      (err) => err.code === ErrorCodes.SSRF_BLOCKED
    );

    // SSRF: Cloud metadata link-local IP 169.254.169.254 blocked
    await assert.rejects(
      async () => nodeDef.handler({ url: "http://169.254.169.254/latest/meta-data/" }, { config: {} }),
      (err) => err.code === ErrorCodes.SSRF_BLOCKED
    );

    // SSRF: Unsupported protocol (e.g. ftp, file, gopher)
    await assert.rejects(
      async () => nodeDef.handler({ url: "ftp://files.example.com/dump.sql" }, { config: {} }),
      (err) => err.code === ErrorCodes.SSRF_BLOCKED
    );

    // Private network access requires server policy authorization
    const prevEnv = process.env.ALLOW_PRIVATE_NETWORK_REQUESTS;
    delete process.env.ALLOW_PRIVATE_NETWORK_REQUESTS;
    try {
      await assert.rejects(
        async () => nodeDef.handler({ url: "http://127.0.0.1:3000/api" }, { config: { allowPrivateNetwork: true } }),
        (err) => err.code === ErrorCodes.UNAUTHORIZED
      );
    } finally {
      if (prevEnv) process.env.ALLOW_PRIVATE_NETWORK_REQUESTS = prevEnv;
    }
  });

  await test("http.respond: produces simulated response in manual execution context", async () => {
    const nodeDef = defaultRegistry.get("http.respond");

    const res = await nodeDef.handler({ body: { success: true }, status: 201 }, { config: {} });
    assert.strictEqual(res.output.delivered, false);
    assert.strictEqual(res.output.simulated, true);
    assert.strictEqual(res.output.statusCode, 201);
    assert.deepStrictEqual(res.output.body, { success: true });
  });

  await test("ai.classify: classifies text with categories, confidence, reasoning, and transparent mode", async () => {
    const nodeDef = defaultRegistry.get("ai.classify");

    const res = await nodeDef.handler(
      { text: "Production server is down with severe database connection errors!" },
      { config: { categories: ["urgent", "general", "billing"] } }
    );
    assert.strictEqual(res.output, "urgent");
    assert.strictEqual(res.category, "urgent");
    assert.ok(typeof res.confidence === "number");
    assert.ok(typeof res.reasoning === "string");
    assert.ok(["live", "demo"].includes(res.mode));
    assert.ok(res.provider);
    assert.ok(res._aiExecution && typeof res._aiExecution === "object");
  });

  await test("ai.provider: supports xAI Grok provider abstraction and validates credentials", async () => {
    const { callGrok, executeAiTask } = require("./src/engine/providers/ai.provider");
    assert.strictEqual(typeof callGrok, "function");

    // When Grok is explicitly requested without GROK_API_KEY or XAI_API_KEY, strictly rejects
    const prevGrok = process.env.GROK_API_KEY;
    const prevXai = process.env.XAI_API_KEY;
    delete process.env.GROK_API_KEY;
    delete process.env.XAI_API_KEY;

    try {
      await assert.rejects(
        async () => executeAiTask("classify", { text: "server down", categories: ["urgent", "general"] }, { provider: "grok" }),
        (err) => err.code === ErrorCodes.AI_PROVIDER_ERROR
      );
    } finally {
      if (prevGrok) process.env.GROK_API_KEY = prevGrok;
      if (prevXai) process.env.XAI_API_KEY = prevXai;
    }
  });

  await test("ai.extract & ai.summarize: extracts structured entities and produces summaries", async () => {
    const extractDef = defaultRegistry.get("ai.extract");
    const summarizeDef = defaultRegistry.get("ai.summarize");

    // Extract
    const resExtract = await extractDef.handler(
      { text: "Ticket from Alice Smith regarding urgent billing question" },
      { config: { schema: { customerName: "string", priority: "string" } } }
    );
    assert.ok(typeof resExtract.output === "object");
    assert.strictEqual(resExtract.output.priority, "high");

    // Summarize
    const resSummary = await summarizeDef.handler(
      { text: "User reported payment issue. System verified account status. Invoice was regenerated and sent." },
      { config: { format: "paragraph", maxLength: 200 } }
    );
    assert.ok(typeof resSummary.output === "string");
    assert.ok(Array.isArray(resSummary.keyPoints));
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

  await test("Scheduler: executes workflow with multiple manual triggers", async () => {
    const workflow = {
      schemaVersion: 1,
      name: "Dual Trigger Workflow",
      nodes: [
        { id: "trig_a", type: "trigger.manual", version: 1, config: {} },
        { id: "trig_b", type: "trigger.manual", version: 1, config: {} },
        { id: "join_add", type: "math.add", version: 1, config: {} },
        { id: "ret", type: "output.return", version: 1, config: {} },
      ],
      edges: [
        { id: "e1", source: "trig_a", sourcePort: "output", target: "join_add", targetPort: "a" },
        { id: "e2", source: "trig_b", sourcePort: "output", target: "join_add", targetPort: "b" },
        { id: "e3", source: "join_add", sourcePort: "output", target: "ret", targetPort: "input" },
      ],
    };

    const multiPayload = {
      $multiTrigger: true,
      trig_a: 15,
      trig_b: 25,
    };

    const summary = await executeWorkflow(workflow, { triggerData: multiPayload });
    assert.strictEqual(summary.status, WorkflowRunStatus.SUCCEEDED);
    assert.strictEqual(summary.finalOutput, 40);
    assert.strictEqual(summary.tasks.trig_a.outputs.output, 15);
    assert.strictEqual(summary.tasks.trig_b.outputs.output, 25);
  });

  console.log("\n--- 4. Control-Flow & Branching DAG Scheduler Tests ---");

  await test("Scheduler: conditional branch routes execution down TRUE branch and cascades SKIPPED down FALSE branch", async () => {
    const workflow = {
      schemaVersion: 1,
      name: "Condition True Branch Test",
      nodes: [
        { id: "trig", type: "trigger.manual", version: 1, config: {} },
        { id: "cond", type: "logic.condition", version: 1, config: { operator: ">", value: 50 } },
        { id: "step_true", type: "math.multiply", version: 1, config: { factor: 2 } },
        { id: "ret_true", type: "output.return", version: 1, config: {} },
        { id: "step_false", type: "math.multiply", version: 1, config: { factor: 3 } },
        { id: "ret_false", type: "output.return", version: 1, config: {} },
      ],
      edges: [
        { id: "e1", source: "trig", sourcePort: "output", target: "cond", targetPort: "a" },
        { id: "e2", source: "cond", sourcePort: "true", target: "step_true", targetPort: "input" },
        { id: "e3", source: "step_true", sourcePort: "output", target: "ret_true", targetPort: "input" },
        { id: "e4", source: "cond", sourcePort: "false", target: "step_false", targetPort: "input" },
        { id: "e5", source: "step_false", sourcePort: "output", target: "ret_false", targetPort: "input" },
      ],
    };

    const summary = await executeWorkflow(workflow, { triggerData: 100 });
    assert.strictEqual(summary.status, WorkflowRunStatus.SUCCEEDED);
    assert.strictEqual(summary.tasks.cond.status, TaskRunStatus.SUCCEEDED);
    assert.strictEqual(summary.tasks.step_true.status, TaskRunStatus.SUCCEEDED);
    assert.strictEqual(summary.tasks.ret_true.status, TaskRunStatus.SUCCEEDED);
    assert.strictEqual(summary.tasks.step_false.status, TaskRunStatus.SKIPPED);
    assert.strictEqual(summary.tasks.ret_false.status, TaskRunStatus.SKIPPED);
    assert.strictEqual(summary.finalOutput, 200);
  });

  await test("Scheduler: conditional branch routes execution down FALSE branch and cascades SKIPPED down TRUE branch", async () => {
    const workflow = {
      schemaVersion: 1,
      name: "Condition False Branch Test",
      nodes: [
        { id: "trig", type: "trigger.manual", version: 1, config: {} },
        { id: "cond", type: "logic.condition", version: 1, config: { operator: ">", value: 50 } },
        { id: "step_true", type: "math.multiply", version: 1, config: { factor: 2 } },
        { id: "ret_true", type: "output.return", version: 1, config: {} },
        { id: "step_false", type: "math.multiply", version: 1, config: { factor: 3 } },
        { id: "ret_false", type: "output.return", version: 1, config: {} },
      ],
      edges: [
        { id: "e1", source: "trig", sourcePort: "output", target: "cond", targetPort: "a" },
        { id: "e2", source: "cond", sourcePort: "true", target: "step_true", targetPort: "input" },
        { id: "e3", source: "step_true", sourcePort: "output", target: "ret_true", targetPort: "input" },
        { id: "e4", source: "cond", sourcePort: "false", target: "step_false", targetPort: "input" },
        { id: "e5", source: "step_false", sourcePort: "output", target: "ret_false", targetPort: "input" },
      ],
    };

    const summary = await executeWorkflow(workflow, { triggerData: 20 });
    assert.strictEqual(summary.status, WorkflowRunStatus.SUCCEEDED);
    assert.strictEqual(summary.tasks.cond.status, TaskRunStatus.SUCCEEDED);
    assert.strictEqual(summary.tasks.step_true.status, TaskRunStatus.SKIPPED);
    assert.strictEqual(summary.tasks.ret_true.status, TaskRunStatus.SKIPPED);
    assert.strictEqual(summary.tasks.step_false.status, TaskRunStatus.SUCCEEDED);
    assert.strictEqual(summary.tasks.ret_false.status, TaskRunStatus.SUCCEEDED);
    assert.strictEqual(summary.finalOutput, 60);
  });

  await test("Scheduler: switch routes execution to matching case and cascades SKIPPED on unselected cases", async () => {
    const cases = [
      { case: "urgent", port: "urgent" },
      { case: "billing", port: "billing" },
    ];
    const workflow = {
      schemaVersion: 1,
      name: "Switch Routing Test",
      nodes: [
        { id: "trig", type: "trigger.manual", version: 1, config: {} },
        { id: "sw", type: "logic.switch", version: 1, config: { cases } },
        { id: "task_urgent", type: "text.concat", version: 1, config: { suffix: "_priority" } },
        { id: "task_billing", type: "text.concat", version: 1, config: { suffix: "_processed" } },
        { id: "task_default", type: "text.concat", version: 1, config: { suffix: "_unhandled" } },
        { id: "ret", type: "output.return", version: 1, config: {} },
      ],
      edges: [
        { id: "e1", source: "trig", sourcePort: "output", target: "sw", targetPort: "input" },
        { id: "e2", source: "sw", sourcePort: "urgent", target: "task_urgent", targetPort: "a" },
        { id: "e3", source: "sw", sourcePort: "billing", target: "task_billing", targetPort: "a" },
        { id: "e4", source: "sw", sourcePort: "default", target: "task_default", targetPort: "a" },
        { id: "e5", source: "task_billing", sourcePort: "output", target: "ret", targetPort: "input" },
      ],
    };

    const summary = await executeWorkflow(workflow, { triggerData: "billing" });
    assert.strictEqual(summary.status, WorkflowRunStatus.SUCCEEDED);
    assert.strictEqual(summary.tasks.sw.status, TaskRunStatus.SUCCEEDED);
    assert.strictEqual(summary.tasks.task_billing.status, TaskRunStatus.SUCCEEDED);
    assert.strictEqual(summary.tasks.ret.status, TaskRunStatus.SUCCEEDED);
    assert.strictEqual(summary.tasks.task_urgent.status, TaskRunStatus.SKIPPED);
    assert.strictEqual(summary.tasks.task_default.status, TaskRunStatus.SKIPPED);
    assert.strictEqual(summary.finalOutput, "billing_processed");
  });

  await test("Scheduler: flow.merge joins active branch when alternative branch was skipped", async () => {
    const workflow = {
      schemaVersion: 1,
      name: "Merge Converging Branches Test",
      nodes: [
        { id: "trig", type: "trigger.manual", version: 1, config: {} },
        { id: "cond", type: "logic.condition", version: 1, config: { operator: ">", value: 50 } },
        { id: "task_true", type: "math.add", version: 1, config: { addend: 10 } },
        { id: "task_false", type: "math.add", version: 1, config: { addend: 20 } },
        { id: "merge", type: "flow.merge", version: 1, config: { mode: "first_available" } },
        { id: "ret", type: "output.return", version: 1, config: {} },
      ],
      edges: [
        { id: "e1", source: "trig", sourcePort: "output", target: "cond", targetPort: "a" },
        { id: "e2", source: "cond", sourcePort: "true", target: "task_true", targetPort: "a" },
        { id: "e3", source: "cond", sourcePort: "false", target: "task_false", targetPort: "a" },
        { id: "e4", source: "task_true", sourcePort: "output", target: "merge", targetPort: "input" },
        { id: "e5", source: "task_false", sourcePort: "output", target: "merge", targetPort: "input" },
        { id: "e6", source: "merge", sourcePort: "output", target: "ret", targetPort: "input" },
      ],
    };

    const summary = await executeWorkflow(workflow, { triggerData: 100 });
    assert.strictEqual(summary.status, WorkflowRunStatus.SUCCEEDED);
    assert.strictEqual(summary.tasks.task_true.status, TaskRunStatus.SUCCEEDED);
    assert.strictEqual(summary.tasks.task_false.status, TaskRunStatus.SKIPPED);
    assert.strictEqual(summary.tasks.merge.status, TaskRunStatus.SUCCEEDED);
    assert.strictEqual(summary.tasks.ret.status, TaskRunStatus.SUCCEEDED);
    assert.strictEqual(summary.finalOutput, 110);
  });

  await test("Scheduler: flow.merge in 'all' and 'object' modes cleanly joins active branch when alternative is skipped", async () => {
    // 1. 'all' mode: collects values from all active branches after resolution
    const workflowAll = {
      schemaVersion: 1,
      name: "Merge All Mode Branch Test",
      nodes: [
        { id: "trig", type: "trigger.manual", version: 1, config: {} },
        { id: "cond", type: "logic.condition", version: 1, config: { operator: ">", value: 50 } },
        { id: "task_true", type: "math.add", version: 1, config: { addend: 10 } },
        { id: "task_false", type: "math.add", version: 1, config: { addend: 20 } },
        { id: "merge", type: "flow.merge", version: 1, config: { mode: "all" } },
        { id: "ret", type: "output.return", version: 1, config: {} },
      ],
      edges: [
        { id: "e1", source: "trig", sourcePort: "output", target: "cond", targetPort: "a" },
        { id: "e2", source: "cond", sourcePort: "true", target: "task_true", targetPort: "a" },
        { id: "e3", source: "cond", sourcePort: "false", target: "task_false", targetPort: "a" },
        { id: "e4", source: "task_true", sourcePort: "output", target: "merge", targetPort: "input" },
        { id: "e5", source: "task_false", sourcePort: "output", target: "merge", targetPort: "input" },
        { id: "e6", source: "merge", sourcePort: "output", target: "ret", targetPort: "input" },
      ],
    };

    const summaryAll = await executeWorkflow(workflowAll, { triggerData: 100 });
    assert.strictEqual(summaryAll.status, WorkflowRunStatus.SUCCEEDED);
    assert.strictEqual(summaryAll.tasks.task_true.status, TaskRunStatus.SUCCEEDED);
    assert.strictEqual(summaryAll.tasks.task_false.status, TaskRunStatus.SKIPPED);
    assert.strictEqual(summaryAll.tasks.merge.status, TaskRunStatus.SUCCEEDED);
    assert.deepStrictEqual(summaryAll.finalOutput, [110]);

    // 2. 'object' mode: merges active branch objects after resolution
    const workflowObj = {
      schemaVersion: 1,
      name: "Merge Object Mode Branch Test",
      nodes: [
        { id: "trig", type: "trigger.manual", version: 1, config: {} },
        { id: "cond", type: "logic.condition", version: 1, config: { operator: ">", value: 50 } },
        { id: "task_true", type: "data.object", version: 1, config: { fields: [{ key: "status", value: "active" }, { key: "score", value: 100 }] } },
        { id: "task_false", type: "data.object", version: 1, config: { fields: [{ key: "status", value: "inactive" }] } },
        { id: "merge", type: "flow.merge", version: 1, config: { mode: "object" } },
        { id: "ret", type: "output.return", version: 1, config: {} },
      ],
      edges: [
        { id: "e1", source: "trig", sourcePort: "output", target: "cond", targetPort: "a" },
        { id: "e2", source: "cond", sourcePort: "true", target: "task_true", targetPort: "input" },
        { id: "e3", source: "cond", sourcePort: "false", target: "task_false", targetPort: "input" },
        { id: "e4", source: "task_true", sourcePort: "output", target: "merge", targetPort: "input" },
        { id: "e5", source: "task_false", sourcePort: "output", target: "merge", targetPort: "input" },
        { id: "e6", source: "merge", sourcePort: "output", target: "ret", targetPort: "input" },
      ],
    };

    const summaryObj = await executeWorkflow(workflowObj, { triggerData: 100 });
    assert.strictEqual(summaryObj.status, WorkflowRunStatus.SUCCEEDED);
    assert.strictEqual(summaryObj.tasks.task_true.status, TaskRunStatus.SUCCEEDED);
    assert.strictEqual(summaryObj.tasks.task_false.status, TaskRunStatus.SKIPPED);
    assert.strictEqual(summaryObj.tasks.merge.status, TaskRunStatus.SUCCEEDED);
    assert.deepStrictEqual(summaryObj.finalOutput, { status: "active", score: 100 });
  });

  await test("Scheduler: non-blocking delay pauses workflow and resumes downstream execution", async () => {
    const workflow = {
      schemaVersion: 1,
      name: "Delay Execution Test",
      nodes: [
        { id: "trig", type: "trigger.manual", version: 1, config: {} },
        { id: "delay", type: "flow.delay", version: 1, config: { durationMs: 30 } },
        { id: "ret", type: "output.return", version: 1, config: {} },
      ],
      edges: [
        { id: "e1", source: "trig", sourcePort: "output", target: "delay", targetPort: "input" },
        { id: "e2", source: "delay", sourcePort: "output", target: "ret", targetPort: "input" },
      ],
    };

    const summary = await executeWorkflow(workflow, { triggerData: "hello_dormammu" });
    assert.strictEqual(summary.status, WorkflowRunStatus.SUCCEEDED);
    assert.strictEqual(summary.finalOutput, "hello_dormammu");
    assert.ok(summary.durationMs >= 25);
  });

  await test("Scheduler: end-to-end execution of AI Support-Ticket Triage workflow with branching and merging", async () => {
    const triageWorkflow = require("./workflows/ai_support_triage_workflow.json");
    const samplePayload = triageWorkflow.samplePayload;

    const summary = await executeWorkflow(triageWorkflow, { triggerData: samplePayload });
    assert.strictEqual(summary.status, WorkflowRunStatus.SUCCEEDED);
    assert.strictEqual(summary.tasks.trig_ticket.status, TaskRunStatus.SUCCEEDED);
    assert.strictEqual(summary.tasks.extract_ticket.status, TaskRunStatus.SUCCEEDED);
    assert.strictEqual(summary.tasks.ai_classify.status, TaskRunStatus.SUCCEEDED);
    assert.strictEqual(summary.tasks.priority_gate.status, TaskRunStatus.SUCCEEDED);
    assert.strictEqual(summary.tasks.urgent_escalation.status, TaskRunStatus.SUCCEEDED);
    assert.strictEqual(summary.tasks.standard_routing.status, TaskRunStatus.SKIPPED);
    assert.strictEqual(summary.tasks.merge_response.status, TaskRunStatus.SUCCEEDED);
    assert.strictEqual(summary.tasks.triage_return.status, TaskRunStatus.SUCCEEDED);

    assert.ok(typeof summary.finalOutput === "string");
    assert.ok(summary.finalOutput.includes("CRITICAL ESCALATION"));
    assert.ok(summary.finalOutput.includes("TCK-8092"));
    assert.ok(summary.finalOutput.includes("Sarah Chen"));
    assert.ok(summary.finalOutput.includes("enterprise"));
  });

  await test("Scheduler: end-to-end execution of AI Support-Ticket Triage workflow down STANDARD (non-urgent) branch", async () => {
    const triageWorkflow = require("./workflows/ai_support_triage_workflow.json");
    const nonUrgentPayload = {
      ticketId: "TCK-4011",
      customerName: "Bob Miller",
      email: "bob@acme.org",
      issue: "Billing question regarding our monthly subscription invoice",
      tier: "standard",
    };

    const summary = await executeWorkflow(triageWorkflow, { triggerData: nonUrgentPayload });
    assert.strictEqual(summary.status, WorkflowRunStatus.SUCCEEDED);
    assert.strictEqual(summary.tasks.trig_ticket.status, TaskRunStatus.SUCCEEDED);
    assert.strictEqual(summary.tasks.extract_ticket.status, TaskRunStatus.SUCCEEDED);
    assert.strictEqual(summary.tasks.ai_classify.status, TaskRunStatus.SUCCEEDED);
    assert.strictEqual(summary.tasks.priority_gate.status, TaskRunStatus.SUCCEEDED);
    assert.strictEqual(summary.tasks.urgent_escalation.status, TaskRunStatus.SKIPPED);
    assert.strictEqual(summary.tasks.standard_routing.status, TaskRunStatus.SUCCEEDED);
    assert.strictEqual(summary.tasks.merge_response.status, TaskRunStatus.SUCCEEDED);
    assert.strictEqual(summary.tasks.triage_return.status, TaskRunStatus.SUCCEEDED);

    assert.ok(typeof summary.finalOutput === "string");
    assert.ok(summary.finalOutput.includes("STANDARD QUEUE"));
    assert.ok(summary.finalOutput.includes("TCK-4011"));
    assert.ok(summary.finalOutput.includes("Bob Miller"));
  });

  console.log("\n--- 5. New Trigger & Data Validation Unit Tests ---");

  await test("trigger.webhook: extracts live webhook payload, query, and headers", async () => {
    const nodeDef = defaultRegistry.get("trigger.webhook");
    const ctx = createExecutionContext({
      runId: "r1",
      taskId: "t1",
      nodeId: "n_wb",
      triggerData: {
        $webhook: true,
        body: { event: "payment_failed", amount: 4500 },
        headers: { "x-source": "stripe" },
        query: { env: "prod" },
        method: "POST",
      },
    });
    const res = await nodeDef.handler({}, { id: "n_wb", config: {} }, ctx);
    assert.deepStrictEqual(res.output, { event: "payment_failed", amount: 4500 });
    assert.strictEqual(res.method, "POST");
    assert.strictEqual(res.headers["x-source"], "stripe");
  });

  await test("trigger.webhook: falls back to config.defaultPayload when no triggerData", async () => {
    const nodeDef = defaultRegistry.get("trigger.webhook");
    const ctx = createExecutionContext({ runId: "r1", taskId: "t1", nodeId: "n_wb", triggerData: {} });
    const res = await nodeDef.handler({}, { id: "n_wb", config: { defaultPayload: { ping: "pong" } } }, ctx);
    assert.deepStrictEqual(res.output, { ping: "pong" });
  });

  await test("trigger.cron: validates cron expressions correctly", async () => {
    const { isValidCronExpression } = require("./src/engine/registry/nodes/trigger.cron");
    assert.strictEqual(isValidCronExpression("*/15 * * * *"), true);
    assert.strictEqual(isValidCronExpression("0 0 * * *"), true);
    assert.strictEqual(isValidCronExpression("@daily"), true);
    assert.strictEqual(isValidCronExpression("invalid_cron_string"), false);
  });

  await test("trigger.cron: extracts scheduled execution metadata", async () => {
    const nodeDef = defaultRegistry.get("trigger.cron");
    const ctx = createExecutionContext({
      runId: "r1",
      taskId: "t1",
      nodeId: "n_cron",
      triggerData: { $cron: true, scheduledAt: "2026-10-25T12:00:00Z", cronExpression: "0 12 * * *" },
    });
    const res = await nodeDef.handler({}, { id: "n_cron", config: { cronExpression: "0 12 * * *" } }, ctx);
    assert.strictEqual(res.output.cronExpression, "0 12 * * *");
    assert.strictEqual(res.output.scheduledAt, "2026-10-25T12:00:00Z");
    assert.strictEqual(res.timestamp, "2026-10-25T12:00:00Z");
  });

  await test("data.validate: passes valid payloads through", async () => {
    const nodeDef = defaultRegistry.get("data.validate");
    const payload = { ticketId: "TCK-1", title: "Error", affectedUsers: 50, errorRate: 0.1 };
    const res = await nodeDef.handler(
      { input: payload },
      { config: { requiredFields: ["ticketId", "title"], rules: { errorRate: { min: 0, max: 1 } } } }
    );
    assert.deepStrictEqual(res.output, payload);
    assert.strictEqual(res.valid, true);
  });

  await test("data.validate: throws VALIDATION_FAILED when required fields are missing", async () => {
    const nodeDef = defaultRegistry.get("data.validate");
    await assert.rejects(
      async () => {
        await nodeDef.handler(
          { input: { title: "Error" } },
          { config: { requiredFields: ["ticketId", "title"] } }
        );
      },
      (err) => err.code === ErrorCodes.VALIDATION_FAILED
    );
  });

  await test("data.validate: throws VALIDATION_FAILED when numeric bounds are violated", async () => {
    const nodeDef = defaultRegistry.get("data.validate");
    await assert.rejects(
      async () => {
        await nodeDef.handler(
          { input: { ticketId: "TCK-1", errorRate: 2.5 } },
          { config: { rules: { errorRate: { max: 1.0 } } } }
        );
      },
      (err) => err.code === ErrorCodes.VALIDATION_FAILED
    );
  });

  await test("http.request: failOnError option throws HTTP_REQUEST_FAILED on status >= 400", async () => {
    const nodeDef = defaultRegistry.get("http.request");
    const validation = nodeDef.validateConfig({ failOnError: true, method: "GET" });
    assert.strictEqual(validation.valid, true);
  });

  console.log("\n--- 6. Phase 1 Extended Execution Semantics ---");

  await test("Scheduler: single-node workflow executes and returns result", async () => {
    const singleWorkflow = {
      schemaVersion: 1,
      name: "Single Node",
      nodes: [
        {
          id: "solo_node",
          type: "utility.uuid",
          version: 1,
          name: "UUID Gen",
          config: {},
        },
      ],
      edges: [],
    };
    const summary = await executeWorkflow(singleWorkflow);
    assert.strictEqual(summary.status, WorkflowRunStatus.SUCCEEDED);
    assert.strictEqual(summary.tasks.solo_node.status, TaskRunStatus.SUCCEEDED);
    assert.ok(summary.tasks.solo_node.outputs.output);
  });

  await test("Scheduler: rejects empty workflow gracefully with schema error", async () => {
    const emptyWorkflow = { schemaVersion: 1, name: "Empty", nodes: [], edges: [] };
    const summary = await executeWorkflow(emptyWorkflow);
    assert.strictEqual(summary.status, WorkflowRunStatus.FAILED);
    assert.strictEqual(summary.error.code, ErrorCodes.WORKFLOW_SCHEMA_UNSUPPORTED);
  });

  await test("Scheduler: repeated execution with different inputs produces isolated results", async () => {
    const echoWorkflow = {
      schemaVersion: 1,
      name: "Echo Test",
      nodes: [
        { id: "trig", type: "trigger.manual", version: 1, config: {} },
        { id: "ret", type: "output.return", version: 1, config: {} },
      ],
      edges: [
        { id: "e1", source: "trig", sourcePort: "output", target: "ret", targetPort: "input" },
      ],
    };
    const run1 = await executeWorkflow(echoWorkflow, { triggerData: { message: "First" } });
    const run2 = await executeWorkflow(echoWorkflow, { triggerData: { message: "Second" } });
    assert.strictEqual(run1.status, WorkflowRunStatus.SUCCEEDED);
    assert.strictEqual(run2.status, WorkflowRunStatus.SUCCEEDED);
    assert.deepStrictEqual(run1.finalOutput, { message: "First" });
    assert.deepStrictEqual(run2.finalOutput, { message: "Second" });
  });

  console.log("\n--- 7. Flagship 'Dormammu AI Operations Center' Workflow Scenarios ---");

  const opsCenterWorkflow = require("./workflows/dormammu_ai_operations_center.json");

  await test("Flagship Scenario 1: Critical outage routes to CRITICAL escalation with impact score 96", async () => {
    const criticalPayload = {
      ticketId: "TCK-8092",
      title: "Payment gateway returning HTTP 504 errors",
      description: "Multiple users cannot complete checkout.",
      service: "payment-gateway",
      customerTier: "enterprise",
      affectedUsers: 1200,
      errorRate: 0.42,
      region: "ap-south-1",
      source: "support-webhook",
    };

    const summary = await executeWorkflow(opsCenterWorkflow, { triggerData: criticalPayload });
    assert.strictEqual(summary.status, WorkflowRunStatus.SUCCEEDED);

    // Verify task execution statuses
    assert.strictEqual(summary.tasks.trig_ops.status, TaskRunStatus.SUCCEEDED);
    assert.strictEqual(summary.tasks.validate_incident.status, TaskRunStatus.SUCCEEDED);
    assert.strictEqual(summary.tasks.normalize_incident.status, TaskRunStatus.SUCCEEDED);
    assert.strictEqual(summary.tasks.ai_classifier.status, TaskRunStatus.SUCCEEDED);
    assert.strictEqual(summary.tasks.calc_raw_impact.status, TaskRunStatus.SUCCEEDED);
    assert.strictEqual(summary.tasks.calc_impact_score.status, TaskRunStatus.SUCCEEDED);
    assert.strictEqual(summary.tasks.build_impact_summary.status, TaskRunStatus.SUCCEEDED);

    // Verify routing: critical executed, warning and normal skipped
    assert.strictEqual(summary.tasks.action_critical.status, TaskRunStatus.SUCCEEDED);
    assert.strictEqual(summary.tasks.action_warning.status, TaskRunStatus.SKIPPED);
    assert.strictEqual(summary.tasks.action_normal.status, TaskRunStatus.SKIPPED);
    assert.strictEqual(summary.tasks.merge_actions.status, TaskRunStatus.SUCCEEDED);
    assert.strictEqual(summary.tasks.assemble_final_report.status, TaskRunStatus.SUCCEEDED);
    assert.strictEqual(summary.tasks.ops_return.status, TaskRunStatus.SUCCEEDED);

    // Verify math & impact score calculation (1200 * 0.42 * 0.190476 = 96.0 -> round -> 96)
    assert.strictEqual(summary.tasks.calc_raw_impact.outputs.output, 504);
    assert.strictEqual(summary.tasks.calc_impact_score.outputs.output, 96);
    assert.strictEqual(summary.tasks.build_impact_summary.outputs.output.impactScore, 96);

    // Verify final report structure and content
    const report = summary.finalOutput;
    assert.strictEqual(report.ticketId, "TCK-8092");
    assert.strictEqual(report.service, "payment-gateway");
    assert.strictEqual(report.customerTier, "enterprise");
    assert.ok(report.actionSummary.includes("CRITICAL OUTAGE ESCALATION"));
  });

  await test("Flagship Scenario 2: Normal billing inquiry routes to STANDARD support queue", async () => {
    const normalPayload = {
      ticketId: "TCK-4102",
      title: "Question about an invoice",
      description: "The customer wants clarification about a recent invoice.",
      service: "billing",
      customerTier: "standard",
      affectedUsers: 1,
      errorRate: 0,
      region: "ap-south-1",
      source: "support-webhook",
    };

    const summary = await executeWorkflow(opsCenterWorkflow, { triggerData: normalPayload });
    assert.strictEqual(summary.status, WorkflowRunStatus.SUCCEEDED);

    // Critical and warning must be skipped, normal must succeed
    assert.strictEqual(summary.tasks.action_critical.status, TaskRunStatus.SKIPPED);
    assert.strictEqual(summary.tasks.action_warning.status, TaskRunStatus.SKIPPED);
    assert.strictEqual(summary.tasks.action_normal.status, TaskRunStatus.SUCCEEDED);
    assert.strictEqual(summary.tasks.merge_actions.status, TaskRunStatus.SUCCEEDED);

    const report = summary.finalOutput;
    assert.strictEqual(report.ticketId, "TCK-4102");
    assert.ok(report.actionSummary.includes("STANDARD SUPPORT"));
  });

  await test("Flagship Scenario 3: Warning degradation routes to PROMPT INVESTIGATION", async () => {
    const warningPayload = {
      ticketId: "TCK-6204",
      title: "Slow response times and latency spikes on reporting cluster",
      description: "Average latency increased to 950ms on reporting queries",
      service: "reporting-api",
      customerTier: "standard",
      affectedUsers: 150,
      errorRate: 0.12,
      region: "ap-south-1",
      source: "support-webhook",
    };

    const summary = await executeWorkflow(opsCenterWorkflow, { triggerData: warningPayload });
    assert.strictEqual(summary.status, WorkflowRunStatus.SUCCEEDED);

    // Critical and normal must be skipped, warning must succeed
    assert.strictEqual(summary.tasks.action_critical.status, TaskRunStatus.SKIPPED);
    assert.strictEqual(summary.tasks.action_warning.status, TaskRunStatus.SUCCEEDED);
    assert.strictEqual(summary.tasks.action_normal.status, TaskRunStatus.SKIPPED);
    assert.strictEqual(summary.tasks.merge_actions.status, TaskRunStatus.SUCCEEDED);

    const report = summary.finalOutput;
    assert.strictEqual(report.ticketId, "TCK-6204");
    assert.ok(report.actionSummary.includes("WARNING INVESTIGATION"));
  });

  await test("Flagship Scenario 4: Invalid input rejected fast at validate_incident, marking downstream BLOCKED", async () => {
    const invalidPayload = {
      ticketId: "TCK-INVALID",
      // missing required fields: title, service, customerTier, errorRate
    };

    const summary = await executeWorkflow(opsCenterWorkflow, { triggerData: invalidPayload });
    assert.strictEqual(summary.status, WorkflowRunStatus.FAILED);
    assert.strictEqual(summary.tasks.trig_ops.status, TaskRunStatus.SUCCEEDED);
    assert.strictEqual(summary.tasks.validate_incident.status, TaskRunStatus.FAILED);
    assert.strictEqual(summary.tasks.validate_incident.error.code, ErrorCodes.VALIDATION_FAILED);

    // Downstream nodes must be BLOCKED
    assert.strictEqual(summary.tasks.normalize_incident.status, TaskRunStatus.BLOCKED);
    assert.strictEqual(summary.tasks.ai_classifier.status, TaskRunStatus.BLOCKED);
    assert.strictEqual(summary.tasks.ops_return.status, TaskRunStatus.BLOCKED);
  });

  await test("Flagship Scenario 5: Controlled HTTP failure stops workflow and marks downstream BLOCKED", async () => {
    const testFailureWorkflow = {
      schemaVersion: 1,
      name: "HTTP Failure Simulation",
      nodes: [
        { id: "trig", type: "trigger.manual", version: 1, config: {} },
        {
          id: "http_node",
          type: "http.request",
          version: 1,
          config: {
            url: "http://127.0.0.1:5000/api/mock/service-health/fail-service",
            allowPrivateNetwork: false, // will fail SSRF or network
            failOnError: true,
          },
        },
        { id: "after_http", type: "text.template", version: 1, config: { template: "Never runs" } },
      ],
      edges: [
        { id: "e1", source: "trig", sourcePort: "output", target: "http_node", targetPort: "body" },
        { id: "e2", source: "http_node", sourcePort: "output", target: "after_http", targetPort: "input" },
      ],
    };

    const summary = await executeWorkflow(testFailureWorkflow);
    assert.strictEqual(summary.status, WorkflowRunStatus.FAILED);
    assert.strictEqual(summary.tasks.trig.status, TaskRunStatus.SUCCEEDED);
    assert.strictEqual(summary.tasks.http_node.status, TaskRunStatus.FAILED);
    assert.strictEqual(summary.tasks.after_http.status, TaskRunStatus.BLOCKED);
  });

  console.log("\n--- 8. Cron Scheduler & SSE Streaming Services ---");

  await test("CronSchedulerService: registers schedule and matches cron time correctly", async () => {
    const { CronSchedulerService, isCronMatch } = require("./src/services/cron.service");
    const testDate = new Date("2026-10-25T14:30:00Z"); // min: 30, hour: 14, dom: 25, mon: 10, dow: 0 (Sunday)

    assert.strictEqual(isCronMatch("30 14 * * *", testDate), true);
    assert.strictEqual(isCronMatch("*/15 14 * * *", testDate), true);
    assert.strictEqual(isCronMatch("0 14 * * *", testDate), false);

    const scheduler = new CronSchedulerService();
    scheduler.registerSchedule("wf_test", {
      ownerId: "user_1",
      cronExpression: "30 14 * * *",
    });

    const sched = scheduler.getSchedule("wf_test");
    assert.ok(sched);
    assert.strictEqual(sched.cronExpression, "30 14 * * *");
    assert.strictEqual(sched.running, false);

    scheduler.unregisterSchedule("wf_test");
    assert.strictEqual(scheduler.getSchedule("wf_test"), null);
  });

  await test("SseService: registers subscriber and emits live formatted events", async () => {
    const { SseService } = require("./src/services/sse.service");
    const sse = new SseService();
    const emitted = [];

    const mockRes = {
      setHeader: () => {},
      flushHeaders: () => {},
      write: (data) => emitted.push(data),
      on: () => {},
    };

    sse.subscribe("run_abc", mockRes);
    assert.strictEqual(sse.getSubscriberCount("run_abc"), 1);

    sse.emitRunEvent("run_abc", "task:running", { nodeId: "node_1", status: "RUNNING" });
    assert.ok(emitted.some((chunk) => chunk.includes("task:running") && chunk.includes("node_1")));

    sse.emitRunEvent("run_abc", "workflow:completed", { status: "SUCCEEDED" });
    assert.ok(emitted.some((chunk) => chunk.includes("workflow:completed")));
  });

  console.log("\n-------------------------------------------------------");
  console.log(` Results: ${passed} passed, ${failed} failed`);
  console.log("-------------------------------------------------------\n");

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runWorkflowEngineTests().catch((err) => {
  console.error("Unhandled error in test runner:", err);
  process.exit(1);
});
