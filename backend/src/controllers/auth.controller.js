const https = require("https");
const authService = require("../services/auth.service");
const { normalizeIp } = require("../utils/userAgentParser");

function getClientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded) {
    const first = forwarded.split(",")[0].trim();
    if (first) return normalizeIp(first);
  }
  const realIp = req.headers["x-real-ip"];
  if (realIp) return normalizeIp(realIp.trim());
  const ip = req.ip || req.socket?.remoteAddress || req.connection?.remoteAddress || null;
  return normalizeIp(ip);
}

class AuthController {
  /**
   * POST /api/auth/signup
   */
  async signup(req, res) {
    try {
      const { name, email, password } = req.body;
      const userAgent = req.headers["user-agent"] || null;
      const ipAddress = getClientIp(req);

      const result = await authService.signup({
        name,
        email,
        password,
        userAgent,
        ipAddress,
      });

      return res.status(201).json({
        success: true,
        message: result.message,
        data: {
          user: result.user,
          accessToken: result.accessToken || null,
          refreshToken: result.refreshToken || null,
          session: result.session || null,
          verificationToken: result.verificationToken || null,
          verificationUrl: result.verificationUrl || null,
          mailSent: result.mailSent || false,
          mailError: result.mailError || null,
        },
      });
    } catch (err) {
      const status = err.statusCode || 500;
      return res.status(status).json({
        success: false,
        message: err.message || "Failed to register user",
      });
    }
  }

  /**
   * POST /api/auth/login
   */
  async login(req, res) {
    try {
      const { email, password } = req.body;
      const userAgent = req.headers["user-agent"] || null;
      const ipAddress = getClientIp(req);

      const result = await authService.login({
        email,
        password,
        userAgent,
        ipAddress,
      });

      return res.status(200).json({
        success: true,
        message: "Login successful",
        data: {
          user: result.user,
          accessToken: result.accessToken,
          refreshToken: result.refreshToken,
          session: result.session,
        },
      });
    } catch (err) {
      const status = err.statusCode || 500;
      const response = {
        success: false,
        message: err.message || "Authentication failed",
      };
      if (err.unverified) {
        response.unverified = true;
        response.email = err.email;
      }
      return res.status(status).json(response);
    }
  }

  /**
   * POST /api/auth/refresh
   */
  async refresh(req, res) {
    try {
      const refreshToken = req.body.refreshToken || req.headers["x-refresh-token"];
      const userAgent = req.headers["user-agent"] || null;
      const ipAddress = getClientIp(req);

      if (!refreshToken) {
        return res.status(400).json({
          success: false,
          message: "Refresh token is required",
        });
      }

      const result = await authService.refresh({
        refreshToken,
        userAgent,
        ipAddress,
      });

      return res.status(200).json({
        success: true,
        message: "Token refreshed successfully",
        data: {
          user: result.user,
          accessToken: result.accessToken,
          refreshToken: result.refreshToken,
          session: result.session,
        },
      });
    } catch (err) {
      const status = err.statusCode || 401;
      return res.status(status).json({
        success: false,
        message: err.message || "Could not refresh token",
      });
    }
  }

  /**
   * POST /api/auth/verify-email
   * GET /api/auth/verify-email?token=...
   */
  async verifyEmail(req, res) {
    try {
      const token = req.body?.token || req.query?.token;
      if (!token) {
        return res.status(400).json({
          success: false,
          message: "Verification token is required",
        });
      }

      const result = await authService.verifyEmail(token);
      return res.status(200).json(result);
    } catch (err) {
      const status = err.statusCode || 400;
      return res.status(status).json({
        success: false,
        message: err.message || "Email verification failed",
      });
    }
  }

  /**
   * POST /api/auth/resend-verification
   */
  async resendVerification(req, res) {
    try {
      const { email } = req.body;
      if (!email) {
        return res.status(400).json({
          success: false,
          message: "Email is required",
        });
      }

      const result = await authService.resendVerification(email);
      return res.status(200).json(result);
    } catch (err) {
      const status = err.statusCode || 400;
      return res.status(status).json({
        success: false,
        message: err.message || "Failed to resend verification email",
      });
    }
  }

