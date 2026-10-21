const prisma = require("../config/db");
const { sanitizeName } = require("../utils/validators");

class UserService {
  /**
   * Get safe user profile with linked provider information
   */
  async getUserProfile(userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        oauthAccounts: {
          select: {
            provider: true,
            createdAt: true,
          },
        },
      },
    });

    if (!user) {
      const error = new Error("User not found");
      error.statusCode = 404;
      throw error;
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      profilePhoto: user.profilePhoto,
      emailVerified: user.emailVerified,
      hasPassword: Boolean(user.passwordHash),
      linkedProviders: user.oauthAccounts.map((acc) => acc.provider),
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
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
      include: {
        oauthAccounts: {
          select: {
            provider: true,
            createdAt: true,
          },
        },
      },
    });

    return {
      id: updatedUser.id,
      email: updatedUser.email,
      name: updatedUser.name,
      role: updatedUser.role,
      profilePhoto: updatedUser.profilePhoto,
      emailVerified: updatedUser.emailVerified,
      hasPassword: Boolean(updatedUser.passwordHash),
      linkedProviders: updatedUser.oauthAccounts.map((acc) => acc.provider),
      createdAt: updatedUser.createdAt,
      updatedAt: updatedUser.updatedAt,
    };
  }
}

module.exports = new UserService();
