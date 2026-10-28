/**
 * Dormammu Engine - Payload Sanitizer
 * Recursively sanitizes payloads to ensure sensitive credentials, tokens, and secrets
 * are masked before persistence in execution reports.
 * Also enforces safety boundaries on unbounded payloads.
 */

function sanitizePayload(data, depth = 0) {
  if (depth > 10) return "[Max Depth Reached]";
  if (data === null || data === undefined) return data;
  if (typeof data !== "object") {
    if (typeof data === "string" && data.length > 50000) {
      return data.slice(0, 50000) + "... [Truncated]";
    }
    return data;
  }
  if (Array.isArray(data)) {
    if (data.length > 500) {
      return data.slice(0, 500).map((item) => sanitizePayload(item, depth + 1)).concat(["... [Truncated array]"]);
    }
    return data.map((item) => sanitizePayload(item, depth + 1));
  }
  const sanitized = {};
  for (const [key, val] of Object.entries(data)) {
    const lower = key.toLowerCase();
    if (
      lower.includes("password") ||
      lower.includes("secret") ||
      lower.includes("cookie") ||
      lower === "authorization" ||
      lower === "apikey" ||
      lower === "api_key" ||
      lower === "x-webhook-token" ||
      lower === "x-api-key"
    ) {
      sanitized[key] = "[REDACTED]";
    } else {
      sanitized[key] = sanitizePayload(val, depth + 1);
    }
  }
  return sanitized;
}

module.exports = {
  sanitizePayload,
};
