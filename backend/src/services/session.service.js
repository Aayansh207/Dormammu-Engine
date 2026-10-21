const prisma = require("../config/db");
const env = require("../../env");
const { hashToken } = require("../utils/tokens");

const { parseUserAgent, normalizeIp } = require("../utils/userAgentParser");

class SessionService {
  /**
   * Create a new database-backed session
   */
  async createSession({ userId, refreshToken, userAgent = null, ipAddress = null }) {
    const refreshTokenHash = hashToken(refreshToken);
    const expiresAt = new Date(Date.now() + env.REFRESH_TOKEN_EXPIRATION_DAYS * 24 * 60 * 60 * 1000);

    const session = await prisma.session.create({
      data: {
        userId,
        refreshTokenHash,
        expiresAt,
        userAgent,
        ipAddress,
      },
    });

    return session;
  }

  /**
   * Find session and attached user by raw refresh token
   */
  async findSessionByToken(refreshToken) {
    if (!refreshToken) return null;
    const refreshTokenHash = hashToken(refreshToken);

    return prisma.session.findUnique({
      where: { refreshTokenHash },
      include: { user: true },
    });
  }

  /**
   * Rotate a session's refresh token
   */
  async rotateSessionToken(sessionId, newRefreshToken) {
    const refreshTokenHash = hashToken(newRefreshToken);
    const expiresAt = new Date(Date.now() + env.REFRESH_TOKEN_EXPIRATION_DAYS * 24 * 60 * 60 * 1000);

    return prisma.session.update({
      where: { id: sessionId },
      data: {
        refreshTokenHash,
        lastUsedAt: new Date(),
        expiresAt,
      },
    });
  }

  /**
   * Revoke a specific session with strict user ownership validation
   */
  async revokeSession(sessionId, userId) {
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      const error = new Error("Session not found");
      error.statusCode = 404;
      throw error;
    }

    if (session.userId !== userId) {
      const error = new Error("Forbidden: You do not own this session");
      error.statusCode = 403;
      throw error;
    }

    return prisma.session.update({
      where: { id: sessionId },
      data: { revokedAt: new Date() },
    });
  }

  /**
   * Revoke all active sessions for a user (Logout-all)
   */
  async revokeAllUserSessions(userId) {
    return prisma.session.updateMany({
      where: {
        userId,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });
  }

  /**
   * List all active sessions for a user
   */
  async getUserActiveSessions(userId, currentSessionId = null) {
    const now = new Date();
    const sessions = await prisma.session.findMany({
      where: {
        userId,
        revokedAt: null,
        expiresAt: { gt: now },
      },
      orderBy: { lastUsedAt: "desc" },
      select: {
        id: true,
        userAgent: true,
        ipAddress: true,
        createdAt: true,
        lastUsedAt: true,
        expiresAt: true,
      },
    });

    return sessions.map((s) => {
      const parsed = parseUserAgent(s.userAgent);
      return {
        ...s,
        ipAddress: normalizeIp(s.ipAddress),
        browser: parsed.browser,
        browserVersion: parsed.browserVersion,
        os: parsed.os,
        deviceType: parsed.deviceType,
        deviceLabel: parsed.deviceLabel,
        isCurrent: currentSessionId ? s.id === currentSessionId : false,
      };
    });
  }
}

module.exports = new SessionService();
