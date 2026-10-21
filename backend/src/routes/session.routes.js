const express = require("express");
const sessionController = require("../controllers/session.controller");
const { requireAuth } = require("../middleware/auth.middleware");

const router = express.Router();

router.use(requireAuth);

router.get("/", (req, res) => sessionController.listSessions(req, res));
router.get("/history", (req, res) => sessionController.getHistory(req, res));
router.delete("/", (req, res) => sessionController.revokeAllSessions(req, res));
router.delete("/:id", (req, res) => sessionController.revokeSession(req, res));

module.exports = router;
