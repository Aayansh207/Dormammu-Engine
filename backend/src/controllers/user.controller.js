const prisma = require("../config/db");
const userService = require("../services/user.service");

/**
 * GET /api/users/me
 * Returns the current authenticated user's profile
 */
async function getProfile(req, res) {
  try {
    const profile = await userService.getUserProfile(req.user.id);
    return res.status(200).json({
      success: true,
      data: profile,
    });
  } catch (err) {
    const status = err.statusCode || 500;
    return res.status(status).json({
      success: false,
      message: err.message || "Failed to retrieve user profile",
    });
  }
}

/**
 * PATCH /api/users/me
 * Updates permitted profile fields (strictly name and profilePhoto)
 */
async function updateProfile(req, res) {
  try {
    const { name, profilePhoto } = req.body;

    const updatedProfile = await userService.updateUserProfile(req.user.id, {
      name,
      profilePhoto,
    });

    return res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      data: updatedProfile,
    });
  } catch (err) {
    const status = err.statusCode || 500;
    return res.status(status).json({
      success: false,
      message: err.message || "Failed to update profile",
    });
  }
}

/**
 * Legacy createUser helper (kept for backwards compatibility)
 */
async function createUser(req, res) {
  try {
    const { email, name } = req.body;

    const user = await prisma.user.create({
      data: { email, name },
    });

    return res.status(201).json({ success: true, data: user });
  } catch (error) {
    if (error.code === "P2002") {
      return res.status(409).json({ message: "Email already exists" });
    }

    console.error("createUser failed:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
}

module.exports = {
  getProfile,
  updateProfile,
  createUser,
};