  /**
   * POST /api/auth/google
   * Validates Google ID token / Credential directly from frontend (Google One-Tap / GIS)
   */
  async googleVerify(req, res) {
    try {
      const idToken = req.body.idToken || req.body.credential || req.body.token;
      const userAgent = req.headers["user-agent"] || null;
      const ipAddress = req.ip || req.connection?.remoteAddress || null;

      if (!idToken) {
        return res.status(400).json({
          success: false,
          message: "Google token/credential is required",
        });
      }

      const result = await authService.googleLogin({
        idToken,
        userAgent,
        ipAddress,
      });

      return res.status(200).json({
        success: true,
        message: "Google authentication successful",
        data: {
          user: result.user,
          accessToken: result.accessToken,
          refreshToken: result.refreshToken,
          session: result.session,
        },
      });
    } catch (err) {
      const status = err.statusCode || 401;
      return res.status(status).json({
        success: false,
        message: err.message || "Google authentication failed",
      });
    }
  }

  /**
   * GET /api/auth/google
   * Initiates Google OAuth2 redirect flow
   */
  googleRedirect(req, res) {
    if (!env.GOOGLE_CLIENT_ID) {
      return res.status(500).json({
        success: false,
        message: "Google OAuth credentials not configured on server",
      });
    }

    const scope = encodeURIComponent("openid email profile");
    const redirectUri = encodeURIComponent(env.GOOGLE_CALLBACK_URL);
    const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?response_type=code&client_id=${env.GOOGLE_CLIENT_ID}&redirect_uri=${redirectUri}&scope=${scope}&access_type=offline&prompt=consent`;

    return res.redirect(googleAuthUrl);
  }

  /**
   * GET /api/auth/google/callback
   * Handles Google OAuth2 code exchange redirect
   */
  async googleCallback(req, res) {
    const { code, error } = req.query;

    if (error || !code) {
      return res.redirect(
        `${env.FRONTEND_URL}/login?error=${encodeURIComponent(error || "Google authentication was cancelled")}`
      );
    }

    try {
      // Exchange code for tokens with Google
      const postData = new URLSearchParams({
        code: String(code),
        client_id: env.GOOGLE_CLIENT_ID,
        client_secret: env.GOOGLE_CLIENT_SECRET,
        redirect_uri: env.GOOGLE_CALLBACK_URL,
        grant_type: "authorization_code",
      }).toString();

      const tokenData = await new Promise((resolve, reject) => {
        const req = https.request(
          "https://oauth2.googleapis.com/token",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
              "Content-Length": Buffer.byteLength(postData),
            },
          },
          (res) => {
            let body = "";
            res.on("data", (chunk) => (body += chunk));
            res.on("end", () => {
              try {
                const parsed = JSON.parse(body);
                if (parsed.error) return reject(new Error(parsed.error_description || parsed.error));
                resolve(parsed);
              } catch (e) {
                reject(e);
              }
            });
          }
        );
        req.on("error", reject);
        req.write(postData);
        req.end();
      });

      const userAgent = req.headers["user-agent"] || null;
      const ipAddress = getClientIp(req);

      const result = await authService.googleLogin({
        idToken: tokenData.id_token,
        userAgent,
        ipAddress,
      });

      // Redirect to frontend with tokens
      const redirectUrl = `${env.FRONTEND_URL}/auth/callback?token=${result.accessToken}&refreshToken=${result.refreshToken}`;
      return res.redirect(redirectUrl);
    } catch (err) {
      console.error("Google callback error:", err);
      return res.redirect(
        `${env.FRONTEND_URL}/login?error=${encodeURIComponent(err.message || "Google authentication failed")}`
      );
    }
  }

  /**
   * POST /api/auth/logout
   */
  async logout(req, res) {
    try {
      const refreshToken = req.body.refreshToken || req.headers["x-refresh-token"];
      await authService.logout(refreshToken);

      return res.status(200).json({
        success: true,
        message: "Logged out successfully",
      });
    } catch (err) {
      return res.status(500).json({
        success: false,
        message: err.message || "Logout failed",
      });
    }
  }

  /**
   * POST /api/auth/logout-all
   * Requires Auth
   */
  async logoutAll(req, res) {
    try {
      await authService.logoutAll(req.user.id);

      return res.status(200).json({
        success: true,
        message: "Logged out from all devices successfully",
      });
    } catch (err) {
      const status = err.statusCode || 500;
      return res.status(status).json({
        success: false,
        message: err.message || "Logout from all devices failed",
      });
    }
  }
}

module.exports = new AuthController();
