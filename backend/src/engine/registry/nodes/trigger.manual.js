/**
 * Node: trigger.manual
 * Root entry point for workflow execution.
 * Has 0 graph input ports (it receives payload from execution triggerData).
 * Outputs payload onto 'output'.
 */

const { defineOutputPort, PortTypes } = require("../../contracts/ports");

module.exports = {
  type: "trigger.manual",
  version: 1,
  category: "trigger",
  label: "Manual Trigger",
  description: "Initiates workflow execution with payload received from run triggerData",
  inputs: {},
  outputs: {
    output: defineOutputPort({
      name: "output",
      type: PortTypes.ANY,
      description: "Trigger payload forwarded downstream",
    }),
  },
  configSchema: {
    triggerKey: {
      type: "string",
      required: false,
      default: "",
      description: "Identifier key for targeting this trigger when multiple manual triggers exist (e.g. 'orderData')",
    },
    defaultPayload: {
      type: "json",
      required: false,
      default: {},
      description: "Default fallback JSON payload if none supplied during run execution",
    },
  },
  validateConfig: (config) => {
    if (config && config.triggerKey !== undefined && typeof config.triggerKey !== "string") {
      return { valid: false, errors: ["Config property 'triggerKey' must be a string"], field: "config.triggerKey" };
    }
    return { valid: true };
  },
  capabilities: {
    pure: true,
    sideEffects: false,
    retryable: true,
  },
  handler: async (inputs, node, context = {}) => {
    const triggerData = context && context.triggerData;

    if (triggerData !== undefined && triggerData !== null) {
      // Check if triggerData is partitioned by trigger/node keys
      if (typeof triggerData === "object" && !Array.isArray(triggerData)) {
        // 1. Direct match by node.id (e.g. { "trigger_01": payload })
        if (triggerData[node.id] !== undefined) {
          return { output: triggerData[node.id] };
        }

        // 2. Match by custom triggerKey in node config (e.g. { "orderData": payload })
        const triggerKey = node.config && node.config.triggerKey;
        if (triggerKey && triggerKey.trim() !== "" && triggerData[triggerKey] !== undefined) {
          return { output: triggerData[triggerKey] };
        }

        // 3. Match by node.name (e.g. { "Manual Trigger 1": payload })
        if (node.name && triggerData[node.name] !== undefined) {
          return { output: triggerData[node.name] };
        }

        // 4. If explicitly packaged as a multi-trigger map ($multiTrigger: true)
        // and this node was not supplied a payload, fallback to defaultPayload
        if (triggerData.$multiTrigger === true) {
          if (node.config && node.config.defaultPayload !== undefined) {
            return { output: node.config.defaultPayload };
          }
          return { output: {} };
        }
      }

      // If triggerData is a direct primitive, array, or unpartitioned single payload, broadcast it
      return { output: triggerData };
    }

    // Fallback to configured defaultPayload
    if (node.config && node.config.defaultPayload !== undefined) {
      return { output: node.config.defaultPayload };
    }

    return { output: {} };
  },
};
