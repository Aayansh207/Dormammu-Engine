const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const env = require("../../env");

/**
 * Generate a short-lived JWT Access Token
 * @param {Object} user 
 * @param {string} sessionId
 * @returns {string} JWT token
 */
function generateAccessToken(user, sessionId = null) {
  const payload = {
    sub: user.id,
    email: user.email,
    role: user.role,
    ...(sessionId && { sid: sessionId }),
  };

  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRATION,
  });
}

/**
 * Verify a JWT Access Token
 * @param {string} token 
 * @returns {Object} decoded payload
 */
function verifyAccessToken(token) {
  try {
    return jwt.verify(token, env.JWT_ACCESS_SECRET);
  } catch (err) {
    return null;
  }
}

/**
 * Generate cryptographically secure random refresh token string
 * @returns {string}
 */
function generateRefreshToken() {
  return crypto.randomBytes(40).toString("hex");
}

/**
 * Generate SHA-256 hash of a token
 * @param {string} token 
 * @returns {string} hex hash
 */
function hashToken(token) {
  if (!token) return null;
  return crypto.createHash("sha256").update(token).digest("hex");
}

/**
 * Generate cryptographically secure verification token
 * @returns {string}
 */
function generateVerificationToken() {
  return crypto.randomBytes(32).toString("hex");
}

module.exports = {
  generateAccessToken,
  verifyAccessToken,
  generateRefreshToken,
  hashToken,
  generateVerificationToken,
};
