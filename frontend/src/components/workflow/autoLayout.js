/**
 * Auto-layout algorithm for DAG workflows.
 * Computes topological layers and neatly arranges nodes from left to right.
 */
export function calculateAutoLayout(nodes = [], edges = []) {
  if (!nodes || nodes.length === 0) return [];
  if (nodes.length === 1) {
    return [{ ...nodes[0], position: { x: 140, y: 160 } }];
  }

  const nodeMap = new Map();
  const inDegree = new Map();
  const adj = new Map();

  for (const n of nodes) {
    nodeMap.set(n.id, n);
    inDegree.set(n.id, 0);
    adj.set(n.id, []);
  }

  // Build edges
  for (const e of edges) {
    if (adj.has(e.source) && inDegree.has(e.target)) {
      adj.get(e.source).push(e.target);
      inDegree.set(e.target, inDegree.get(e.target) + 1);
    }
  }

  // Compute depth layer for each node using topological traversal
  const layers = new Map();
  const queue = [];

  // Seed with root nodes (inDegree === 0)
  for (const n of nodes) {
    if (inDegree.get(n.id) === 0) {
      layers.set(n.id, 0);
      queue.push(n.id);
    }
  }

  // If graph has cycles or no 0-indegree node, pick triggers or first node
  if (queue.length === 0) {
    const trigger = nodes.find((n) => n.type.startsWith("trigger")) || nodes[0];
    layers.set(trigger.id, 0);
    queue.push(trigger.id);
  }

  const visited = new Set();
  while (queue.length > 0) {
    const currId = queue.shift();
    visited.add(currId);
    const currLayer = layers.get(currId) || 0;

    const neighbors = adj.get(currId) || [];
    for (const nextId of neighbors) {
      const nextLayer = Math.max(layers.get(nextId) || 0, currLayer + 1);
      layers.set(nextId, nextLayer);

      if (!visited.has(nextId) && !queue.includes(nextId)) {
        queue.push(nextId);
      }
    }
  }

  // Handle any disconnected or unvisited nodes
  for (const n of nodes) {
    if (!layers.has(n.id)) {
      layers.set(n.id, 0);
    }
  }

  // Group nodes by layer index
  const layerGroups = {};
  for (const n of nodes) {
    const l = layers.get(n.id) || 0;
    if (!layerGroups[l]) layerGroups[l] = [];
    layerGroups[l].push(n);
  }

  // Assign clean positions: columns left to right, rows top to bottom
  const HORIZONTAL_GAP = 360;
  const VERTICAL_GAP = 180;
  const START_X = 120;
  const START_Y = 120;

  const result = [];
  const layerKeys = Object.keys(layerGroups).map(Number).sort((a, b) => a - b);

  for (const l of layerKeys) {
    const group = layerGroups[l];
    group.forEach((node, idx) => {
      result.push({
        ...node,
        position: {
          x: START_X + l * HORIZONTAL_GAP,
          y: START_Y + idx * VERTICAL_GAP,
        },
      });
    });
  }

  return result;
}
