/**
 * Node: flow.merge
 * Merges values and control-flow from multiple upstream branches into a single path.
 */

const { defineInputPort, defineOutputPort, PortTypes } = require("../../contracts/ports");
const { ErrorCodes, EngineError } = require("../../contracts/errors");

const SUPPORTED_MODES = ["first_available", "all", "coalesce", "object"];

module.exports = {
  type: "flow.merge",
  version: 1,
  category: "flow",
  label: "Merge Branches",
  description: "Combines data and execution from multiple upstream branches into a unified path",
  inputs: {
    input: defineInputPort({
      name: "input",
      type: PortTypes.ANY,
      allowMultiple: true,
      required: false,
      description: "Incoming branch connection(s) (supports multiple wires)",
    }),
    a: defineInputPort({ name: "a", type: PortTypes.ANY, required: false, description: "Alternative branch A input" }),
    b: defineInputPort({ name: "b", type: PortTypes.ANY, required: false, description: "Alternative branch B input" }),
  },
  outputs: {
    output: defineOutputPort({ name: "output", type: PortTypes.ANY, description: "Merged outcome" }),
  },
  configSchema: {
    mode: {
      type: "string",
      required: false,
      default: "first_available",
      enum: SUPPORTED_MODES,
      description: "Merge strategy: 'first_available' (forward first active branch value), 'coalesce' (forward first non-null active value), 'all' (collect all active branch values into array), or 'object' (merge active branch objects)",
    },
  },
  validateConfig: (config = {}) => {
    if (config.mode && !SUPPORTED_MODES.includes(config.mode)) {
      return {
        valid: false,
        errors: [`Invalid mode '${config.mode}'. Must be one of: ${SUPPORTED_MODES.join(", ")}`],
        field: "config.mode",
      };
    }
    return { valid: true };
  },
  capabilities: { pure: true, sideEffects: false, retryable: true },
  handler: async (inputs, node) => {
    const config = node.config || {};
    const mode = config.mode || "first_available";

    // Collect all candidate values from input (array if multiple edges), a, and b
    const rawCandidates = [];
    if (inputs.input !== undefined) {
      if (Array.isArray(inputs.input)) {
        rawCandidates.push(...inputs.input);
      } else {
        rawCandidates.push(inputs.input);
      }
    }
    if (inputs.a !== undefined) rawCandidates.push(inputs.a);
    if (inputs.b !== undefined) rawCandidates.push(inputs.b);

    switch (mode) {
      case "first_available": {
        const first = rawCandidates.find((c) => c !== undefined);
        return { output: first !== undefined ? first : null };
      }
      case "coalesce": {
        const firstValid = rawCandidates.find((c) => c !== null && c !== undefined);
        return { output: firstValid !== undefined ? firstValid : null };
      }
      case "all": {
        return { output: rawCandidates };
      }
      case "object": {
        const mergedObj = {};
        for (const item of rawCandidates) {
          if (item && typeof item === "object" && !Array.isArray(item)) {
            Object.assign(mergedObj, item);
          }
        }
        return { output: mergedObj };
      }
      default:
        throw new EngineError(ErrorCodes.MERGE_FAILED, `Unknown merge mode '${mode}'`);
    }
  },
};
