/**
 * Node: http.respond
 * Produces an HTTP response when running within an inbound webhook or HTTP-triggered workflow.
 * Gracefully reports simulated delivery when executed in manual or CLI contexts.
 */

const { defineInputPort, defineOutputPort, PortTypes } = require("../../contracts/ports");
const { ErrorCodes, EngineError } = require("../../contracts/errors");

module.exports = {
  type: "http.respond",
  version: 1,
  category: "http",
  label: "HTTP Respond",
  description: "Sends an HTTP response for inbound webhook and API-triggered workflow executions",
  inputs: {
    body: defineInputPort({ name: "body", type: PortTypes.ANY, required: false, description: "Payload to return in HTTP body" }),
    status: defineInputPort({ name: "status", type: PortTypes.NUMBER, required: false, description: "HTTP status code (e.g. 200, 201, 400)" }),
    headers: defineInputPort({ name: "headers", type: PortTypes.OBJECT, required: false, description: "Custom HTTP response headers" }),
  },
  outputs: {
    output: defineOutputPort({ name: "output", type: PortTypes.OBJECT, description: "Structured record of the response dispatch" }),
  },
  configSchema: {
    statusCode: {
      type: "number",
      required: false,
      default: 200,
      description: "Default HTTP status code",
    },
    contentType: {
      type: "string",
      required: false,
      default: "application/json",
      description: "Response Content-Type header",
    },
  },
  validateConfig: (config = {}) => {
    if (config.statusCode !== undefined) {
      if (typeof config.statusCode !== "number" || config.statusCode < 100 || config.statusCode > 599) {
        return { valid: false, errors: ["statusCode must be a valid HTTP status code (100-599)"], field: "config.statusCode" };
      }
    }
    return { valid: true };
  },
  capabilities: { pure: false, sideEffects: true, retryable: false },
  handler: async (inputs, node, context = {}) => {
    const config = node.config || {};
    const statusCode = Number(inputs.status !== undefined ? inputs.status : (config.statusCode || 200));
    const body = inputs.body !== undefined ? inputs.body : { message: "OK" };
    const headers = {
      "content-type": config.contentType || "application/json",
      ...(config.headers || {}),
      ...(inputs.headers || {}),
    };

    // Check if an active inbound HTTP response context exists
    if (context.httpResponse && typeof context.httpResponse.status === "function") {
      try {
        for (const [k, v] of Object.entries(headers)) {
          context.httpResponse.setHeader(k, v);
        }
        context.httpResponse.status(statusCode).send(typeof body === "object" ? body : String(body));
        return {
          output: {
            delivered: true,
            simulated: false,
            statusCode,
            headers,
            body,
          },
        };
      } catch (err) {
        throw new EngineError(
          ErrorCodes.HTTP_REQUEST_FAILED,
          `Failed to dispatch HTTP response: ${err.message}`,
          { originalMessage: err.message }
        );
      }
    }

    // When running outside an active HTTP request context (e.g. manual trigger):
    return {
      output: {
        delivered: false,
        simulated: true,
        statusCode,
        headers,
        body,
        reason: "Manual or asynchronous execution - no active inbound HTTP connection to respond to",
      },
    };
  },
};
