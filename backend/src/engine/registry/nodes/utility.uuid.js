/**
 * Node: utility.uuid
 * Generates a random UUID v4
 */

const { defineOutputPort, PortTypes } = require("../../contracts/ports");
const crypto = require("crypto");

module.exports = {
  type: "utility.uuid",
  version: 1,
  category: "utility",
  label: "Generate UUID",
  description: "Generates a unique RFC4122 Version 4 UUID",
  inputs: {},
  outputs: {
    output: defineOutputPort({ name: "output", type: PortTypes.STRING, description: "Generated UUID v4" }),
    uuid: defineOutputPort({ name: "uuid", type: PortTypes.STRING, description: "Generated UUID v4 (alias)" }),
  },
  configSchema: {},
  validateConfig: () => ({ valid: true }),
  capabilities: { pure: false, sideEffects: false, retryable: true },
  handler: async () => {
    const uuid = crypto.randomUUID ? crypto.randomUUID() : `uuid_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    return { output: uuid, uuid };
  },
};
