/**
 * Webster Standard Workflow Types and Contracts
 */

export type NodeCategory =
  | "trigger"
  | "mathematical"
  | "control"
  | "json"
  | "text"
  | "utility"
  | "output"
  | "general";

export interface NodePortDefinition {
  name: string;
  type: "string" | "number" | "boolean" | "object" | "array" | "any";
  required?: boolean;
  defaultValue?: any;
  description?: string;
  allowMultiple?: boolean;
}

export interface NodeConfigPropertySchema {
  type: "string" | "number" | "boolean" | "json" | "select";
  required?: boolean;
  default?: any;
  description?: string;
  options?: Array<{ label: string; value: any }> | string[];
  min?: number;
  max?: number;
}

export interface NodeCapabilities {
  pure?: boolean;
  sideEffects?: boolean;
  retryable?: boolean;
  timeoutMs?: number;
}

export interface NodeCatalogueItem {
  type: string;
  version: number | string;
  category: NodeCategory | string;
  label: string;
  description: string;
  inputs: Record<string, NodePortDefinition>;
  outputs: Record<string, NodePortDefinition>;
  configSchema?: Record<string, NodeConfigPropertySchema> | null;
  capabilities?: NodeCapabilities;
}

export interface NodePosition {
  x: number;
  y: number;
}

export interface NodeInstance {
  id: string;
  type: string;
  version: number | string;
  name: string;
  position: NodePosition;
  config: Record<string, any>;
}

export interface EdgeInstance {
  id: string;
  source: string;
  sourcePort: string;
  target: string;
  targetPort: string;
}

export interface WorkflowDefinition {
  schemaVersion: number | string;
  name: string;
  nodes: NodeInstance[];
  edges: EdgeInstance[];
}

export interface ValidationError {
  code: string;
  message: string;
  nodeId: string | null;
  edgeId: string | null;
  field: string | null;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
}

export interface TaskRunResult {
  id?: string;
  nodeId: string;
  status: "PENDING" | "READY" | "RUNNING" | "SUCCEEDED" | "FAILED" | "BLOCKED" | "SKIPPED";
  attempts?: number;
  input?: any;
  output?: any;
  error?: any;
  startedAt?: string;
  finishedAt?: string;
}

export interface WorkflowRunResult {
  runId: string;
  workflowId?: string;
  workflowVersionId?: string;
  workflowName: string;
  schemaVersion?: number | string;
  status: "CREATED" | "RUNNING" | "SUCCEEDED" | "FAILED" | "CANCELLED";
  startedAt: string;
  finishedAt?: string | null;
  finalOutput?: any;
  error?: any;
  executionTrace?: any[];
  taskRuns?: Record<string, TaskRunResult>;
}
