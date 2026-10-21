const express = require("express");
const sessionController = require("../controllers/session.controller");
const { requireAuth } = require("../middleware/auth.middleware");

const router = express.Router();

router.use(requireAuth);

router.get("/", (req, res) => sessionController.listSessions(req, res));
router.delete("/:id", (req, res) => sessionController.revokeSession(req, res));

module.exports = router;
