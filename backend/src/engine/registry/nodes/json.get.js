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
  version: "1.0.0",
  category: "json",
  label: "JSON Get Property",
  description: "Extracts a nested property from an object using a dot/bracket path",
  inputs: {
    object: defineInputPort({ name: "object", type: PortTypes.ANY, required: true, description: "Source object" }),
    path: defineInputPort({ name: "path", type: PortTypes.STRING, required: false, description: "Property path (e.g. 'user.name')" }),
  },
  outputs: {
    value: defineOutputPort({ name: "value", type: PortTypes.ANY, description: "Extracted property value" }),
  },
  validateConfig: (config) => {
    if (config && config.path !== undefined && typeof config.path !== "string") {
      return { valid: false, errors: ["Config 'path' must be a string"] };
    }
    return { valid: true };
  },
  capabilities: { pure: true, sideEffects: false, retryable: true },
  handler: async (inputs, node) => {
    const path = inputs.path !== undefined && inputs.path !== null
      ? inputs.path
      : (node.config && node.config.path !== undefined ? node.config.path : "");

    const extracted = getPropertyByPath(inputs.object, path);
    return { value: extracted !== undefined ? extracted : null };
  },
};
