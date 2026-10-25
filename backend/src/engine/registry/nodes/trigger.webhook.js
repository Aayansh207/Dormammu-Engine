/**
 * Node: trigger.webhook
 * Listens for incoming HTTP webhook requests to initiate workflow execution.
 * Extracts the parsed request body, headers, query parameters, and HTTP method.
 */

const { defineOutputPort, PortTypes } = require("../../contracts/ports");
const { ErrorCodes, EngineError } = require("../../contracts/errors");

module.exports = {
  type: "trigger.webhook",
  version: 1,
  category: "trigger",
  label: "Webhook Trigger",
  description: "Triggers execution upon receiving an authenticated HTTP webhook payload",
  inputs: {},
  outputs: {
    output: defineOutputPort({ name: "output", type: PortTypes.ANY, description: "Webhook payload body" }),
    payload: defineOutputPort({ name: "payload", type: PortTypes.ANY, description: "Alias for request body" }),
    headers: defineOutputPort({ name: "headers", type: PortTypes.OBJECT, description: "Incoming HTTP headers" }),
    query: defineOutputPort({ name: "query", type: PortTypes.OBJECT, description: "URL query parameters" }),
    method: defineOutputPort({ name: "method", type: PortTypes.STRING, description: "HTTP method (e.g. POST)" }),
  },
  configSchema: {
    webhookToken: {
      type: "string",
      required: false,
      description: "Optional secret token required in webhook URL or Authorization header",
    },
    allowedMethods: {
      type: "array",
      required: false,
      default: ["POST", "PUT"],
      description: "Allowed HTTP methods for this webhook endpoint",
    },
    defaultPayload: {
      type: "object",
      required: false,
      default: {},
      description: "Default fallback payload when simulated or executed without live webhook",
    },
  },
  validateConfig: (config = {}) => {
    if (config.allowedMethods !== undefined) {
      if (!Array.isArray(config.allowedMethods) || config.allowedMethods.length === 0) {
        return { valid: false, errors: ["'allowedMethods' must be a non-empty array"], field: "config.allowedMethods" };
      }
    }
    return { valid: true };
  },
  capabilities: {
    pure: false,
    sideEffects: false,
    retryable: true,
  },
  handler: async (inputs, node, context = {}) => {
    const config = node.config || {};
    const triggerData = context.triggerData || {};

    let payload = {};
    let headers = {};
    let query = {};
    let method = "POST";

    if (triggerData.$webhook) {
      // Ingested via live Webhook endpoint
      payload = triggerData.body !== undefined ? triggerData.body : {};
      headers = triggerData.headers || {};
      query = triggerData.query || {};
      method = (triggerData.method || "POST").toUpperCase();
    } else if (triggerData[node.id] !== undefined) {
      // Per-trigger targeted data
      const target = triggerData[node.id];
      payload = typeof target === "object" && target !== null && target.body !== undefined ? target.body : target;
      headers = target?.headers || {};
      query = target?.query || {};
    } else if (Object.keys(triggerData).length > 0 && !triggerData.$multiTrigger) {
      // Broadcast manual trigger payload
      payload = triggerData.body !== undefined ? triggerData.body : triggerData;
    } else if (config.defaultPayload && Object.keys(config.defaultPayload).length > 0) {
      payload = config.defaultPayload;
    }

    return {
      output: payload,
      payload,
      headers,
      query,
      method,
    };
  },
};
