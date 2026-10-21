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

  /**
   * Record a login event (success or failure) in audit history
   */
  async recordLoginHistory({
    userId = null,
    email,
    status = "SUCCESS",
    method = "CREDENTIALS",
    ipAddress = null,
    userAgent = null,
    reason = null,
  }) {
    try {
      if (!email) return null;
      const parsed = parseUserAgent(userAgent);
      return await prisma.loginHistory.create({
        data: {
          userId: userId || undefined,
          email: String(email).toLowerCase().trim(),
          status: status || "SUCCESS",
          method: method || "CREDENTIALS",
          ipAddress: normalizeIp(ipAddress),
          userAgent: userAgent ? String(userAgent).slice(0, 500) : null,
          device: parsed.deviceLabel || null,
          reason: reason ? String(reason).slice(0, 255) : null,
        },
      });
    } catch (err) {
      console.error("Failed to record login history:", err.message);
      return null;
    }
  }

  /**
   * Retrieve paginated login history for a user
   */
  async getLoginHistory(userId, { limit = 20, page = 1 } = {}) {
    const take = Math.min(Math.max(Number(limit) || 20, 1), 100);
    const currentPage = Math.max(Number(page) || 1, 1);
    const skip = (currentPage - 1) * take;

    const [total, records] = await Promise.all([
      prisma.loginHistory.count({ where: { userId } }),
      prisma.loginHistory.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take,
        skip,
        select: {
          id: true,
          status: true,
          method: true,
          ipAddress: true,
          userAgent: true,
          device: true,
          reason: true,
          createdAt: true,
        },
      }),
    ]);

    return {
      total,
      page: currentPage,
      limit: take,
      pages: Math.ceil(total / take) || 1,
      data: records.map((r) => {
        const parsed = parseUserAgent(r.userAgent);
        return {
          ...r,
          ipAddress: normalizeIp(r.ipAddress),
          browser: parsed.browser,
          browserVersion: parsed.browserVersion,
          os: parsed.os,
          deviceType: parsed.deviceType,
          deviceLabel: parsed.deviceLabel,
        };
      }),
    };
  }
}

module.exports = new SessionService();
