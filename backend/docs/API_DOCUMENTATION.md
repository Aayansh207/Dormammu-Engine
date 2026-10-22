# Webster Workflow Builder & Execution Engine API Documentation

Webster is a workflow automation platform where users create workflows by connecting nodes, save versioned workflow definitions, validate them across multiple structural and graph levels, and execute them sequentially through an in-process DAG execution engine.

---

## 1. Architectural Standards & Contracts

### 1.1 Node Instance Format
Every node instance within a workflow definition adheres to the canonical standard:
```json
{
  "id": "node_01",
  "type": "math.multiply",
  "version": 1,
  "name": "Multiply Values",
  "position": {
    "x": 320,
    "y": 180
  },
  "config": {
    "factor": 5
  }
}
```

### 1.2 Edge Connection Format
Connections between ports use the canonical format:
```json
{
  "id": "edge_01",
  "source": "trigger_01",
  "sourcePort": "output",
  "target": "math_01",
  "targetPort": "input"
}
```

### 1.3 Canonical Workflow Definition
```json
{
  "schemaVersion": 1,
  "name": "My First Workflow",
  "nodes": [
    {
      "id": "trigger_01",
      "type": "trigger.manual",
      "version": 1,
      "name": "Manual Trigger",
      "position": { "x": 100, "y": 200 },
      "config": {}
    },
    {
      "id": "math_01",
      "type": "math.multiply",
      "version": 1,
      "name": "Multiply",
      "position": { "x": 350, "y": 200 },
      "config": { "factor": 5 }
    },
    {
      "id": "output_01",
      "type": "output.return",
      "version": 1,
      "name": "Return Result",
      "position": { "x": 600, "y": 200 },
      "config": {}
    }
  ],
  "edges": [
    {
      "id": "edge_01",
      "source": "trigger_01",
      "sourcePort": "output",
      "target": "math_01",
      "targetPort": "input"
    },
    {
      "id": "edge_02",
      "source": "math_01",
      "sourcePort": "output",
      "target": "output_01",
      "targetPort": "input"
    }
  ]
}
```

---

## 2. Validation Standard & Error Codes

Validation is performed at 4 levels before saving/running:
1. **Level 1 (Structural):** Schema version, object shapes, non-empty IDs, valid types.
2. **Level 2 (Graph):** Source/target node existence, port existence, duplicate edges, self-loops, and cycles (DFS 3-color DAG check).
3. **Level 3 (Node Config):** Type-specific schema constraints (e.g. finite numbers, valid paths, non-zero divisors).
4. **Level 4 (Semantic):** Mandatory input connections, port type compatibility.

### Standard Error Response Format
```json
{
  "valid": false,
  "errors": [
    {
      "code": "CYCLE_DETECTED",
      "message": "Cycle detected in graph: node_A -> node_B -> node_A",
      "nodeId": null,
      "edgeId": null,
      "field": null
    },
    {
      "code": "NODE_CONFIG_INVALID",
      "message": "Node 'math_01' configuration invalid: Factor must be a finite number",
      "nodeId": "math_01",
      "edgeId": null,
      "field": "config.factor"
    }
  ],
  "warnings": [
    {
      "code": "DISCONNECTED_GRAPH_WARNING",
      "message": "Node 'orphan_node' is disconnected from the workflow graph.",
      "nodeId": "orphan_node",
      "edgeId": null,
      "field": null
    }
  ]
}
```

---

## 3. Node Catalogue (Phase 1)

| Type | Category | Inputs | Outputs | Config Schema |
|------|----------|--------|---------|---------------|
| `trigger.manual` | `trigger` | `input`, `payload` | `output` | `defaultPayload` |
| `data.input` | `trigger` | - | `output`, `value` | `key`, `defaultValue` |
| `math.multiply` | `mathematical` | `input`, `a`, `b` | `output`, `result` | `factor` |
| `math.add` | `mathematical` | `input`, `a`, `b` | `output`, `result` | `addend` |
| `math.subtract` | `mathematical` | `input`, `a`, `b` | `output`, `result` | `subtrahend` |
| `math.divide` | `mathematical` | `input`, `a`, `b` | `output`, `result` | `divisor` |
| `math.modulo` | `mathematical` | `a`, `b` | `result` | - |
| `math.power` | `mathematical` | `base`, `exponent` | `result` | - |
| `math.round` | `mathematical` | `value` | `result` | `precision`, `mode` |
| `math.abs` | `mathematical` | `value` | `result` | - |
| `math.min` | `mathematical` | `a`, `b` | `result` | - |
| `math.max` | `mathematical` | `a`, `b` | `result` | - |
| `math.average` | `mathematical` | `a`, `b`, `input` | `output`, `result` | - |
| `json.parse` | `json` | `input`, `text` | `output`, `data` | `defaultText` |
| `json.get` | `json` | `input`, `object`, `path` | `output`, `value` | `path` |
| `text.concat` | `text` | `a`, `b`, `input` | `output` | `separator`, `suffix` |
| `utility.uuid` | `utility` | - | `output`, `uuid` | - |
| `utility.datetime` | `utility` | - | `output`, `timestamp` | - |
| `output.log` | `output` | `input`, `message` | `output`, `logged` | `level` |
| `output.return` | `output` | `input`, `value` | `output`, `finalValue` | - |

