/**
 * Node: http.request
 * Performs outbound HTTP requests with strict SSRF protection, timeout, and response size limits.
 * Protects credentials by resolving secret tokens dynamically without logging sensitive headers.
 */

const { defineInputPort, defineOutputPort, PortTypes } = require("../../contracts/ports");
const { ErrorCodes, EngineError } = require("../../contracts/errors");
const { validateOutboundUrl } = require("../../utils/ssrf.validator");

const MAX_TIMEOUT_MS = 30000;
const DEFAULT_TIMEOUT_MS = 10000;
const MAX_RESPONSE_SIZE_BYTES = 2 * 1024 * 1024; // 2 MB limit
const SUPPORTED_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD"];

/**
 * Resolves secret placeholders like {{secrets.KEY}} or {{env.KEY}} from environment
 * without exposing them in unmasked logs.
 */
function resolveSecretTokens(str) {
  if (typeof str !== "string") return str;
  return str.replace(/\{\{\s*(?:secrets|env)\.([a-zA-Z0-9_]+)\s*\}\}/g, (_, varName) => {
    return process.env[varName] || "";
  });
}

function resolveHeaders(rawHeaders = {}) {
  const headers = {};
  for (const [key, val] of Object.entries(rawHeaders)) {
    headers[key] = resolveSecretTokens(String(val));
  }
  return headers;
}

