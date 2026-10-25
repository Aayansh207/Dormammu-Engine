/**
 * Node: output.return
 * Terminal node that declares and returns the final workflow output.
 * Input: single 'input' port.
 * Output: single 'output' port.
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
  },
  outputs: {
    output: defineOutputPort({
      name: "output",
      type: PortTypes.ANY,
      description: "Final value propagated",
    }),
  },
  validateConfig: () => ({ valid: true }),
  capabilities: { pure: true, sideEffects: false, retryable: true },
  handler: async (inputs) => {
    const res = inputs.input !== undefined ? inputs.input : inputs.value;
    return { output: res };
  },
};
