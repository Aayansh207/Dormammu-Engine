/**
 * Node: json.get
 * Safely extracts a nested property from an object by dot/bracket path notation
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
    input: defineInputPort({ name: "input", type: PortTypes.ANY, required: false, description: "Source object" }),
    object: defineInputPort({ name: "object", type: PortTypes.ANY, required: false, description: "Source object (alias)" }),
    path: defineInputPort({ name: "path", type: PortTypes.STRING, required: false, description: "Property path (e.g. 'user.name')" }),
  },
  outputs: {
    output: defineOutputPort({ name: "output", type: PortTypes.ANY, description: "Extracted property value" }),
    value: defineOutputPort({ name: "value", type: PortTypes.ANY, description: "Extracted property value (alias)" }),
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
  validateConfig: (config = {}) => {
    if (config.path !== undefined && typeof config.path !== "string") {
      return { valid: false, errors: ["Config 'path' must be a string"], field: "config.path" };
    }
    return { valid: true };
  },
  capabilities: { pure: true, sideEffects: false, retryable: true },
  handler: async (inputs, node) => {
    let srcObj = inputs.input !== undefined ? inputs.input : inputs.object;
    if (typeof srcObj === "string") {
      try {
        srcObj = JSON.parse(srcObj);
      } catch {
        // keep string
      }
    }

    const path = inputs.path !== undefined && inputs.path !== null
      ? inputs.path
      : (node.config && node.config.path !== undefined ? node.config.path : "");

    const fallback = (node.config && node.config.defaultValue !== undefined) ? node.config.defaultValue : null;

    const extracted = getPropertyByPath(srcObj, path);
    const result = extracted !== undefined ? extracted : fallback;
    return { output: result, value: result };
  },
};
