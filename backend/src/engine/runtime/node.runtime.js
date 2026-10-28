/**
 * Webster Execution Engine - Node Runtime
 * Resolves inputs, invokes isolated node handler, and validates returned outputs
 */

const { ErrorCodes, EngineError } = require("../contracts/errors");
const { defaultRegistry } = require("../registry/node.registry");

/**
 * Resolves input port values for a node from predecessor outputs, configuration, or defaults.
 * @param {Object} node - Node instance from plan
 * @param {import('../registry/node.registry').NodeRegistry} registry
 * @param {Map<string, Object>} nodeOutputsStore - Map of nodeId -> outputs object
 * @param {Array<Object>} incomingEdges - List of edges where edge.target === node.id
 * @returns {Record<string, any>}
 */
function resolveNodeInputs(node, registry, nodeOutputsStore, incomingEdges = []) {
  const nodeDef = registry.get(node.type);
  const resolvedInputs = {};

  // Map each incoming edge to the target input port
  for (const edge of incomingEdges) {
    const sourceNodeOutputs = nodeOutputsStore.get(edge.source);
    if (!sourceNodeOutputs) {
      throw new EngineError(
        ErrorCodes.REQUIRED_INPUT_MISSING,
        `Cannot resolve input port '${edge.targetPort}' on node '${node.id}': predecessor '${edge.source}' has no recorded outputs`,
        { nodeId: node.id, edgeId: edge.id, source: edge.source }
      );
    }

    let sourcePort = edge.sourcePort;
    if (sourceNodeOutputs[sourcePort] === undefined) {
      if (sourcePort === "result" && sourceNodeOutputs["output"] !== undefined) {
        sourcePort = "output";
      } else if (sourcePort === "output" && sourceNodeOutputs["result"] !== undefined) {
        sourcePort = "result";
      }
    }

    const value = sourceNodeOutputs[sourcePort];

    let targetPort = edge.targetPort;
    if (!nodeDef.inputs[targetPort]) {
      if (targetPort === "input" && nodeDef.inputs["a"]) {
        targetPort = "a";
      } else if (targetPort === "input" && nodeDef.inputs["base"]) {
        targetPort = "base";
      }
    }

    const portDef = nodeDef.inputs[targetPort];
    let effectiveValue = value;

    if (portDef && portDef.type === "number") {
      if (typeof effectiveValue === "object" && effectiveValue !== null && !Array.isArray(effectiveValue)) {
        if (effectiveValue[targetPort] !== undefined && (typeof effectiveValue[targetPort] === "number" || (!isNaN(Number(effectiveValue[targetPort])) && effectiveValue[targetPort] !== ""))) {
          effectiveValue = Number(effectiveValue[targetPort]);
        } else if (effectiveValue.value !== undefined && (typeof effectiveValue.value === "number" || (!isNaN(Number(effectiveValue.value)) && effectiveValue.value !== ""))) {
          effectiveValue = Number(effectiveValue.value);
        } else if (effectiveValue.output !== undefined && (typeof effectiveValue.output === "number" || (!isNaN(Number(effectiveValue.output)) && effectiveValue.output !== ""))) {
          effectiveValue = Number(effectiveValue.output);
        } else if (effectiveValue.payload !== undefined && (typeof effectiveValue.payload === "number" || (!isNaN(Number(effectiveValue.payload)) && effectiveValue.payload !== ""))) {
          effectiveValue = Number(effectiveValue.payload);
        } else if (effectiveValue.result !== undefined && (typeof effectiveValue.result === "number" || (!isNaN(Number(effectiveValue.result)) && effectiveValue.result !== ""))) {
          effectiveValue = Number(effectiveValue.result);
        } else if (effectiveValue.data !== undefined && (typeof effectiveValue.data === "number" || (!isNaN(Number(effectiveValue.data)) && effectiveValue.data !== ""))) {
          effectiveValue = Number(effectiveValue.data);
        } else if (effectiveValue.val !== undefined && (typeof effectiveValue.val === "number" || (!isNaN(Number(effectiveValue.val)) && effectiveValue.val !== ""))) {
          effectiveValue = Number(effectiveValue.val);
        } else if (effectiveValue.amount !== undefined && (typeof effectiveValue.amount === "number" || (!isNaN(Number(effectiveValue.amount)) && effectiveValue.amount !== ""))) {
          effectiveValue = Number(effectiveValue.amount);
        } else if (node.config && node.config[targetPort] !== undefined && node.config[targetPort] !== "" && !isNaN(Number(node.config[targetPort]))) {
          effectiveValue = Number(node.config[targetPort]);
        } else if (targetPort === "b" && node.config && node.config.factor !== undefined && !isNaN(Number(node.config.factor))) {
          effectiveValue = Number(node.config.factor);
        } else if (portDef.defaultValue !== undefined && typeof portDef.defaultValue === "number") {
          effectiveValue = portDef.defaultValue;
        }
      }
      if (typeof effectiveValue === "string" && effectiveValue.trim() !== "" && !isNaN(Number(effectiveValue))) {
        effectiveValue = Number(effectiveValue);
      }
    } else if (portDef && portDef.type === "string") {
      if (typeof effectiveValue === "object" && effectiveValue !== null) {
        if (effectiveValue[targetPort] !== undefined && typeof effectiveValue[targetPort] === "string") {
          effectiveValue = effectiveValue[targetPort];
        } else if (effectiveValue.text !== undefined && typeof effectiveValue.text === "string") {
          effectiveValue = effectiveValue.text;
        } else if (effectiveValue.message !== undefined && typeof effectiveValue.message === "string") {
          effectiveValue = effectiveValue.message;
        } else if (effectiveValue.value !== undefined && typeof effectiveValue.value === "string") {
          effectiveValue = effectiveValue.value;
        } else if (effectiveValue.output !== undefined && typeof effectiveValue.output === "string") {
          effectiveValue = effectiveValue.output;
        } else if (effectiveValue.payload !== undefined && typeof effectiveValue.payload === "string") {
          effectiveValue = effectiveValue.payload;
        } else if (effectiveValue.incident_id !== undefined) {
          effectiveValue = String(effectiveValue.incident_id);
        } else if (node.config && node.config[targetPort] !== undefined && node.config[targetPort] !== "") {
          effectiveValue = String(node.config[targetPort]);
        } else if (portDef.defaultValue !== undefined) {
          effectiveValue = portDef.defaultValue;
        }
      }
      if (effectiveValue !== undefined && effectiveValue !== null && typeof effectiveValue !== "string") {
        if (typeof effectiveValue === "number" || typeof effectiveValue === "boolean") {
          effectiveValue = String(effectiveValue);
        }
      }
    } else if (portDef && portDef.type === "boolean") {
      if (typeof effectiveValue === "string") {
        const lower = effectiveValue.trim().toLowerCase();
        if (lower === "true") effectiveValue = true;
        else if (lower === "false") effectiveValue = false;
      } else if (typeof effectiveValue === "object" && effectiveValue !== null) {
        if (effectiveValue[targetPort] !== undefined) {
          effectiveValue = Boolean(effectiveValue[targetPort]);
        } else if (effectiveValue.value !== undefined) {
          effectiveValue = Boolean(effectiveValue.value);
        } else if (node.config && node.config[targetPort] !== undefined) {
          effectiveValue = Boolean(node.config[targetPort]);
        } else if (portDef.defaultValue !== undefined) {
          effectiveValue = portDef.defaultValue;
        }
      }
    }

    if (portDef && portDef.allowMultiple) {
      if (resolvedInputs[targetPort] === undefined) {
        resolvedInputs[targetPort] = [effectiveValue];
      } else if (Array.isArray(resolvedInputs[targetPort])) {
        resolvedInputs[targetPort].push(effectiveValue);
      } else {
        resolvedInputs[targetPort] = [resolvedInputs[targetPort], effectiveValue];
      }
    } else {
      resolvedInputs[targetPort] = effectiveValue;
    }
  }

  // For ports not satisfied by edges, check config or port defaultValue
  for (const [portName, portDef] of Object.entries(nodeDef.inputs)) {
    if (resolvedInputs[portName] === undefined) {
      if (node.config && node.config[portName] !== undefined) {
        resolvedInputs[portName] = node.config[portName];
      } else if (portDef.defaultValue !== undefined) {
        resolvedInputs[portName] = portDef.defaultValue;
      }
    }
  }

  return resolvedInputs;
}

