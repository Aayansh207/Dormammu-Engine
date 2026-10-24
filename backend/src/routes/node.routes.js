/**
 * Webster Execution Engine - Node Catalogue Routes
 */

const express = require("express");
const nodeController = require("../controllers/node.controller");

const router = express.Router();

// Node catalogue is accessible to authenticated and unauthenticated callers
router.get("/", nodeController.listNodes);
router.post("/seed", nodeController.seedNodes);
router.get("/:type", nodeController.getNodeMetadata);

module.exports = router;
