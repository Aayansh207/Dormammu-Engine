/**
 * Dormammu Engine - Retry Policy & Error Classification
 * Classifies failure modes, calculates backoff with exponential scaling and jitter,
 * and extracts per-node retry rules.
 */

const { ErrorCodes } = require("../engine/contracts/errors");

const NON_RETRYABLE_ERROR_CODES = new Set([
  ErrorCodes.UNKNOWN_NODE_TYPE,
  ErrorCodes.REQUIRED_INPUT_MISSING,
  ErrorCodes.PORT_TYPE_MISMATCH,
  ErrorCodes.VALIDATION_FAILED,
  ErrorCodes.INVALID_PORT,
  ErrorCodes.INVALID_OUTPUT_PORT,
  ErrorCodes.CYCLE_DETECTED,
  ErrorCodes.UNAUTHORIZED,
  ErrorCodes.FORBIDDEN,
  ErrorCodes.EXECUTION_CANCELLED,
  ErrorCodes.INVALID_CONDITION_OPERATOR,
  ErrorCodes.INVALID_JSON,
]);

/**
 * Classifies whether an error should be retried based on error code, status, or message.
 * @param {Error|Object} error
 * @param {Object} [nodeConfig={}]
 * @returns {boolean}
 */
function isRetryableError(error, nodeConfig = {}) {
  if (!error) return false;

  const code = error.code || error.errorCode;
  if (code && NON_RETRYABLE_ERROR_CODES.has(code)) {
    return false;
  }

  // Check HTTP status code if present
  const httpStatus = error.status || error.statusCode || error.details?.status || error.details?.statusCode;
  if (httpStatus) {
    const statusNum = Number(httpStatus);
    // Non-retryable client errors: 400 Bad Request, 401 Unauthorized, 403 Forbidden, 404 Not Found, 422 Unprocessable
    if ([400, 401, 403, 404, 405, 422].includes(statusNum)) {
      return false;
    }
    // Retryable: 429 Too Many Requests, 502 Bad Gateway, 503 Service Unavailable, 504 Gateway Timeout
    if ([429, 502, 503, 504].includes(statusNum)) {
      return true;
    }
  }

  // Check error message patterns
  const message = String(error.message || "").toLowerCase();
  const retryablePatterns = [
    "timeout",
    "timed out",
    "econnreset",
    "etimedout",
    "econnrefused",
    "enotfound",
    "network error",
    "fetch failed",
    "connection terminated",
    "rate limit",
    "too many requests",
    "upstream provider error",
    "gateway timeout",
    "service unavailable",
    "temporary failure",
    "groq ai api error (503)",
    "groq ai api error (504)",
    "groq ai api error (429)",
  ];

  if (retryablePatterns.some((pattern) => message.includes(pattern))) {
    return true;
  }

  // If node declares explicit retryable capability
  if (nodeConfig && nodeConfig.retryable === false) {
    return false;
  }

  // Default to non-retryable for generic programming bugs (e.g. ReferenceError, TypeError)
  if (error instanceof TypeError || error instanceof ReferenceError || error instanceof SyntaxError) {
    return false;
  }

  return false;
}

/**
 * Normalizes retry configuration from node config or defaults.
 * Total attempts = maxAttempts (includes initial attempt).
 * @param {Object} [node={}]
 * @returns {{ maxAttempts: number, backoff: string, initialDelayMs: number, maxDelayMs: number, jitter: boolean }}
 */
function getRetryPolicy(node = {}) {
  const config = node.config || {};
  const retryConfig = config.retry || {};

  const maxAttempts = Math.max(1, Math.min(Number(retryConfig.maxAttempts || config.maxAttempts || 1), 10));
  const backoff = retryConfig.backoff || config.backoff || "exponential";
  const initialDelayMs = Math.max(100, Math.min(Number(retryConfig.initialDelayMs || config.initialDelayMs || 1000), 60000));
  const maxDelayMs = Math.max(initialDelayMs, Math.min(Number(retryConfig.maxDelayMs || config.maxDelayMs || 30000), 300000));
  const jitter = retryConfig.jitter !== undefined ? Boolean(retryConfig.jitter) : true;

  return {
    maxAttempts,
    backoff,
    initialDelayMs,
    maxDelayMs,
    jitter,
  };
}

/**
 * Computes delay milliseconds for the next attempt.
 * @param {number} attempt - 1-based attempt number that just completed
 * @param {Object} [policy={}]
 * @returns {number}
 */
function calculateBackoffDelay(attempt, policy = {}) {
  const {
    initialDelayMs = 1000,
    maxDelayMs = 30000,
    backoff = "exponential",
    jitter = true,
  } = policy;

  let delay = initialDelayMs;

  if (backoff === "exponential") {
    // 2^(attempt - 1)
    const factor = Math.pow(2, Math.max(0, attempt - 1));
    delay = Math.min(initialDelayMs * factor, maxDelayMs);
  } else if (backoff === "linear") {
    delay = Math.min(initialDelayMs * attempt, maxDelayMs);
  } else {
    // Fixed
    delay = Math.min(initialDelayMs, maxDelayMs);
  }

  if (jitter) {
    // Add up to 30% random jitter to decorrelate retries across parallel workers
    const jitterFactor = 0.7 + Math.random() * 0.6; // [0.7, 1.3]
    delay = Math.round(delay * jitterFactor);
  }

  return Math.min(Math.max(100, delay), maxDelayMs);
}

module.exports = {
  isRetryableError,
  getRetryPolicy,
  calculateBackoffDelay,
  NON_RETRYABLE_ERROR_CODES,
};
