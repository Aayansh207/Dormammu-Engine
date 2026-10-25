/**
 * Node: json.parse
 * Parses a JSON string into an object or value.
 * Input: single 'input' port.
 * Output: single 'output' port.
 */

const { defineInputPort, defineOutputPort, PortTypes } = require("../../contracts/ports");
const { ErrorCodes, EngineError } = require("../../contracts/errors");

module.exports = {
  type: "json.parse",
  version: 1,
  category: "json",
  label: "JSON Parse",
  description: "Parses a valid JSON string into an object or primitive value",
  inputs: {
    input: defineInputPort({ name: "input", type: PortTypes.STRING, required: false, description: "JSON string to parse" }),
  },
  outputs: {
    output: defineOutputPort({ name: "output", type: PortTypes.ANY, description: "Parsed JSON data object/array" }),
  },
  configSchema: {
    defaultText: {
      type: "string",
      required: false,
      default: "{}",
      description: "Default JSON string if input port is not provided",
    },
  },
  validateConfig: () => ({ valid: true }),
  capabilities: { pure: true, sideEffects: false, retryable: true },
  handler: async (inputs, node) => {
    const raw = inputs.input !== undefined
      ? inputs.input
      : (inputs.text !== undefined ? inputs.text : (node.config && node.config.defaultText ? node.config.defaultText : "{}"));

    try {
      const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
      return { output: parsed };
    } catch (err) {
      throw new EngineError(
        ErrorCodes.INVALID_JSON,
        `Failed to parse JSON string: ${err.message}`,
        { nodeId: node && node.id, textSample: String(raw).slice(0, 100) }
      );
    }
  },
};
