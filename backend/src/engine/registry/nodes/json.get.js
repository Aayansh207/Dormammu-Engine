/**
 * Node: json.get
 * Safely extracts a nested property from an object by dot/bracket path notation.
 * Inputs: input (source object), path (optional dynamic path).
 * Output: single 'output' port.
 */

const { defineInputPort, defineOutputPort, PortTypes } = require("../../contracts/ports");

function getPropertyByPath(obj, path) {
  if (obj === null || obj === undefined || !path) {
    return obj;
  }
  const cleanPath = String(path).trim();
  if (cleanPath === "" || cleanPath === ".") {
    return obj;
  }

  // Tokenize paths like "user.profile.name" or "items[0].id"
  const tokens = cleanPath
    .replace(/\[(\w+)\]/g, ".$1")
    .split(".")
    .filter((token) => token.length > 0);

  let current = obj;
  for (const token of tokens) {
    if (current === null || current === undefined) {
      return undefined;
    }
    current = current[token];
  }
  return current;
}

module.exports = {
  type: "json.get",
  version: 1,
  category: "json",
  label: "Get JSON Field",
  description: "Extracts a nested property from an object using a dot/bracket path",
  inputs: {
    input: defineInputPort({ name: "input", type: PortTypes.ANY, required: false, description: "Source object or array" }),
    path: defineInputPort({ name: "path", type: PortTypes.STRING, required: false, description: "Dynamic property path (e.g. 'user.name')" }),
  },
  outputs: {
    output: defineOutputPort({ name: "output", type: PortTypes.ANY, description: "Extracted property value" }),
  },
  configSchema: {
    path: {
      type: "string",
      required: false,
      default: "",
      description: "Dot notation path to extract (e.g., 'data.count' or 'user.name')",
    },
    defaultValue: {
      type: "any",
      required: false,
      default: null,
      description: "Default fallback value if path is not found",
    },
  },
  validateConfig: () => ({ valid: true }),
  capabilities: { pure: true, sideEffects: false, retryable: true },
  handler: async (inputs, node) => {
    const target = inputs.input !== undefined ? inputs.input : inputs.object;
    const path = (inputs.path !== undefined && inputs.path !== null)
      ? String(inputs.path)
      : (node.config && node.config.path ? node.config.path : "");

    const defVal = (node.config && node.config.defaultValue !== undefined)
      ? node.config.defaultValue
      : null;

    const extracted = getPropertyByPath(target, path);
    const result = extracted !== undefined ? extracted : defVal;
    return { output: result };
  },
};
