/**
 * Node: data.input
 * Exposes run input values from trigger payload to the graph.
 */

const { defineOutputPort, PortTypes } = require("../../contracts/ports");

module.exports = {
  type: "data.input",
  version: "1.0.0",
  category: "data",
  label: "Run Input Data",
  description: "Extracts a named value or whole payload from the run trigger data",
  inputs: {},
  outputs: {
    value: defineOutputPort({
      name: "value",
      type: PortTypes.ANY,
      description: "Extracted value from trigger payload",
    }),
  },
  validateConfig: (config) => {
    if (config && config.key !== undefined && typeof config.key !== "string") {
      return { valid: false, errors: ["Config property 'key' must be a string"] };
    }
    return { valid: true };
  },
  capabilities: {
    pure: true,
    sideEffects: false,
    retryable: true,
  },
  handler: async (inputs, node, context) => {
    const key = node.config && node.config.key;
    const triggerData = context.triggerData || {};

    if (!key) {
      // Returns entire trigger data if no key specified
      return { value: triggerData };
    }

    const value = triggerData[key] !== undefined
      ? triggerData[key]
      : (node.config && node.config.defaultValue !== undefined ? node.config.defaultValue : null);

    return { value };
  },
};
