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
}

module.exports = new SessionController();
