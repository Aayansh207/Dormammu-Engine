/**
 * Node: trigger.manual
 * Initiates workflow execution manually with an optional payload.
 */

const { defineInputPort, defineOutputPort, PortTypes } = require("../../contracts/ports");

module.exports = {
  type: "trigger.manual",
  version: 1,
  category: "trigger",
  label: "Manual Trigger",
  description: "Initiates workflow execution manually with optional input payload",
  inputs: {
    input: defineInputPort({
      name: "input",
      type: PortTypes.ANY,
      required: false,
      description: "Optional payload provided at trigger time",
    }),
    payload: defineInputPort({
      name: "payload",
      type: PortTypes.ANY,
      required: false,
      description: "Optional payload provided at trigger time (alias)",
    }),
  },
  outputs: {
    output: defineOutputPort({
      name: "output",
      type: PortTypes.ANY,
      description: "Output payload forwarded to downstream nodes",
    }),
  },
  configSchema: {
    defaultPayload: {
      type: "json",
      required: false,
      default: {},
      description: "Default JSON payload if none supplied during run execution",
    },
  },
  validateConfig: () => ({ valid: true }),
  capabilities: {
    pure: true,
    sideEffects: false,
    retryable: true,
  },
  handler: async (inputs, node, context) => {
    // 1. If context.triggerData was passed explicitly at execution time
    const triggerData = context && context.triggerData;
    if (triggerData !== undefined && triggerData !== null) {
      // If triggerData is { input: 10 } or { value: 10 } or raw primitive 10
      return { output: triggerData };
    }

    // 2. If an edge connected into input or payload
    if (inputs.input !== undefined) {
      return { output: inputs.input };
    }
    if (inputs.payload !== undefined) {
      return { output: inputs.payload };
    }

    // 3. Fallback to default payload from config
    const configDefault = (node && node.config && node.config.defaultPayload) !== undefined
      ? node.config.defaultPayload
      : {};

    return { output: configDefault };
  },
};
