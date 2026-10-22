/**
 * Webster Execution Engine - Execution Planner
 * Builds deterministic DAG execution plans in O(V + E)
 */

const { validateWorkflow } = require("../validator/workflow.validator");
const { ErrorCodes, EngineError } = require("../contracts/errors");
const { defaultRegistry } = require("../registry/node.registry");

/**
 * Compiles a validated workflow definition into an immutable execution plan.
 * @param {Object} workflow - Workflow definition
 * @param {import('../registry/node.registry').NodeRegistry} [registry=defaultRegistry]
 * @returns {Object} Deterministic Execution Plan
 */
function createExecutionPlan(workflow, registry = defaultRegistry) {
  const validation = validateWorkflow(workflow, registry);
  if (!validation.valid) {
    const primaryError = validation.errors[0] || { code: "VALIDATION_FAILED", message: "Workflow validation failed" };
    throw new EngineError(
      primaryError.code,
      `Workflow validation failed: ${primaryError.message}`,
      { allErrors: validation.errors }
    );
  }

  const nodes = new Map();
  const inDegree = new Map();
  const incomingEdgesByNode = new Map();
  const outgoingEdgesByNode = new Map();
  const adjacencyList = new Map();
  const reverseAdjacencyList = new Map();

  // Initialize data structures for all nodes
  for (const rawNode of workflow.nodes) {
    const nodeClone = {
      id: rawNode.id,
      type: rawNode.type,
      version: rawNode.version || "1.0.0",
      name: rawNode.name || rawNode.id,
      position: rawNode.position ? { ...rawNode.position } : undefined,
      config: rawNode.config ? JSON.parse(JSON.stringify(rawNode.config)) : {},
    };
    nodes.set(nodeClone.id, nodeClone);
    inDegree.set(nodeClone.id, 0);
    incomingEdgesByNode.set(nodeClone.id, []);
    outgoingEdgesByNode.set(nodeClone.id, []);
    adjacencyList.set(nodeClone.id, []);
    reverseAdjacencyList.set(nodeClone.id, []);
  }

  // Index edges and calculate inDegrees
  const edges = (workflow.edges || []).map((e, idx) => ({
    id: e.id || `edge-${idx}`,
    source: e.source,
    sourcePort: e.sourcePort,
    target: e.target,
    targetPort: e.targetPort,
  }));

  for (const edge of edges) {
    // Increment in-degree for target
    const currentInDegree = inDegree.get(edge.target) || 0;
    inDegree.set(edge.target, currentInDegree + 1);

    // Track edge lookups
    incomingEdgesByNode.get(edge.target).push(edge);
    outgoingEdgesByNode.get(edge.source).push(edge);

    // Track adjacency
    adjacencyList.get(edge.source).push(edge.target);
    reverseAdjacencyList.get(edge.target).push(edge.source);
  }

  // Identify entry nodes (in-degree == 0), sorted deterministically by ID
  const entryNodeIds = Array.from(inDegree.entries())
    .filter(([_, deg]) => deg === 0)
    .map(([nodeId]) => nodeId)
    .sort();

  if (entryNodeIds.length === 0 && nodes.size > 0) {
    throw new EngineError(
      ErrorCodes.NO_ENTRY_NODES,
      "Workflow has no entry nodes (nodes with 0 incoming dependencies)",
      { totalNodes: nodes.size }
    );
  }

  // Identify terminal nodes (out-degree == 0), sorted deterministically by ID
  const terminalNodeIds = Array.from(outgoingEdgesByNode.entries())
    .filter(([_, edgeList]) => edgeList.length === 0)
    .map(([nodeId]) => nodeId)
    .sort();

  // Check for presence of output.return node
  let hasReturnNode = false;
  for (const node of nodes.values()) {
    if (node.type === "output.return") {
      hasReturnNode = true;
      break;
    }
  }

  return {
    schemaVersion: workflow.schemaVersion,
    name: workflow.name || "Untitled Workflow",
    nodes,
    edges,
    inDegree,
    incomingEdgesByNode,
    outgoingEdgesByNode,
    adjacencyList,
    reverseAdjacencyList,
    entryNodeIds,
    terminalNodeIds,
    hasReturnNode,
    totalNodes: nodes.size,
    warnings: validation.warnings || [],
  };
}

module.exports = {
  createExecutionPlan,
};
