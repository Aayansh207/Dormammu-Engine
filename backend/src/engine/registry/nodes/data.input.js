/**
 * Node: data.input
 * Exposes run input values from trigger payload to the graph.
 */

const { defineOutputPort, PortTypes } = require("../../contracts/ports");

module.exports = {
  type: "data.input",
  version: 1,
  category: "trigger",
  label: "Input / Set Value",
  description: "Extracts a named value or whole payload from the run trigger data or default configuration",
  inputs: {},
  outputs: {
    output: defineOutputPort({
      name: "output",
      type: PortTypes.ANY,
      description: "Extracted value from trigger payload",
    }),
    value: defineOutputPort({
      name: "value",
      type: PortTypes.ANY,
      description: "Extracted value (alias)",
    }),
  },
  configSchema: {
    key: {
      type: "string",
      required: false,
      default: "",
      description: "Property key to extract from run trigger payload (leave blank for entire payload or default value)",
    },
    defaultValue: {
      type: "any",
      required: false,
      default: null,
      description: "Default fallback value if key is not present in trigger payload",
    },
  },
  validateConfig: (config) => {
    if (config && config.key !== undefined && typeof config.key !== "string") {
      return { valid: false, errors: ["Config property 'key' must be a string"], field: "config.key" };
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
    const triggerData = (context && context.triggerData) || {};

    let result;
    if (!key || key.trim() === "") {
      result = (node.config && node.config.defaultValue !== undefined && Object.keys(triggerData).length === 0)
        ? node.config.defaultValue
        : triggerData;
    } else {
      result = triggerData[key] !== undefined
        ? triggerData[key]
        : (node.config && node.config.defaultValue !== undefined ? node.config.defaultValue : null);
    }

    return {
      output: result,
      value: result,
    };
  },
};
