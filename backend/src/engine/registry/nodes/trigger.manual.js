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
      type: "any",
      required: false,
      default: 0,
      description: "Default fallback value or JSON payload if none supplied during run execution",
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

    // Helper to normalize and unwrap payloads
    const normalizePayload = (val) => {
      if (val === undefined || val === null) return val;
      if (typeof val === "object" && !Array.isArray(val)) {
        if (val.value !== undefined) return normalizePayload(val.value);
        if (val.payload !== undefined) return normalizePayload(val.payload);
        if (val.output !== undefined) return normalizePayload(val.output);
        // If empty object {} and node has configured defaultPayload, use defaultPayload
        if (Object.keys(val).length === 0 && node.config && node.config.defaultPayload !== undefined && node.config.defaultPayload !== "") {
          return normalizePayload(node.config.defaultPayload);
        }
      }
      if (typeof val === "string" && val.trim() !== "" && !isNaN(Number(val))) {
        return Number(val);
      }
      return val;
    };

    if (triggerData !== undefined && triggerData !== null) {
      // If ingested via webhook endpoint, extract request body
      if (typeof triggerData === "object" && triggerData.$webhook === true && triggerData.body !== undefined) {
        return { output: normalizePayload(triggerData.body) };
      }

      // Check if triggerData is partitioned by trigger/node keys
      if (typeof triggerData === "object" && !Array.isArray(triggerData)) {
        // 1. Direct match by node.id (e.g. { "trigger_01": payload })
        if (triggerData[node.id] !== undefined) {
          return { output: normalizePayload(triggerData[node.id]) };
        }

        // 2. Match by custom triggerKey in node config (e.g. { "orderData": payload })
        const triggerKey = node.config && node.config.triggerKey;
        if (triggerKey && triggerKey.trim() !== "" && triggerData[triggerKey] !== undefined) {
          return { output: normalizePayload(triggerData[triggerKey]) };
        }

        // 3. Match by index in $triggers / $triggerIds array
        if (Array.isArray(triggerData.$triggerIds)) {
          const idx = triggerData.$triggerIds.indexOf(node.id);
          if (idx !== -1 && Array.isArray(triggerData.$triggers) && triggerData.$triggers[idx] !== undefined) {
            return { output: normalizePayload(triggerData.$triggers[idx]) };
          }
        }

        // 4. Match by node.name only if uniquely targeted and not colliding
        if (node.name && triggerData[node.name] !== undefined && triggerData[node.name] !== null) {
          const nameVal = triggerData[node.name];
          if (typeof nameVal !== "object" || Object.keys(nameVal).length > 0) {
            return { output: normalizePayload(nameVal) };
          }
        }

        // 5. If explicitly packaged as a multi-trigger map ($multiTrigger: true)
        // and this node was not supplied a payload, fallback to defaultPayload
        if (triggerData.$multiTrigger === true) {
          if (node.config && node.config.defaultPayload !== undefined && node.config.defaultPayload !== "") {
            return { output: normalizePayload(node.config.defaultPayload) };
          }
          return { output: 0 };
        }

        // 6. If triggerData is an empty object ({}) and node has configured defaultPayload,
        // use defaultPayload
        if (Object.keys(triggerData).length === 0 && node.config && node.config.defaultPayload !== undefined && node.config.defaultPayload !== "") {
          return { output: normalizePayload(node.config.defaultPayload) };
        }

        // 7. Direct convenience wrappers: { value: x } or { payload: x }
        if (Object.keys(triggerData).length === 1) {
          if (triggerData.value !== undefined) return { output: normalizePayload(triggerData.value) };
          if (triggerData.payload !== undefined) return { output: normalizePayload(triggerData.payload) };
        }
      }

      // If triggerData is a direct primitive, array, or unpartitioned single payload, broadcast it
      return { output: normalizePayload(triggerData) };
    }

    // Fallback to configured defaultPayload
    if (node.config && node.config.defaultPayload !== undefined && node.config.defaultPayload !== "") {
      return { output: normalizePayload(node.config.defaultPayload) };
    }

    return { output: 0 };
  },
};
