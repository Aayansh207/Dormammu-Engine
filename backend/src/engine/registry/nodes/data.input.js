/**
 * Node: data.input
 * Exposes run input values from trigger payload to the graph.
 * Outputs value onto single 'output' port.
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
      description: "Extracted value from trigger payload or default",
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
    const triggerData = (context && context.triggerData !== undefined && context.triggerData !== null) ? context.triggerData : {};

    const isScheduledEnvelope = typeof triggerData === "object" && triggerData !== null &&
      (triggerData.$interval === true || triggerData.$scheduledIncident === true || triggerData.$cron === true);

    const isTriggerDataEmpty = (typeof triggerData === "object" && triggerData !== null && !Array.isArray(triggerData))
      ? (Object.keys(triggerData).length === 0 || isScheduledEnvelope)
      : false;

    if (!key || key.trim() === "") {
      result = (node.config && node.config.defaultValue !== undefined && isTriggerDataEmpty)
        ? node.config.defaultValue
        : triggerData;
    } else {
      if (typeof triggerData === "object" && triggerData !== null && key in triggerData) {
        result = triggerData[key];
      } else if (triggerData.payload && typeof triggerData.payload === "object" && key in triggerData.payload) {
        result = triggerData.payload[key];
      } else {
        result = (node.config && node.config.defaultValue !== undefined) ? node.config.defaultValue : null;
      }
    }

    return { output: result };
  },
};
