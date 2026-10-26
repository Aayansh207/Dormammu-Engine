const prisma = require("../config/db");
const { verifyAccessToken } = require("../utils/tokens");

/**
 * Authentication middleware that verifies JWT Access Token and checks session validity
 */
async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    let token = null;

    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.split(" ")[1];
    } else if (req.query && (req.query.token || req.query.access_token)) {
      token = String(req.query.token || req.query.access_token).trim();
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Authorization token required (Format: Bearer <token> or ?token=<token>)",
      });
    }

    const decoded = verifyAccessToken(token);

    if (!decoded || !decoded.sub) {
      return res.status(401).json({
        success: false,
        message: "Invalid or expired access token",
      });
    }

    // Verify session state if session ID is attached
    if (decoded.sid) {
      const session = await prisma.session.findUnique({
        where: { id: decoded.sid },
        select: { id: true, revokedAt: true, expiresAt: true },
      });

      if (!session || session.revokedAt || new Date() > new Date(session.expiresAt)) {
        return res.status(401).json({
          success: false,
          message: "Session has been revoked or expired. Please re-authenticate.",
        });
      }
    }

    req.user = {
      id: decoded.sub,
      email: decoded.email,
      role: decoded.role,
      sessionId: decoded.sid || null,
    };

    next();
  } catch (err) {
    console.error("Auth middleware error:", err);
    return res.status(500).json({
      success: false,
      message: "Authentication verification failed",
    });
  }
}

/**
 * Role-based authorization middleware
 * @param {string[]} allowedRoles 
 */
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "Forbidden: You do not have sufficient permissions",
      });
    }

    next();
  };
}

module.exports = {
  requireAuth,
  requireRole,
};
