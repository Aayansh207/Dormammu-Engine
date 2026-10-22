/**
 * Node: text.concat
 * Concatenates text strings
 */

const { defineInputPort, defineOutputPort, PortTypes } = require("../../contracts/ports");

module.exports = {
  type: "text.concat",
  version: 1,
  category: "text",
  label: "Concatenate Text",
  description: "Concatenates two or more strings together with an optional separator",
  inputs: {
    a: defineInputPort({ name: "a", type: PortTypes.STRING, required: false, description: "First text" }),
    b: defineInputPort({ name: "b", type: PortTypes.STRING, required: false, description: "Second text" }),
    input: defineInputPort({ name: "input", type: PortTypes.STRING, required: false, description: "Input text" }),
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

    const result = `${String(first)}${second ? sep + String(second) : ""}${suffix}`;
    return { output: result };
  },
};