/**
 * Executes a single node within an isolated execution context.
 * @param {Object} options
 * @param {Object} options.node - Node instance
 * @param {import('../registry/node.registry').NodeRegistry} [options.registry=defaultRegistry]
 * @param {Map<string, Object>} options.nodeOutputsStore
 * @param {Array<Object>} options.incomingEdges
 * @param {Object} options.context - Execution context
 * @returns {Promise<{ outputs: Record<string, any>, durationMs: number }>}
 */
async function executeNodeRuntime({
  node,
  registry = defaultRegistry,
  nodeOutputsStore,
  incomingEdges,
  context,
}) {
  const nodeDef = registry.get(node.type);
  const startTime = Date.now();

  // 1. Resolve inputs
  const resolvedInputs = resolveNodeInputs(node, registry, nodeOutputsStore, incomingEdges);

  // 2. Validate inputs
  const inputValidation = registry.validateInputs(node.type, resolvedInputs);
  if (!inputValidation.valid) {
    const primary = inputValidation.errors[0];
    throw new EngineError(
      primary.code,
      `Input validation failed for node '${node.id}': ${primary.message}`,
      { nodeId: node.id, port: primary.port, allErrors: inputValidation.errors }
    );
  }

  // 3. Check for cancellation before executing handler
  if (context.abortSignal && context.abortSignal.aborted) {
    throw new EngineError(
      ErrorCodes.EXECUTION_CANCELLED,
      `Execution cancelled before running node '${node.id}'`,
      { nodeId: node.id }
    );
  }

  // 4. Execute handler with timeout support if declared
  let outputs;
  try {
    const handlerPromise = nodeDef.handler(resolvedInputs, node, context);
    const timeoutMs = (nodeDef.capabilities && nodeDef.capabilities.timeoutMs) || 10000;

    let timeoutId;
    const timeoutPromise = new Promise((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(
          new EngineError(
            ErrorCodes.EXECUTION_TIMEOUT,
            `Node '${node.id}' timed out after ${timeoutMs}ms`,
            { nodeId: node.id, timeoutMs }
          )
        );
      }, timeoutMs);
    });

    try {
      outputs = await Promise.race([handlerPromise, timeoutPromise]);
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (err) {
    if (err instanceof EngineError) {
      if (!err.details) err.details = {};
      if (err.details.inputs === undefined) err.details.inputs = resolvedInputs;
      err.resolvedInputs = resolvedInputs;
      throw err;
    }
    const engineErr = new EngineError(
      ErrorCodes.HANDLER_EXECUTION_FAILED,
      `Handler error in node '${node.id}': ${err.message}`,
      { nodeId: node.id, originalMessage: err.message, inputs: resolvedInputs }
    );
    engineErr.resolvedInputs = resolvedInputs;
    throw engineErr;
  }

  // 5. Validate outputs
  if (!outputs || typeof outputs !== "object") {
    throw new EngineError(
      ErrorCodes.INVALID_OUTPUT_PORT,
      `Node '${node.id}' handler must return an outputs object, received ${typeof outputs}`,
      { nodeId: node.id }
    );
  }

  const declaredOutputs = typeof nodeDef.getDynamicOutputs === "function"
    ? nodeDef.getDynamicOutputs(node.config)
    : nodeDef.outputs;

  for (const outputPort of Object.keys(outputs)) {
    if (outputPort.startsWith("_")) continue;
    if (!declaredOutputs || !declaredOutputs[outputPort]) {
      throw new EngineError(
        ErrorCodes.INVALID_OUTPUT_PORT,
        `Node '${node.id}' returned undeclared output port '${outputPort}'`,
        { nodeId: node.id, port: outputPort, declaredOutputs: declaredOutputs ? Object.keys(declaredOutputs) : [] }
      );
    }
  }

  const durationMs = Date.now() - startTime;
  return {
    inputs: resolvedInputs,
    outputs,
    durationMs,
  };
}

module.exports = {
  resolveNodeInputs,
  executeNodeRuntime,
};
