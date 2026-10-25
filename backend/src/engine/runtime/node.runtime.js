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

    resolvedInputs[targetPort] = value;
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

  for (const outputPort of Object.keys(outputs)) {
    if (!nodeDef.outputs[outputPort]) {
      throw new EngineError(
        ErrorCodes.INVALID_OUTPUT_PORT,
        `Node '${node.id}' returned undeclared output port '${outputPort}'`,
        { nodeId: node.id, port: outputPort, declaredOutputs: Object.keys(nodeDef.outputs) }
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