---

## 4. REST API Reference

### 4.1 Node Catalogue
#### `GET /api/nodes`
Returns metadata catalogue for all registered nodes. Public.
**Response `200 OK`:**
```json
{
  "success": true,
  "data": [
    {
      "type": "math.multiply",
      "version": 1,
      "category": "mathematical",
      "label": "Multiply",
      "description": "Multiplies a numeric input by a factor or computes product (a * b)",
      "inputs": {
        "input": { "name": "input", "type": "number", "required": false },
        "a": { "name": "a", "type": "number", "required": false },
        "b": { "name": "b", "type": "number", "required": false }
      },
      "outputs": {
        "output": { "name": "output", "type": "number" },
        "result": { "name": "result", "type": "number" }
      },
      "configSchema": {
        "factor": { "type": "number", "required": false, "default": 1 }
      }
    }
  ]
}
```

#### `GET /api/nodes/:type`
Returns catalogue metadata for a single node type.

---

### 4.2 Workflows

#### `POST /api/workflows`
Creates a workflow and records version 1 in PostgreSQL. Requires Bearer Token.
**Request Body:**
```json
{
  "name": "My Multiplication Flow",
  "description": "Multiply input by 5",
  "definition": { ... }
}
```
**Response `201 Created`:**
```json
{
  "success": true,
  "data": {
    "id": "3c90e8a7-7b19-4ec4-9d5a-8b1e06fa99e1",
    "name": "My Multiplication Flow",
    "currentVersion": 1,
    "schemaVersion": "1.0",
    "definition": { ... },
    "validation": { "valid": true, "errors": [], "warnings": [] }
  }
}
```

#### `GET /api/workflows`
Lists all workflows owned by the authenticated user.
**Response `200 OK`:**
```json
{
  "success": true,
  "data": [
    {
      "id": "3c90e8a7-7b19-4ec4-9d5a-8b1e06fa99e1",
      "name": "My Multiplication Flow",
      "latestVersion": 2,
      "nodesCount": 3,
      "edgesCount": 2,
      "totalVersions": 2,
      "updatedAt": "2026-10-22T16:15:00.000Z"
    }
  ]
}
```

#### `GET /api/workflows/:id`
Retrieves a workflow and its latest saved definition. Enforces owner authorization.

#### `PUT /api/workflows/:id`
Saves an updated workflow definition. **Creates a new immutable `WorkflowVersion` record with version number incremented (`v1 -> v2`).**
**Request Body:**
```json
{
  "name": "Updated Workflow Name",
  "definition": { ... }
}
```
**Response `200 OK`:**
```json
{
  "success": true,
  "data": {
    "id": "3c90e8a7-7b19-4ec4-9d5a-8b1e06fa99e1",
    "name": "Updated Workflow Name",
    "version": 2,
    "definition": { ... },
    "validation": { "valid": true, "errors": [], "warnings": [] }
  }
}
```

#### `POST /api/workflows/validate`
Validates any workflow definition payload without saving to the database. Public or authenticated.
**Request Body:**
```json
{
  "definition": { ... }
}
```
**Response `200 OK`:**
```json
{
  "success": true,
  "data": {
    "valid": true,
    "errors": [],
    "warnings": []
  }
}
```

---

### 4.3 Execution Engine Runs

#### `POST /api/workflows/:id/runs`
Executes a workflow's latest saved immutable version (or specific versionId).
1. Validates the definition.
2. Creates `WorkflowRun` in PostgreSQL with status `RUNNING`.
3. Runs the sequential DAG scheduler.
4. Persists each node's execution into `TaskRun` records.
5. Updates `WorkflowRun` with final output and status (`SUCCEEDED` / `FAILED`).

**Request Body:**
```json
{
  "triggerData": 10
}
```
**Response `200 OK`:**
```json
{
  "success": true,
  "data": {
    "runId": "48b0a9cd-ef31-4a12-8789-913b2d1804fa",
    "workflowId": "3c90e8a7-7b19-4ec4-9d5a-8b1e06fa99e1",
    "workflowName": "My Multiplication Flow",
    "version": 2,
    "status": "SUCCEEDED",
    "finalOutput": 50,
    "durationMs": 4,
    "startedAt": "2026-10-22T16:20:00.000Z",
    "completedAt": "2026-10-22T16:20:00.004Z",
    "tasks": {
      "trigger_01": { "status": "SUCCEEDED", "durationMs": 1, "outputs": { "output": 10 } },
      "math_01": { "status": "SUCCEEDED", "durationMs": 1, "outputs": { "output": 50 } },
      "output_01": { "status": "SUCCEEDED", "durationMs": 1, "outputs": { "output": 50 } }
    }
  }
}
```

#### `GET /api/runs/:runId`
Retrieves run metadata and all associated `TaskRun` records. Requires workflow ownership.

#### `GET /api/runs/:runId/tasks`
Returns task run array for the specified execution run.
