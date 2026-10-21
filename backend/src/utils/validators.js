/**
 * Normalizes email address to lower case and trims whitespace.
 * @param {string} email 
 * @returns {string}
 */
function normalizeEmail(email) {
  if (typeof email !== "string") return "";
  return email.trim().toLowerCase();
}

/**
 * Validates email format
 * @param {string} email 
 * @returns {boolean}
 */
function isValidEmail(email) {
  if (!email || typeof email !== "string") return false;
  // RFC 5322 compliant regex simplified
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
}

/**
 * Validates password strength
 * @param {string} password 
 * @returns {{ isValid: boolean, error?: string }}
 */
function validatePassword(password) {
  if (!password || typeof password !== "string") {
    return { isValid: false, error: "Password is required" };
  }
  if (password.length < 8) {
    return { isValid: false, error: "Password must be at least 8 characters long" };
  }
  if (password.length > 128) {
    return { isValid: false, error: "Password must not exceed 128 characters" };
  }
  return { isValid: true };
}

/**
 * Validates and sanitizes user display name
 * @param {string} name 
 * @returns {string|null}
 */
function sanitizeName(name) {
  if (!name || typeof name !== "string") return null;
  const trimmed = name.trim();
  if (trimmed.length === 0) return null;
  return trimmed.slice(0, 100);
}

module.exports = {
  normalizeEmail,
  isValidEmail,
  validatePassword,
  sanitizeName,
};
