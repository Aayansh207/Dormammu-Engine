/**
 * Node: output.return
 * Terminal node that declares and returns the final workflow output
 */

const { defineInputPort, defineOutputPort, PortTypes } = require("../../contracts/ports");

module.exports = {
  type: "output.return",
  version: 1,
  category: "output",
  label: "Return Output",
  description: "Declares and returns the final workflow execution output",
  inputs: {
    input: defineInputPort({
      name: "input",
      type: PortTypes.ANY,
      required: false,
      description: "Final return value",
    }),
    value: defineInputPort({
      name: "value",
      type: PortTypes.ANY,
      required: false,
      description: "Final return value (alias)",
    }),
  },
  outputs: {
    output: defineOutputPort({
      name: "output",
      type: PortTypes.ANY,
      description: "Final value propagated",
    }),
    finalValue: defineOutputPort({
      name: "finalValue",
      type: PortTypes.ANY,
      description: "Final value propagated (alias)",
    }),
  },
  validateConfig: () => ({ valid: true }),
  capabilities: { pure: true, sideEffects: false, retryable: true },
  handler: async (inputs) => {
    const res = inputs.input !== undefined ? inputs.input : inputs.value;
    return {
      output: res,
      finalValue: res,
    };
  },
};
