const bcrypt = require("bcryptjs");
const prisma = require("../config/db");
const { sanitizeName, validatePassword } = require("../utils/validators");

class UserService {
  _toSafeUser(user) {
    if (!user) return null;
    const providers = [];
    if (user.passwordHash) providers.push("credentials");
    if (user.googleId) providers.push("google");

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      profilePhoto: user.profilePhoto,
      emailVerified: user.emailVerified,
      hasPassword: Boolean(user.passwordHash),
      hasGoogleAuth: Boolean(user.googleId),
      linkedProviders: providers,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  /**
   * Get safe user profile with linked provider information
   */
  async getUserProfile(userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      const error = new Error("User not found");
      error.statusCode = 404;
      throw error;
    }

    return this._toSafeUser(user);
  }

  /**
   * Safely update profile fields (strictly name and profilePhoto)
   * If profilePhoto is a base64 data URI, it is automatically uploaded to Cloudinary
   */
  async updateUserProfile(userId, { name, profilePhoto }) {
    const updateData = {};

    if (name !== undefined) {
      updateData.name = sanitizeName(name);
    }

    if (profilePhoto !== undefined) {
      if (typeof profilePhoto === "string" && profilePhoto.trim()) {
        const trimmed = profilePhoto.trim();
        // If client sends a base64 Data URI, upload to Cloudinary so we NEVER save huge base64 strings in DB
        if (trimmed.startsWith("data:image/")) {
          const cloudinaryService = require("./cloudinary.service");
          if (cloudinaryService.isConfigured()) {
            const uploaded = await cloudinaryService.uploadImage(trimmed, { userId });
            updateData.profilePhoto = uploaded.secure_url;
          } else {
            // Cloudinary not configured yet
            const error = new Error(
              "Cloudinary keys are not configured in backend/.env. Please configure CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET."
            );
            error.statusCode = 503;
            throw error;
          }
        } else {
          // Regular HTTPS URL (e.g. Google photo URL or existing CDN URL)
          updateData.profilePhoto = trimmed;
        }
      } else if (profilePhoto === null || profilePhoto === "") {
        updateData.profilePhoto = null;
      }
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
    });

    return this._toSafeUser(updatedUser);
  }

  /**
   * Upload an avatar file buffer directly to Cloudinary and update profile
   */
  async uploadAvatar(userId, fileBuffer) {
    const cloudinaryService = require("./cloudinary.service");
    if (!cloudinaryService.isConfigured()) {
      const error = new Error(
        "Cloudinary keys are not configured in backend/.env. Please configure CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET."
      );
      error.statusCode = 503;
      throw error;
    }

    const uploaded = await cloudinaryService.uploadImage(fileBuffer, { userId });

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { profilePhoto: uploaded.secure_url },
    });

    return {
      user: this._toSafeUser(updatedUser),
      url: uploaded.secure_url,
    };
  }

  /**
   * Set or change user password
   */
  async changePassword(userId, { currentPassword, newPassword }) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      const error = new Error("User not found");
      error.statusCode = 404;
      throw error;
    }

    // If user already has a password, verify current password
    if (user.passwordHash) {
      if (!currentPassword) {
        const error = new Error("Current password is required to change password");
        error.statusCode = 400;
        throw error;
      }
      const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!isValid) {
        const error = new Error("Current password does not match");
        error.statusCode = 400;
        throw error;
      }
    }

    const check = validatePassword(newPassword);
    if (!check.isValid) {
      const error = new Error(check.error);
      error.statusCode = 400;
      throw error;
    }

    const newHash = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newHash },
    });

    return {
      success: true,
      message: user.passwordHash
        ? "Password changed successfully"
        : "Password set successfully. You can now log in with email and password.",
    };
  }
}

module.exports = new UserService();
