const express = require("express");
const authController = require("../controllers/auth.controller");
const { requireAuth } = require("../middleware/auth.middleware");

const router = express.Router();

// Native Email & Password
router.post("/signup", (req, res) => authController.signup(req, res));
router.post("/login", (req, res) => authController.login(req, res));
router.post("/refresh", (req, res) => authController.refresh(req, res));

// Email Verification
router.post("/verify-email", (req, res) => authController.verifyEmail(req, res));
router.get("/verify-email", (req, res) => authController.verifyEmail(req, res));
router.post("/resend-verification", (req, res) => authController.resendVerification(req, res));

// Google OAuth
router.post("/google", (req, res) => authController.googleVerify(req, res));
router.get("/google", (req, res) => authController.googleRedirect(req, res));
router.get("/google/callback", (req, res) => authController.googleCallback(req, res));

// Logout & Session invalidation
router.post("/logout", (req, res) => authController.logout(req, res));
router.post("/logout-all", requireAuth, (req, res) => authController.logoutAll(req, res));
router.get("/login-history", requireAuth, (req, res) => authController.getLoginHistory(req, res));

module.exports = router;
