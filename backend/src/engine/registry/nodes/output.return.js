/**
 * Node: output.return
 * Terminal node that declares and returns the final workflow output
 */

const { defineInputPort, defineOutputPort, PortTypes } = require("../../contracts/ports");

module.exports = {
  type: "output.return",
  version: "1.0.0",
  category: "output",
  label: "Workflow Return",
  description: "Specifies the final return value of the entire workflow run",
  inputs: {
    value: defineInputPort({ name: "value", type: PortTypes.ANY, required: true, description: "Final return value" }),
  },
  outputs: {
    finalValue: defineOutputPort({ name: "finalValue", type: PortTypes.ANY, description: "Propagated final value" }),
  },
  validateConfig: () => ({ valid: true }),
  capabilities: { pure: true, sideEffects: false, retryable: true },
  handler: async (inputs) => {
    return { finalValue: inputs.value };
  },
};
