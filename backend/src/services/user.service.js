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
   */
  async updateUserProfile(userId, { name, profilePhoto }) {
    const updateData = {};

    if (name !== undefined) {
      updateData.name = sanitizeName(name);
    }

    if (profilePhoto !== undefined) {
      // Validate string URL or null
      if (typeof profilePhoto === "string" && profilePhoto.trim()) {
        updateData.profilePhoto = profilePhoto.trim();
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
