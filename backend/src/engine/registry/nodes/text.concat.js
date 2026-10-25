/**
 * Node: text.concat
 * Concatenates text strings (a + b).
 * Inputs: a (first text), b (second text).
 * Output: single 'output' port.
 */

const { defineInputPort, defineOutputPort, PortTypes } = require("../../contracts/ports");

module.exports = {
  type: "text.concat",
  version: 1,
  category: "text",
  label: "Concatenate Text",
  description: "Concatenates two strings together (a + b) with an optional separator and suffix",
  inputs: {
    a: defineInputPort({ name: "a", type: PortTypes.STRING, required: false, description: "First text" }),
    b: defineInputPort({ name: "b", type: PortTypes.STRING, required: false, description: "Second text" }),
  },
  outputs: {
    output: defineOutputPort({ name: "output", type: PortTypes.STRING, description: "Concatenated result" }),
  },
  configSchema: {
    separator: {
      type: "string",
      required: false,
      default: "",
      description: "Separator string between concatenated values",
    },
    suffix: {
      type: "string",
      required: false,
      default: "",
      description: "Optional suffix appended to the result",
    },
  },
  validateConfig: () => ({ valid: true }),
  capabilities: { pure: true, sideEffects: false, retryable: true },
  handler: async (inputs, node) => {
    const sep = (node.config && node.config.separator) || "";
    const suffix = (node.config && node.config.suffix) || "";

    const first = inputs.a !== undefined ? inputs.a : (inputs.input !== undefined ? inputs.input : "");
    const second = inputs.b !== undefined ? inputs.b : "";

    const result = `${String(first)}${second !== undefined && second !== "" ? sep + String(second) : ""}${suffix}`;
    return { output: result };
  },
};