module.exports = {
  type: "http.request",
  version: 1,
  category: "http",
  label: "HTTP Request",
  description: "Dispatches HTTP requests with SSRF guards, timeout enforcement, and response size limits",
  inputs: {
    body: defineInputPort({ name: "body", type: PortTypes.ANY, required: false, description: "Request payload (JSON object, string, etc.)" }),
    url: defineInputPort({ name: "url", type: PortTypes.STRING, required: false, description: "Target URL (overrides config if provided)" }),
    headers: defineInputPort({ name: "headers", type: PortTypes.OBJECT, required: false, description: "Dynamic headers map" }),
  },
  outputs: {
    output: defineOutputPort({ name: "output", type: PortTypes.ANY, description: "Parsed response body (JSON object or string)" }),
    status: defineOutputPort({ name: "status", type: PortTypes.NUMBER, description: "HTTP status code" }),
    headers: defineOutputPort({ name: "headers", type: PortTypes.OBJECT, description: "Response headers map" }),
  },
  configSchema: {
    url: {
      type: "string",
      required: false,
      description: "Target URL destination",
    },
    method: {
      type: "string",
      required: false,
      default: "GET",
      enum: SUPPORTED_METHODS,
      description: "HTTP request method",
    },
    headers: {
      type: "object",
      required: false,
      default: {},
      description: "Headers to send with request (supports {{secrets.VAR_NAME}})",
    },
    timeoutMs: {
      type: "number",
      required: false,
      default: DEFAULT_TIMEOUT_MS,
      description: "Request timeout in milliseconds (max 30,000ms)",
    },
    allowPrivateNetwork: {
      type: "boolean",
      required: false,
      default: false,
      description: "Explicitly allow destinations on private or local network",
    },
  },
  validateConfig: (config = {}) => {
    if (config.method && !SUPPORTED_METHODS.includes(config.method.toUpperCase())) {
      return {
        valid: false,
        errors: [`Invalid HTTP method '${config.method}'. Must be one of: ${SUPPORTED_METHODS.join(", ")}`],
        field: "config.method",
      };
    }
    if (config.timeoutMs !== undefined) {
      if (typeof config.timeoutMs !== "number" || config.timeoutMs < 500 || config.timeoutMs > MAX_TIMEOUT_MS) {
        return {
          valid: false,
          errors: [`timeoutMs must be between 500 and ${MAX_TIMEOUT_MS}ms`],
          field: "config.timeoutMs",
        };
      }
    }
    return { valid: true };
  },
  capabilities: {
    pure: false,
    sideEffects: true,
    retryable: false,
    timeoutMs: MAX_TIMEOUT_MS + 5000,
  },
  handler: async (inputs, node, context = {}) => {
    const config = node.config || {};
    const targetUrl = inputs.url || config.url;

    if (!targetUrl || typeof targetUrl !== "string") {
      throw new EngineError(
        ErrorCodes.REQUIRED_INPUT_MISSING,
        "Target URL must be provided in node configuration or via the 'url' input port",
        { field: "url" }
      );
    }

    const allowPrivate = Boolean(config.allowPrivateNetwork);

    // 1. SSRF Validation
    await validateOutboundUrl(targetUrl, { allowPrivateNetwork: allowPrivate });

    const method = (config.method || "GET").toUpperCase();
    const timeoutMs = Math.min(
      Math.max(Number(config.timeoutMs || DEFAULT_TIMEOUT_MS), 500),
      MAX_TIMEOUT_MS
    );

    // Prepare headers with resolved secret tokens
    const combinedHeaders = {
      ...(config.headers || {}),
      ...(inputs.headers || {}),
    };
    const resolvedReqHeaders = resolveHeaders(combinedHeaders);

    // Prepare request body
    let requestBody = undefined;
    if (inputs.body !== undefined && !["GET", "HEAD"].includes(method)) {
      if (typeof inputs.body === "object" && inputs.body !== null) {
        if (!resolvedReqHeaders["content-type"] && !resolvedReqHeaders["Content-Type"]) {
          resolvedReqHeaders["Content-Type"] = "application/json";
        }
        requestBody = JSON.stringify(inputs.body);
      } else {
        requestBody = String(inputs.body);
      }
    }

    // Set up abort controller combining caller context and node timeout
    const controller = new AbortController();
    let timeoutId = setTimeout(() => {
      controller.abort();
    }, timeoutMs);

    if (context.abortSignal) {
      context.abortSignal.addEventListener("abort", () => controller.abort(), { once: true });
    }

    let response;
    try {
      response = await fetch(targetUrl, {
        method,
        headers: resolvedReqHeaders,
        body: requestBody,
        signal: controller.signal,
        redirect: "follow",
      });
    } catch (err) {
      if (controller.signal.aborted) {
        if (context.abortSignal && context.abortSignal.aborted) {
          throw new EngineError(ErrorCodes.EXECUTION_CANCELLED, "HTTP request was cancelled");
        }
        throw new EngineError(
          ErrorCodes.HTTP_TIMEOUT,
          `HTTP request to '${targetUrl}' timed out after ${timeoutMs}ms`,
          { url: targetUrl, timeoutMs }
        );
      }
      throw new EngineError(
        ErrorCodes.HTTP_REQUEST_FAILED,
        `HTTP network request failed: ${err.message}`,
        { url: targetUrl, originalMessage: err.message }
      );
    } finally {
      clearTimeout(timeoutId);
    }

    // Check response size before loading full body
    const contentLength = response.headers.get("content-length");
    if (contentLength && parseInt(contentLength, 10) > MAX_RESPONSE_SIZE_BYTES) {
      throw new EngineError(
        ErrorCodes.HTTP_RESPONSE_TOO_LARGE,
        `Response size (${contentLength} bytes) exceeds limit of ${MAX_RESPONSE_SIZE_BYTES} bytes`,
        { size: contentLength, maxAllowed: MAX_RESPONSE_SIZE_BYTES }
      );
    }

    const rawText = await response.text();
    if (Buffer.byteLength(rawText, "utf8") > MAX_RESPONSE_SIZE_BYTES) {
      throw new EngineError(
        ErrorCodes.HTTP_RESPONSE_TOO_LARGE,
        `Response payload exceeds limit of ${MAX_RESPONSE_SIZE_BYTES} bytes`,
        { maxAllowed: MAX_RESPONSE_SIZE_BYTES }
      );
    }

    // Parse JSON if applicable
    let parsedData = rawText;
    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json") || (rawText.trim().startsWith("{") && rawText.trim().endsWith("}"))) {
      try {
        parsedData = JSON.parse(rawText);
      } catch {
        parsedData = rawText;
      }
    }

    // Collect response headers
    const respHeaders = {};
    response.headers.forEach((value, key) => {
      respHeaders[key] = value;
    });

    return {
      output: parsedData,
      status: response.status,
      headers: respHeaders,
    };
  },
};
