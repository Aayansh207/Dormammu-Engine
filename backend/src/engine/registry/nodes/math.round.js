/**
 * Node: math.round
 * Rounds a number to a specified precision and mode.
 * Input: single 'input' port.
 * Output: single 'output' port.
 */

const { defineInputPort, defineOutputPort, PortTypes } = require("../../contracts/ports");

module.exports = {
  type: "math.round",
  version: 1,
  category: "mathematical",
  label: "Round",
  description: "Rounds a number to specified decimal precision using round, floor, or ceil mode",
  inputs: {
    input: defineInputPort({ name: "input", type: PortTypes.NUMBER, required: false, description: "Number to round" }),
  },
  outputs: {
    output: defineOutputPort({ name: "output", type: PortTypes.NUMBER, description: "Rounded number result" }),
  },
  configSchema: {
    precision: {
      type: "number",
      required: false,
      default: 0,
      description: "Number of decimal places to keep (0 for integer)",
    },
    mode: {
      type: "select",
      required: false,
      default: "round",
      options: ["round", "floor", "ceil"],
      description: "Rounding mode algorithm",
    },
  },
  validateConfig: (config = {}) => {
    if (config.precision !== undefined) {
      if (typeof config.precision !== "number" || config.precision < 0 || !Number.isFinite(config.precision)) {
        return { valid: false, errors: ["Config 'precision' must be a non-negative finite number"], field: "config.precision" };
      }
    }
    if (config.mode !== undefined) {
      const validModes = ["round", "floor", "ceil"];
      if (!validModes.includes(config.mode)) {
        return { valid: false, errors: [`Config 'mode' must be one of: ${validModes.join(", ")}`], field: "config.mode" };
      }
    }
    return { valid: true };
  },
  capabilities: { pure: true, sideEffects: false, retryable: true },
  handler: async (inputs, node) => {
    const rawVal = inputs.input !== undefined ? inputs.input : inputs.value;
    const precision = (node.config && typeof node.config.precision === "number")
      ? node.config.precision
      : ((node.config && typeof node.config.decimals === "number") ? node.config.decimals : 0);
    const mode = (node.config && node.config.mode) || "round";

    const num = Number(rawVal || 0);
    const factor = Math.pow(10, precision);

    let rounded;
    if (mode === "floor") {
      rounded = Math.floor(num * factor) / factor;
    } else if (mode === "ceil") {
      rounded = Math.ceil(num * factor) / factor;
    } else {
      rounded = Math.round(num * factor) / factor;
    }

    return { output: rounded };
  },
};
