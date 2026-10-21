const express = require("express");
const { getProfile, updateProfile } = require("../controllers/user.controller");
const { requireAuth } = require("../middleware/auth.middleware");

const router = express.Router();

router.use(requireAuth);

router.get("/me", getProfile);
router.patch("/me", updateProfile);

module.exports = router;
