const sessionService = require("../services/session.service");

class SessionController {
  /**
   * GET /api/sessions
   * List all active sessions for the authenticated user
   */
  async listSessions(req, res) {
    try {
      const currentSessionId = req.user.sessionId || null;
      const sessions = await sessionService.getUserActiveSessions(
        req.user.id,
        currentSessionId
      );

      return res.status(200).json({
        success: true,
        data: sessions,
      });
    } catch (err) {
      const status = err.statusCode || 500;
      return res.status(status).json({
        success: false,
        message: err.message || "Failed to retrieve active sessions",
      });
    }
  }

  /**
   * DELETE /api/sessions/:id
   * Revoke a specific session (with user ownership check)
   */
  async revokeSession(req, res) {
    try {
      const sessionId = req.params.id;
      if (!sessionId) {
        return res.status(400).json({
          success: false,
          message: "Session ID parameter is required",
        });
      }

      await sessionService.revokeSession(sessionId, req.user.id);

      return res.status(200).json({
        success: true,
        message: "Session revoked successfully",
      });
    } catch (err) {
      const status = err.statusCode || 500;
      return res.status(status).json({
        success: false,
        message: err.message || "Failed to revoke session",
      });
    }
  }

  /**
   * DELETE /api/sessions
   * Revoke all sessions for the authenticated user (Logout-all)
   */
  async revokeAllSessions(req, res) {
    try {
      await sessionService.revokeAllUserSessions(req.user.id);
      return res.status(200).json({
        success: true,
        message: "All sessions have been revoked successfully",
      });
    } catch (err) {
      const status = err.statusCode || 500;
      return res.status(status).json({
        success: false,
        message: err.message || "Failed to revoke all sessions",
      });
    }
  }

  /**
   * GET /api/sessions/history
   * Retrieve login history for authenticated user
   */
  async getHistory(req, res) {
    try {
      const { page = 1, limit = 20 } = req.query;
      const history = await sessionService.getLoginHistory(req.user.id, {
        page,
        limit,
      });

      return res.status(200).json({
        success: true,
        ...history,
      });
    } catch (err) {
      const status = err.statusCode || 500;
      return res.status(status).json({
        success: false,
        message: err.message || "Failed to retrieve login history",
      });
    }
  }
}

module.exports = new SessionController();
