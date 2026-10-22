/**
 * Webster Execution Engine - Central Node Registry
 */

const { ErrorCodes, EngineError } = require("../contracts/errors");
const { isValueCompatibleWithType } = require("../contracts/ports");

class NodeRegistry {
  constructor() {
    this._nodes = new Map();
  }

  /**
   * Registers a node definition with metadata, port declarations, and handler.
   * @param {Object} definition
   */
  register(definition) {
    if (!definition || typeof definition !== "object") {
      throw new Error("Node definition must be an object");
    }
    const { type, version = "1.0.0", category = "general", label, description = "", inputs = {}, outputs = {}, configSchema, validateConfig, capabilities = {}, handler } = definition;

    if (!type || typeof type !== "string") {
      throw new Error("Node definition must have a non-empty string 'type'");
    }
    if (typeof handler !== "function") {
      throw new Error(`Node '${type}' must declare an executable handler function`);
    }
    if (this._nodes.has(type)) {
      throw new Error(`Node type '${type}' is already registered in this registry`);
    }

    const normalizedInputs = {};
    for (const [portName, portDef] of Object.entries(inputs)) {
      normalizedInputs[portName] = {
        name: portDef.name || portName,
        type: portDef.type || "any",
        required: Boolean(portDef.required),
        defaultValue: portDef.defaultValue,
        description: portDef.description || "",
        allowMultiple: Boolean(portDef.allowMultiple),
      };
    }

    const normalizedOutputs = {};
    for (const [portName, portDef] of Object.entries(outputs)) {
      normalizedOutputs[portName] = {
        name: portDef.name || portName,
        type: portDef.type || "any",
        description: portDef.description || "",
      };
    }

    this._nodes.set(type, {
      type,
      version,
      category,
      label: label || type,
      description,
      inputs: normalizedInputs,
      outputs: normalizedOutputs,
      configSchema: configSchema || null,
      validateConfig: typeof validateConfig === "function" ? validateConfig : () => ({ valid: true }),
      capabilities: {
        pure: capabilities.pure !== undefined ? Boolean(capabilities.pure) : true,
        sideEffects: Boolean(capabilities.sideEffects),
        retryable: capabilities.retryable !== undefined ? Boolean(capabilities.retryable) : true,
        timeoutMs: capabilities.timeoutMs || 10000,
      },
      handler,
    });
  }

  /**
   * Checks if a node type is registered.
   * @param {string} type
   * @returns {boolean}
   */
  has(type) {
    return this._nodes.has(type);
  }

  /**
   * Retrieves a registered node definition by type.
   * Throws EngineError if unknown.
   * @param {string} type
   * @returns {Object}
   */
  get(type) {
    const node = this._nodes.get(type);
    if (!node) {
      throw new EngineError(
        ErrorCodes.UNKNOWN_NODE_TYPE,
        `Unknown node type '${type}'`,
        { nodeType: type }
      );
    }
    return node;
  }

  /**
   * Returns catalogue metadata for all registered nodes (safe for client inspection).
   * @returns {Array<Object>}
   */
  list() {
    return Array.from(this._nodes.values()).map((node) => ({
      type: node.type,
      version: node.version,
      category: node.category,
      label: node.label,
      description: node.description,
      inputs: node.inputs,
      outputs: node.outputs,
      configSchema: node.configSchema,
      capabilities: node.capabilities,
    }));
  }

  /**
   * Returns serializable metadata for a single node type.
   * @param {string} type
   * @returns {Object}
   */
  getMetadata(type) {
    const node = this.get(type);
    return {
      type: node.type,
      version: node.version,
      category: node.category,
      label: node.label,
      description: node.description,
      inputs: node.inputs,
      outputs: node.outputs,
      configSchema: node.configSchema,
      capabilities: node.capabilities,
    };
  }

  /**
   * Validates a node configuration object against the node's registered config validator.
   * @param {string} type
   * @param {Object} config
   * @returns {{ valid: boolean, errors?: string[] }}
   */
  validateConfig(type, config = {}) {
    const node = this.get(type);
    return node.validateConfig(config);
  }

  /**
   * Validates resolved inputs against the node's declared ports and types.
   * @param {string} type
   * @param {Object} inputs
   * @returns {{ valid: boolean, errors: Array<{ port: string, code: string, message: string }> }}
   */
  validateInputs(type, inputs = {}) {
    const node = this.get(type);
    const errors = [];

    for (const [portName, portDef] of Object.entries(node.inputs)) {
      const value = inputs[portName];
      const isMissing = value === undefined;

      if (isMissing && portDef.required && portDef.defaultValue === undefined) {
        errors.push({
          port: portName,
          code: ErrorCodes.REQUIRED_INPUT_MISSING,
          message: `Required input port '${portName}' on node type '${type}' is missing`,
        });
        continue;
      }

      const effectiveValue = isMissing ? portDef.defaultValue : value;
      if (!isMissing && !isValueCompatibleWithType(effectiveValue, portDef.type)) {
        errors.push({
          port: portName,
          code: ErrorCodes.PORT_TYPE_MISMATCH,
          message: `Input port '${portName}' expects type '${portDef.type}', received '${typeof effectiveValue}'`,
        });
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Clears registry entries (useful for testing isolated registries).
   */
  clear() {
    this._nodes.clear();
  }
}

// Global default singleton registry
const defaultRegistry = new NodeRegistry();

module.exports = {
  NodeRegistry,
  defaultRegistry,
};

// Auto-register core nodes into default singleton registry
try {
  require("./nodes");
} catch (e) {
  // Ignore in case of circular bootstrap
}
