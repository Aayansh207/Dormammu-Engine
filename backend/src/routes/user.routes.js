const express = require("express");
const {
  getProfile,
  updateProfile,
  changePassword,
  getLoginHistory,
} = require("../controllers/user.controller");
const { requireAuth } = require("../middleware/auth.middleware");

const router = express.Router();

router.use(requireAuth);

router.get("/me", getProfile);
router.patch("/me", updateProfile);
router.post("/me/password", changePassword);
router.get("/me/login-history", getLoginHistory);

module.exports = router;
