const bcrypt = require("bcryptjs");
const https = require("https");
const prisma = require("../config/db");
const env = require("../../env");
const sessionService = require("./session.service");
const mailService = require("./mail.service");
const {
  generateAccessToken,
  generateRefreshToken,
  generateVerificationToken,
  hashToken,
} = require("../utils/tokens");
const {
  normalizeEmail,
  isValidEmail,
  validatePassword,
  sanitizeName,
} = require("../utils/validators");

class AuthService {
  /**
   * Helper to format safe public user object (never leak passwordHash)
   */
  _toSafeUser(user) {
    if (!user) return null;
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      profilePhoto: user.profilePhoto,
      emailVerified: user.emailVerified,
      hasPassword: Boolean(user.passwordHash),
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  /**
   * Native Email & Password Registration
   */
  async signup({ name, email, password, userAgent = null, ipAddress = null }) {
    const normalizedEmail = normalizeEmail(email);

    if (!isValidEmail(normalizedEmail)) {
      const err = new Error("Invalid email format");
      err.statusCode = 400;
      throw err;
    }

    const passwordValidation = validatePassword(password);
    if (!passwordValidation.isValid) {
      const err = new Error(passwordValidation.error);
      err.statusCode = 400;
      throw err;
    }

    const cleanName = sanitizeName(name);

    // Check duplicate email
    const existing = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existing) {
      const err = new Error("An account with this email already exists");
      err.statusCode = 409;
      throw err;
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const autoVerify = !env.REQUIRE_EMAIL_VERIFICATION;

    // Create user
    const user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        name: cleanName,
        passwordHash,
        emailVerified: autoVerify,
      },
    });

    if (autoVerify) {
      // Instant signup & login without mailing!
      const rawRefreshToken = generateRefreshToken();
      const session = await sessionService.createSession({
        userId: user.id,
        refreshToken: rawRefreshToken,
        userAgent,
        ipAddress,
      });

      const accessToken = generateAccessToken(user, session.id);

      return {
        user: this._toSafeUser(user),
        message: "Registration successful! You are now logged in.",
        accessToken,
        refreshToken: rawRefreshToken,
        session: {
          id: session.id,
          expiresAt: session.expiresAt,
        },
      };
    }

    // Create Email Verification Token
    const rawVerificationToken = generateVerificationToken();
    const tokenHash = hashToken(rawVerificationToken);
    const expiresAt = new Date(
      Date.now() + env.EMAIL_VERIFICATION_EXPIRATION_HOURS * 3600 * 1000
    );

    await prisma.emailVerificationToken.create({
      data: {
        tokenHash,
        userId: user.id,
        expiresAt,
      },
    });

    // Send verification email
    const mailResult = await mailService.sendVerificationEmail({
      toEmail: user.email,
      name: user.name,
      token: rawVerificationToken,
    });

    return {
      user: this._toSafeUser(user),
      message: mailResult.sent
        ? "Registration successful. Please check your email to verify your account."
        : "Registration successful. Note: Mailjet delivery was paused by your provider. You can verify using the link below.",
      mailSent: mailResult.sent,
      verificationToken: rawVerificationToken,
      verificationUrl: mailResult.verificationUrl,
      mailError: mailResult.error || null,
    };
  }

  /**
   * Native Email & Password Login
   */
  async login({ email, password, userAgent = null, ipAddress = null }) {
    const normalizedEmail = normalizeEmail(email);

    if (!normalizedEmail || !password) {
      const err = new Error("Email and password are required");
      err.statusCode = 400;
      throw err;
    }

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      const err = new Error("Invalid email or password");
      err.statusCode = 401;
      throw err;
    }

    if (!user.passwordHash) {
      const err = new Error(
        "This account was registered with Google. Please use Continue with Google."
      );
      err.statusCode = 400;
      throw err;
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      const err = new Error("Invalid email or password");
      err.statusCode = 401;
      throw err;
    }

    // Email verification check (only enforced when REQUIRE_EMAIL_VERIFICATION is enabled)
    if (env.REQUIRE_EMAIL_VERIFICATION && !user.emailVerified) {
      const err = new Error("Email not verified. Please verify your email before logging in.");
      err.statusCode = 403;
      err.unverified = true;
      err.email = user.email;
      throw err;
    }

    // Issue refresh token & session
    const rawRefreshToken = generateRefreshToken();
    const session = await sessionService.createSession({
      userId: user.id,
      refreshToken: rawRefreshToken,
      userAgent,
      ipAddress,
    });

    const accessToken = generateAccessToken(user, session.id);

    return {
      user: this._toSafeUser(user),
      accessToken,
      refreshToken: rawRefreshToken,
      session: {
        id: session.id,
        expiresAt: session.expiresAt,
      },
    };
  }

  /**
   * Refresh Access Token & Rotate Refresh Token
   */
  async refresh({ refreshToken, userAgent = null, ipAddress = null }) {
    if (!refreshToken) {
      const err = new Error("Refresh token is required");
      err.statusCode = 400;
      throw err;
    }

    const session = await sessionService.findSessionByToken(refreshToken);

    if (!session) {
      const err = new Error("Invalid refresh token");
      err.statusCode = 401;
      throw err;
    }

    // Replay / Revocation Protection
    if (session.revokedAt) {
      // Possible token reuse attack detected: revoke all sessions for this user
      await sessionService.revokeAllUserSessions(session.userId);
      const err = new Error("Refresh token has been revoked. All sessions invalidated for security.");
      err.statusCode = 401;
      throw err;
    }

    // Expiry check
    if (new Date() > new Date(session.expiresAt)) {
      const err = new Error("Refresh token has expired. Please log in again.");
      err.statusCode = 401;
      throw err;
    }

    // Rotate refresh token
    const newRefreshToken = generateRefreshToken();
    await sessionService.rotateSessionToken(session.id, newRefreshToken);

    const accessToken = generateAccessToken(session.user, session.id);

    return {
      user: this._toSafeUser(session.user),
      accessToken,
      refreshToken: newRefreshToken,
      session: {
        id: session.id,
        expiresAt: session.expiresAt,
      },
    };
  }

  /**
   * Email Verification
   */
  async verifyEmail(rawToken) {
    if (!rawToken || typeof rawToken !== "string") {
      const err = new Error("Verification token is required");
      err.statusCode = 400;
      throw err;
    }

    const tokenHash = hashToken(rawToken);

    const verificationRecord = await prisma.emailVerificationToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!verificationRecord) {
      const err = new Error("Invalid verification token");
      err.statusCode = 400;
      throw err;
    }

    if (verificationRecord.usedAt) {
      const err = new Error("Verification token has already been used");
      err.statusCode = 400;
      throw err;
    }

    if (new Date() > new Date(verificationRecord.expiresAt)) {
      const err = new Error("Verification token has expired. Please request a new one.");
      err.statusCode = 400;
      throw err;
    }

    // Mark token as used & set user emailVerified = true
    await prisma.$transaction([
      prisma.emailVerificationToken.update({
        where: { id: verificationRecord.id },
        data: { usedAt: new Date() },
      }),
      prisma.user.update({
        where: { id: verificationRecord.userId },
        data: { emailVerified: true },
      }),
    ]);

    return {
      success: true,
      message: "Email successfully verified. You can now log in.",
    };
  }

  /**
   * Resend Verification Email with Rate Limiting
   */
  async resendVerification(email) {
    const normalizedEmail = normalizeEmail(email);

    if (!isValidEmail(normalizedEmail)) {
      const err = new Error("Invalid email format");
      err.statusCode = 400;
      throw err;
    }

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      // Don't leak whether user exists
      return { success: true, message: "If your email is registered, a new verification link has been sent." };
    }

    if (user.emailVerified) {
      const err = new Error("This email is already verified. You can log in.");
      err.statusCode = 400;
      throw err;
    }

    // Rate Limiting: Check if a token was generated in the last 60 seconds
    const oneMinuteAgo = new Date(Date.now() - 60 * 1000);
    const recentToken = await prisma.emailVerificationToken.findFirst({
      where: {
        userId: user.id,
        createdAt: { gt: oneMinuteAgo },
      },
    });

    if (recentToken) {
      const err = new Error("Please wait at least 60 seconds before requesting another verification email.");
      err.statusCode = 429;
      throw err;
    }

    // Invalidate existing unused tokens for this user
    await prisma.emailVerificationToken.updateMany({
      where: {
        userId: user.id,
        usedAt: null,
      },
      data: {
        usedAt: new Date(),
      },
    });

    // Create new token
    const rawVerificationToken = generateVerificationToken();
    const tokenHash = hashToken(rawVerificationToken);
    const expiresAt = new Date(
      Date.now() + env.EMAIL_VERIFICATION_EXPIRATION_HOURS * 3600 * 1000
    );

    await prisma.emailVerificationToken.create({
      data: {
        tokenHash,
        userId: user.id,
        expiresAt,
      },
    });

    const mailResult = await mailService.sendVerificationEmail({
      toEmail: user.email,
      name: user.name,
      token: rawVerificationToken,
    });

    return {
      success: true,
      message: mailResult.sent
        ? "A new verification email has been sent."
        : "Verification link generated. (Mailjet account temporarily blocked by Mailjet).",
      mailSent: mailResult.sent,
      verificationToken: rawVerificationToken,
      verificationUrl: mailResult.verificationUrl,
      mailError: mailResult.error || null,
    };
  }

  /**
   * Helper to verify a Google ID Token or Access Token via Google's endpoint
   */
  async verifyGoogleToken(idToken) {
    return new Promise((resolve, reject) => {
      const url = `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`;
      https
        .get(url, (res) => {
          let data = "";
          res.on("data", (chunk) => (data += chunk));
          res.on("end", () => {
            try {
              const parsed = JSON.parse(data);
              if (parsed.error || parsed.error_description) {
                return reject(new Error(parsed.error_description || parsed.error));
              }
              resolve(parsed);
            } catch (err) {
              reject(err);
            }
          });
        })
        .on("error", (err) => reject(err));
    });
  }

  /**
   * Google OAuth Login / Signup with Safe Account Linking
   */
  async googleLogin({ idToken, userAgent = null, ipAddress = null }) {
    if (!idToken) {
      const err = new Error("Google credential token is required");
      err.statusCode = 400;
      throw err;
    }

    let payload;
    try {
      payload = await this.verifyGoogleToken(idToken);
    } catch (err) {
      const error = new Error(`Google token verification failed: ${err.message}`);
      error.statusCode = 401;
      throw error;
    }

    const {
      sub,
      email,
      email_verified,
      name,
      picture,
      aud,
    } = payload;

    if (!sub || !email) {
      const err = new Error("Invalid Google profile response");
      err.statusCode = 400;
      throw err;
    }

    // Validate email verification status from Google
    const isGoogleVerified = email_verified === true || email_verified === "true";
    if (!isGoogleVerified) {
      const err = new Error("Google account email is not verified");
      err.statusCode = 403;
      throw err;
    }

    // Verify audience if GOOGLE_CLIENT_ID is configured
    if (env.GOOGLE_CLIENT_ID && aud && aud !== env.GOOGLE_CLIENT_ID) {
      const err = new Error("Google token was not issued for this application client ID");
      err.statusCode = 401;
      throw err;
    }

    const normalizedEmail = normalizeEmail(email);

    // 1. Check if OAuth account is already linked
    const existingOAuth = await prisma.oAuthAccount.findUnique({
      where: {
        provider_providerAccountId: {
          provider: "google",
          providerAccountId: sub,
        },
      },
      include: { user: true },
    });

    let user;

    if (existingOAuth) {
      // Account is already linked
      user = existingOAuth.user;
    } else {
      // 2. Check if a User with this email already exists
      const existingUser = await prisma.user.findUnique({
        where: { email: normalizedEmail },
      });

      if (existingUser) {
        // Safe Account Linking: Link Google to existing user!
        // DO NOT overwrite passwordHash or existing profile details!
        const updateData = {};
        if (!existingUser.emailVerified) {
          updateData.emailVerified = true;
        }
        if (!existingUser.profilePhoto && picture) {
          updateData.profilePhoto = picture;
        }

        user = await prisma.$transaction(async (tx) => {
          await tx.oAuthAccount.create({
            data: {
              provider: "google",
              providerAccountId: sub,
              userId: existingUser.id,
            },
          });

          if (Object.keys(updateData).length > 0) {
            return tx.user.update({
              where: { id: existingUser.id },
              data: updateData,
            });
          }
          return existingUser;
        });
      } else {
        // 3. New User Registration via Google
        user = await prisma.user.create({
          data: {
            email: normalizedEmail,
            name: sanitizeName(name),
            profilePhoto: picture || null,
            emailVerified: true, // Verified by Google
            oauthAccounts: {
              create: {
                provider: "google",
                providerAccountId: sub,
              },
            },
          },
        });
      }
    }

    // Issue session and tokens
    const rawRefreshToken = generateRefreshToken();
    const session = await sessionService.createSession({
      userId: user.id,
      refreshToken: rawRefreshToken,
      userAgent,
      ipAddress,
    });

    const accessToken = generateAccessToken(user, session.id);

    return {
      user: this._toSafeUser(user),
      accessToken,
      refreshToken: rawRefreshToken,
      session: {
        id: session.id,
        expiresAt: session.expiresAt,
      },
    };
  }

  /**
   * Logout from current session
   */
  async logout(refreshToken) {
    if (!refreshToken) return { success: true };
    const session = await sessionService.findSessionByToken(refreshToken);
    if (session && !session.revokedAt) {
      await prisma.session.update({
        where: { id: session.id },
        data: { revokedAt: new Date() },
      });
    }
    return { success: true, message: "Logged out successfully" };
  }

  /**
   * Logout from all devices
   */
  async logoutAll(userId) {
    if (!userId) {
      const err = new Error("User ID is required");
      err.statusCode = 400;
      throw err;
    }
    await sessionService.revokeAllUserSessions(userId);
    return { success: true, message: "Logged out from all devices" };
  }
}

module.exports = new AuthService();
