/**
 * Webster Execution Engine - Workflow Validator
 * Enforces Levels 1-4 standard validation rules.
 */

const { ErrorCodes } = require("../contracts/errors");
const { defaultRegistry } = require("../registry/node.registry");

const SUPPORTED_SCHEMA_VERSIONS = [1, "1", "1.0", 1.0];

/**
 * Normalizes an error object to the standard Webster error response contract.
 */
function normalizeError(err) {
  return {
    code: err.code || "VALIDATION_ERROR",
    message: err.message || "Validation failed",
    nodeId: err.nodeId !== undefined ? err.nodeId : null,
    edgeId: err.edgeId !== undefined ? err.edgeId : null,
    field: err.field !== undefined ? err.field : null,
    ...(err.cycle ? { cycle: err.cycle } : {}),
  };
}

/**
 * Validates a workflow definition against structure, registry, port bindings, and DAG rules.
 * @param {Object} workflow - Workflow definition object
 * @param {import('../registry/node.registry').NodeRegistry} [registry=defaultRegistry]
 * @returns {{ valid: boolean, errors: Array<Object>, warnings: Array<Object> }}
 */
function validateWorkflow(workflow, registry = defaultRegistry) {
  const rawErrors = [];
  const rawWarnings = [];

  // ==========================================
  // LEVEL 1: Structural validation
  // ==========================================
  if (!workflow || typeof workflow !== "object") {
    rawErrors.push({
      code: ErrorCodes.WORKFLOW_SCHEMA_UNSUPPORTED,
      message: "Workflow definition must be an object",
      nodeId: null,
      edgeId: null,
      field: null,
    });
    return {
      valid: false,
      errors: rawErrors.map(normalizeError),
      warnings: [],
    };
  }

  const isSupportedVersion = SUPPORTED_SCHEMA_VERSIONS.includes(workflow.schemaVersion);
  if (!isSupportedVersion) {
    rawErrors.push({
      code: ErrorCodes.WORKFLOW_SCHEMA_UNSUPPORTED,
      message: `Unsupported schema version '${workflow.schemaVersion}'. Supported: 1, 1.0`,
      nodeId: null,
      edgeId: null,
      field: "schemaVersion",
    });
  }

  if (!Array.isArray(workflow.nodes) || workflow.nodes.length === 0) {
    rawErrors.push({
      code: ErrorCodes.WORKFLOW_SCHEMA_UNSUPPORTED,
      message: "Workflow must contain a non-empty 'nodes' array",
      nodeId: null,
      edgeId: null,
      field: "nodes",
    });
    return {
      valid: false,
      errors: rawErrors.map(normalizeError),
      warnings: [],
    };
  }

  const edges = Array.isArray(workflow.edges) ? workflow.edges : [];

  // Validate Nodes
  const nodeMap = new Map();
  for (let i = 0; i < workflow.nodes.length; i++) {
    const node = workflow.nodes[i];
    if (!node || typeof node !== "object") {
      rawErrors.push({
        code: ErrorCodes.WORKFLOW_SCHEMA_UNSUPPORTED,
        message: `Node at index ${i} is not a valid object`,
        nodeId: null,
        edgeId: null,
        field: `nodes[${i}]`,
      });
      continue;
    }

    if (!node.id || typeof node.id !== "string" || node.id.trim() === "") {
      rawErrors.push({
        code: ErrorCodes.WORKFLOW_SCHEMA_UNSUPPORTED,
        message: `Node at index ${i} is missing a non-empty string 'id'`,
        nodeId: null,
        edgeId: null,
        field: `nodes[${i}].id`,
      });
      continue;
    }

    if (nodeMap.has(node.id)) {
      rawErrors.push({
        code: ErrorCodes.DUPLICATE_NODE_ID,
        message: `Duplicate node ID '${node.id}' detected`,
        nodeId: node.id,
        edgeId: null,
        field: "id",
      });
      continue;
    }

    if (!node.type || typeof node.type !== "string") {
      rawErrors.push({
        code: ErrorCodes.WORKFLOW_SCHEMA_UNSUPPORTED,
        message: `Node '${node.id}' is missing a valid 'type'`,
        nodeId: node.id,
        edgeId: null,
        field: "type",
      });
      continue;
    }

    if (!registry.has(node.type)) {
      rawErrors.push({
        code: ErrorCodes.UNKNOWN_NODE_TYPE,
        message: `Node '${node.id}' references unknown node type '${node.type}'`,
        nodeId: node.id,
        edgeId: null,
        field: "type",
      });
      continue;
    }

    // ==========================================
    // LEVEL 3: Node configuration validation
    // ==========================================
    const config = node.config || {};
    const configResult = registry.validateConfig(node.type, config);
    if (!configResult.valid) {
      const errMsg = (configResult.errors || []).join("; ") || "Invalid node configuration";
      rawErrors.push({
        code: ErrorCodes.NODE_CONFIG_INVALID,
        message: `Node '${node.id}' configuration invalid: ${errMsg}`,
        nodeId: node.id,
        edgeId: null,
        field: configResult.field || "config",
      });
    }

    nodeMap.set(node.id, node);
  }

  // ==========================================
  // LEVEL 2: Graph validation (Edges & Ports)
  // ==========================================
  const edgeMap = new Map();
  const inputPortIncomingEdges = new Map();

  for (let i = 0; i < edges.length; i++) {
    const edge = edges[i];
    if (!edge || typeof edge !== "object") {
      rawErrors.push({
        code: ErrorCodes.WORKFLOW_SCHEMA_UNSUPPORTED,
        message: `Edge at index ${i} is not an object`,
        nodeId: null,
        edgeId: null,
        field: `edges[${i}]`,
      });
      continue;
    }

    const edgeId = edge.id || `edge_${i}`;
    if (edgeMap.has(edgeId)) {
      rawErrors.push({
        code: ErrorCodes.DUPLICATE_EDGE_ID,
        message: `Duplicate edge ID '${edgeId}' detected`,
        nodeId: null,
        edgeId,
        field: "id",
      });
    }
    edgeMap.set(edgeId, edge);

    // Source check
    if (!edge.source || !nodeMap.has(edge.source)) {
      rawErrors.push({
        code: ErrorCodes.EDGE_SOURCE_NOT_FOUND,
        message: `The edge references a source node '${edge.source}' that does not exist.`,
        nodeId: null,
        edgeId,
        field: "source",
      });
      continue;
    }

    // Target check
    if (!edge.target || !nodeMap.has(edge.target)) {
      rawErrors.push({
        code: ErrorCodes.EDGE_TARGET_NOT_FOUND,
        message: `The edge references a target node '${edge.target}' that does not exist.`,
        nodeId: null,
        edgeId,
        field: "target",
      });
      continue;
    }

    // Self-loop check
    if (edge.source === edge.target) {
      rawErrors.push({
        code: ErrorCodes.CYCLE_DETECTED,
        message: `Self-loop connection detected on node '${edge.source}' in edge '${edgeId}'`,
        nodeId: edge.source,
        edgeId,
        field: null,
      });
      continue;
    }

    const sourceNode = nodeMap.get(edge.source);
    const targetNode = nodeMap.get(edge.target);
    const sourceDef = registry.get(sourceNode.type);
    const targetDef = registry.get(targetNode.type);

    const sourceOutputs = typeof sourceDef.getDynamicOutputs === "function"
      ? sourceDef.getDynamicOutputs(sourceNode.config)
      : sourceDef.outputs;
    const targetInputs = typeof targetDef.getDynamicInputs === "function"
      ? targetDef.getDynamicInputs(targetNode.config)
      : targetDef.inputs;

    // Normalize sourceHandle / targetHandle from graph editor
    if (!edge.sourcePort && edge.sourceHandle) {
      edge.sourcePort = edge.sourceHandle;
    }
    if (!edge.targetPort && edge.targetHandle) {
      edge.targetPort = edge.targetHandle;
    }

    // Normalize legacy port aliases for seamless backward compatibility
    if (edge.sourcePort && !sourceOutputs[edge.sourcePort]) {
      if (edge.sourcePort === "result" && sourceOutputs["output"]) {
        edge.sourcePort = "output";
      } else if (edge.sourcePort === "output" && sourceOutputs["result"]) {
        edge.sourcePort = "result";
      }
    }
    if (edge.targetPort && !targetInputs[edge.targetPort]) {
      if (edge.targetPort === "input" && targetInputs["a"]) {
        edge.targetPort = "a";
      } else if (edge.targetPort === "input" && targetInputs["base"]) {
        edge.targetPort = "base";
      }
    }

    // Source port check
    if (!edge.sourcePort || !sourceOutputs[edge.sourcePort]) {
      rawErrors.push({
        code: ErrorCodes.UNKNOWN_SOURCE_PORT,
        message: `Edge '${edgeId}' references unknown source port '${edge.sourcePort}' on node '${edge.source}' (${sourceNode.type})`,
        nodeId: edge.source,
        edgeId,
        field: "sourcePort",
      });
    }

    // Target port check
    if (!edge.targetPort || !targetInputs[edge.targetPort]) {
      rawErrors.push({
        code: ErrorCodes.UNKNOWN_TARGET_PORT,
        message: `Edge '${edgeId}' references unknown target port '${edge.targetPort}' on node '${edge.target}' (${targetNode.type})`,
        nodeId: edge.target,
        edgeId,
        field: "targetPort",
      });
    } else {
      const targetPortKey = `${edge.target}:${edge.targetPort}`;
      const existingCount = inputPortIncomingEdges.get(targetPortKey) || 0;
      const targetPortDef = targetInputs[edge.targetPort];

      if (existingCount >= 1 && !targetPortDef.allowMultiple) {
        rawErrors.push({
          code: ErrorCodes.MULTIPLE_INPUTS_NOT_SUPPORTED,
          message: `Target port '${edge.targetPort}' on node '${edge.target}' has multiple incoming edges, which is not supported for single-value ports`,
          nodeId: edge.target,
          edgeId,
          field: "targetPort",
        });
      }
      inputPortIncomingEdges.set(targetPortKey, existingCount + 1);

      // Port Type Compatibility Check
      if (sourceOutputs[edge.sourcePort]) {
        const srcType = sourceOutputs[edge.sourcePort].type;
        const tgtType = targetPortDef.type;
        if (srcType !== "any" && tgtType !== "any" && srcType !== tgtType) {
          rawWarnings.push({
            code: ErrorCodes.PORT_TYPE_MISMATCH,
            message: `Potential port type mismatch from ${edge.source}.${edge.sourcePort} (${srcType}) to ${edge.target}.${edge.targetPort} (${tgtType})`,
            nodeId: edge.target,
            edgeId,
            field: "targetPort",
          });
        }
      }
    }
  }

  // ==========================================
  // LEVEL 4: Semantic validation
  // ==========================================
  // Required Inputs Check
  for (const [nodeId, node] of nodeMap.entries()) {
    const nodeDef = registry.get(node.type);
    for (const [portName, portDef] of Object.entries(nodeDef.inputs)) {
      if (portDef.required && portDef.defaultValue === undefined) {
        const targetPortKey = `${nodeId}:${portName}`;
        const hasIncomingEdge = (inputPortIncomingEdges.get(targetPortKey) || 0) > 0;
        const hasConfigFallback = node.config && node.config[portName] !== undefined;

        if (!hasIncomingEdge && !hasConfigFallback) {
          rawErrors.push({
            code: ErrorCodes.REQUIRED_INPUT_MISSING,
            message: `Node '${nodeId}' (${node.type}) requires input port '${portName}', but no edge is connected and no default is provided`,
            nodeId,
            edgeId: null,
            field: `config.${portName}`,
          });
        }
      }
    }
  }

  // Cycle Detection using DFS (3-state coloring)
  const adjacency = new Map();
  for (const nodeId of nodeMap.keys()) {
    adjacency.set(nodeId, []);
  }
  for (const edge of edges) {
    if (nodeMap.has(edge.source) && nodeMap.has(edge.target)) {
      adjacency.get(edge.source).push(edge.target);
    }
  }

  const State = { UNVISITED: 0, VISITING: 1, VISITED: 2 };
  const visited = new Map();
  for (const nodeId of nodeMap.keys()) {
    visited.set(nodeId, State.UNVISITED);
  }

  const cycleNodes = [];

  function dfs(currNode, path) {
    visited.set(currNode, State.VISITING);
    path.push(currNode);

    const neighbors = adjacency.get(currNode) || [];
    for (const neighbor of neighbors) {
      const neighborState = visited.get(neighbor);
      if (neighborState === State.VISITING) {
        const cycleStartIndex = path.indexOf(neighbor);
        const cyclePath = path.slice(cycleStartIndex).concat(neighbor);
        cycleNodes.push(cyclePath);
        return true;
      }
      if (neighborState === State.UNVISITED) {
        if (dfs(neighbor, path)) {
          return true;
        }
      }
    }

    visited.set(currNode, State.VISITED);
    path.pop();
    return false;
  }

  for (const nodeId of nodeMap.keys()) {
    if (visited.get(nodeId) === State.UNVISITED) {
      if (dfs(nodeId, [])) {
        break;
      }
    }
  }

  if (cycleNodes.length > 0) {
    rawErrors.push({
      code: ErrorCodes.CYCLE_DETECTED,
      message: `Cycle detected in graph: ${cycleNodes[0].join(" -> ")}`,
      nodeId: null,
      edgeId: null,
      field: null,
      cycle: cycleNodes[0],
    });
  }

  // Check unreachable / disconnected nodes warning (if more than 1 node)
  if (nodeMap.size > 1 && edges.length > 0) {
    const connectedNodes = new Set();
    for (const edge of edges) {
      connectedNodes.add(edge.source);
      connectedNodes.add(edge.target);
    }
    for (const nodeId of nodeMap.keys()) {
      if (!connectedNodes.has(nodeId)) {
        rawWarnings.push({
          code: ErrorCodes.DISCONNECTED_GRAPH_WARNING,
          message: `Node '${nodeId}' is disconnected from the workflow graph.`,
          nodeId,
          edgeId: null,
          field: null,
        });
      }
    }
  }

  return {
    valid: rawErrors.length === 0,
    errors: rawErrors.map(normalizeError),
    warnings: rawWarnings.map(normalizeError),
  };
}

module.exports = {
  validateWorkflow,
  SUPPORTED_SCHEMA_VERSIONS,
};
