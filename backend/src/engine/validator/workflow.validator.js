/**
 * Webster Execution Engine - Workflow Validator
 */

const { ErrorCodes } = require("../contracts/errors");
const { defaultRegistry } = require("../registry/node.registry");

const SUPPORTED_SCHEMA_VERSIONS = ["1.0"];

/**
 * Validates a workflow definition against structure, registry, port bindings, and DAG rules.
 * @param {Object} workflow - Workflow definition object
 * @param {import('../registry/node.registry').NodeRegistry} [registry=defaultRegistry]
 * @returns {{ valid: boolean, errors: Array<Object>, warnings: Array<Object> }}
 */
function validateWorkflow(workflow, registry = defaultRegistry) {
  const errors = [];
  const warnings = [];

  // 1. Definition shape & schema version
  if (!workflow || typeof workflow !== "object") {
    errors.push({
      code: ErrorCodes.WORKFLOW_SCHEMA_UNSUPPORTED,
      message: "Workflow definition must be an object",
    });
    return { valid: false, errors, warnings };
  }

  if (!SUPPORTED_SCHEMA_VERSIONS.includes(workflow.schemaVersion)) {
    errors.push({
      code: ErrorCodes.WORKFLOW_SCHEMA_UNSUPPORTED,
      message: `Unsupported schema version '${workflow.schemaVersion}'. Supported: ${SUPPORTED_SCHEMA_VERSIONS.join(", ")}`,
    });
  }

  if (!Array.isArray(workflow.nodes) || workflow.nodes.length === 0) {
    errors.push({
      code: ErrorCodes.WORKFLOW_SCHEMA_UNSUPPORTED,
      message: "Workflow must contain a non-empty 'nodes' array",
    });
    return { valid: false, errors, warnings };
  }

  const edges = Array.isArray(workflow.edges) ? workflow.edges : [];

  // 2. Validate Nodes
  const nodeMap = new Map();
  for (let i = 0; i < workflow.nodes.length; i++) {
    const node = workflow.nodes[i];
    if (!node || typeof node !== "object") {
      errors.push({
        code: ErrorCodes.WORKFLOW_SCHEMA_UNSUPPORTED,
        message: `Node at index ${i} is not a valid object`,
      });
      continue;
    }

    if (!node.id || typeof node.id !== "string" || node.id.trim() === "") {
      errors.push({
        code: ErrorCodes.WORKFLOW_SCHEMA_UNSUPPORTED,
        message: `Node at index ${i} is missing a non-empty string 'id'`,
      });
      continue;
    }

    if (nodeMap.has(node.id)) {
      errors.push({
        code: ErrorCodes.DUPLICATE_NODE_ID,
        message: `Duplicate node ID '${node.id}' detected`,
        nodeId: node.id,
      });
      continue;
    }

    if (!node.type || typeof node.type !== "string") {
      errors.push({
        code: ErrorCodes.WORKFLOW_SCHEMA_UNSUPPORTED,
        message: `Node '${node.id}' is missing a valid 'type'`,
        nodeId: node.id,
      });
      continue;
    }

    if (!registry.has(node.type)) {
      errors.push({
        code: ErrorCodes.UNKNOWN_NODE_TYPE,
        message: `Node '${node.id}' references unknown node type '${node.type}'`,
        nodeId: node.id,
        nodeType: node.type,
      });
      continue;
    }

    // Config validation
    const config = node.config || {};
    const configResult = registry.validateConfig(node.type, config);
    if (!configResult.valid) {
      errors.push({
        code: ErrorCodes.NODE_CONFIG_INVALID,
        message: `Node '${node.id}' config invalid: ${(configResult.errors || []).join("; ")}`,
        nodeId: node.id,
        nodeType: node.type,
      });
    }

    nodeMap.set(node.id, node);
  }

  // 3. Validate Edges
  const edgeMap = new Map();
  const inputPortIncomingEdges = new Map(); // `${targetNodeId}:${targetPort}` -> count

  for (let i = 0; i < edges.length; i++) {
    const edge = edges[i];
    if (!edge || typeof edge !== "object") {
      errors.push({
        code: ErrorCodes.WORKFLOW_SCHEMA_UNSUPPORTED,
        message: `Edge at index ${i} is not an object`,
      });
      continue;
    }

    const edgeId = edge.id || `edge-${i}`;
    if (edgeMap.has(edgeId)) {
      errors.push({
        code: ErrorCodes.DUPLICATE_EDGE_ID,
        message: `Duplicate edge ID '${edgeId}' detected`,
        edgeId,
      });
    }
    edgeMap.set(edgeId, edge);

    // Source check
    if (!edge.source || !nodeMap.has(edge.source)) {
      errors.push({
        code: ErrorCodes.EDGE_SOURCE_NOT_FOUND,
        message: `Edge '${edgeId}' references non-existent source node '${edge.source}'`,
        edgeId,
        source: edge.source,
      });
      continue;
    }

    // Target check
    if (!edge.target || !nodeMap.has(edge.target)) {
      errors.push({
        code: ErrorCodes.EDGE_TARGET_NOT_FOUND,
        message: `Edge '${edgeId}' references non-existent target node '${edge.target}'`,
        edgeId,
        target: edge.target,
      });
      continue;
    }

    // Self-loop check
    if (edge.source === edge.target) {
      errors.push({
        code: ErrorCodes.CYCLE_DETECTED,
        message: `Self-loop detected on node '${edge.source}' in edge '${edgeId}'`,
        edgeId,
        nodeId: edge.source,
      });
      continue;
    }

    const sourceNode = nodeMap.get(edge.source);
    const targetNode = nodeMap.get(edge.target);
    const sourceDef = registry.get(sourceNode.type);
    const targetDef = registry.get(targetNode.type);

    // Source port check
    if (!edge.sourcePort || !sourceDef.outputs[edge.sourcePort]) {
      errors.push({
        code: ErrorCodes.UNKNOWN_SOURCE_PORT,
        message: `Edge '${edgeId}' references unknown source port '${edge.sourcePort}' on node '${edge.source}' (${sourceNode.type})`,
        edgeId,
        nodeId: edge.source,
        port: edge.sourcePort,
      });
    }

    // Target port check
    if (!edge.targetPort || !targetDef.inputs[edge.targetPort]) {
      errors.push({
        code: ErrorCodes.UNKNOWN_TARGET_PORT,
        message: `Edge '${edgeId}' references unknown target port '${edge.targetPort}' on node '${edge.target}' (${targetNode.type})`,
        edgeId,
        nodeId: edge.target,
        port: edge.targetPort,
      });
    } else {
      // Check for multiple incoming connections to a single-value port
      const targetPortKey = `${edge.target}:${edge.targetPort}`;
      const existingCount = inputPortIncomingEdges.get(targetPortKey) || 0;
      const targetPortDef = targetDef.inputs[edge.targetPort];

      if (existingCount >= 1 && !targetPortDef.allowMultiple) {
        errors.push({
          code: ErrorCodes.MULTIPLE_INPUTS_NOT_SUPPORTED,
          message: `Target port '${edge.targetPort}' on node '${edge.target}' has multiple incoming edges, which is not supported for single-value ports`,
          edgeId,
          nodeId: edge.target,
          port: edge.targetPort,
        });
      }
      inputPortIncomingEdges.set(targetPortKey, existingCount + 1);

      // Port Type Compatibility Warning/Check
      if (sourceDef.outputs[edge.sourcePort]) {
        const srcType = sourceDef.outputs[edge.sourcePort].type;
        const tgtType = targetPortDef.type;
        if (srcType !== "any" && tgtType !== "any" && srcType !== tgtType) {
          warnings.push({
            code: ErrorCodes.PORT_TYPE_MISMATCH,
            message: `Potential port type mismatch from ${edge.source}.${edge.sourcePort} (${srcType}) to ${edge.target}.${edge.targetPort} (${tgtType})`,
            edgeId,
            source: edge.source,
            target: edge.target,
          });
        }
      }
    }
  }

  // 4. Required Inputs Check
  for (const [nodeId, node] of nodeMap.entries()) {
    const nodeDef = registry.get(node.type);
    for (const [portName, portDef] of Object.entries(nodeDef.inputs)) {
      if (portDef.required && portDef.defaultValue === undefined) {
        const targetPortKey = `${nodeId}:${portName}`;
        const hasIncomingEdge = (inputPortIncomingEdges.get(targetPortKey) || 0) > 0;
        const hasConfigFallback = node.config && node.config[portName] !== undefined;

        if (!hasIncomingEdge && !hasConfigFallback) {
          errors.push({
            code: ErrorCodes.REQUIRED_INPUT_MISSING,
            message: `Node '${nodeId}' (${node.type}) requires input port '${portName}', but no edge is connected and no default is provided`,
            nodeId,
            port: portName,
          });
        }
      }
    }
  }

  // 5. Cycle Detection using DFS (3-state coloring)
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
    errors.push({
      code: ErrorCodes.CYCLE_DETECTED,
      message: `Cycle detected in graph: ${cycleNodes[0].join(" -> ")}`,
      cycle: cycleNodes[0],
    });
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

module.exports = {
  validateWorkflow,
  SUPPORTED_SCHEMA_VERSIONS,
};
