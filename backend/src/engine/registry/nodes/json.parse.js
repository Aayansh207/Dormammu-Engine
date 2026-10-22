/**
 * Node: json.parse
 * Parses a JSON string into an object or value
 */

const { defineInputPort, defineOutputPort, PortTypes } = require("../../contracts/ports");
const { ErrorCodes, EngineError } = require("../../contracts/errors");

module.exports = {
  type: "json.parse",
  version: "1.0.0",
  category: "json",
  label: "JSON Parse",
  description: "Parses a valid JSON string into an object or primitive value",
  inputs: {
    text: defineInputPort({ name: "text", type: PortTypes.STRING, required: true, description: "JSON string to parse" }),
  },
  outputs: {
    data: defineOutputPort({ name: "data", type: PortTypes.ANY, description: "Parsed JSON data" }),
  },
  validateConfig: () => ({ valid: true }),
  capabilities: { pure: true, sideEffects: false, retryable: true },
  handler: async (inputs, node) => {
    try {
      const parsed = JSON.parse(inputs.text);
      return { data: parsed };
    } catch (err) {
      throw new EngineError(
        ErrorCodes.INVALID_JSON,
        `Failed to parse JSON string: ${err.message}`,
        { nodeId: node && node.id, textSample: String(inputs.text).slice(0, 100) }
      );
    }
  },
};
