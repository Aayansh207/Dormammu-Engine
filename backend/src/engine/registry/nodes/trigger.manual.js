/**
 * Node: trigger.manual
 * Initiates workflow execution manually with an optional payload.
 */

const { defineInputPort, defineOutputPort, PortTypes } = require("../../contracts/ports");

module.exports = {
  type: "trigger.manual",
  version: "1.0.0",
  category: "trigger",
  label: "Manual Trigger",
  description: "Triggers execution manually with input payload",
  inputs: {
    payload: defineInputPort({
      name: "payload",
      type: PortTypes.ANY,
      required: false,
      defaultValue: {},
      description: "Optional payload provided at trigger time",
    }),
  },
  outputs: {
    output: defineOutputPort({
      name: "output",
      type: PortTypes.ANY,
      description: "Output payload forwarded to downstream nodes",
    }),
  },
  validateConfig: () => ({ valid: true }),
  capabilities: {
    pure: true,
    sideEffects: false,
    retryable: true,
  },
  handler: async (inputs, node, context) => {
    // If input port received payload, use it; otherwise fallback to context.triggerData
    const payload = inputs.payload !== undefined && Object.keys(inputs.payload || {}).length > 0
      ? inputs.payload
      : (context.triggerData || {});
    return { output: payload };
  },
};
