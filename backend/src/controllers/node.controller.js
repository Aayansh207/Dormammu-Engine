/**
 * Webster Execution Engine - Node Catalogue Controller
 * Exposes canonical node metadata backed by PostgreSQL
 */

const nodeService = require("../services/node.service");

class NodeController {
  async listNodes(req, res, next) {
    try {
      const { category, includeUnavailable } = req.query || {};
      const nodes = await nodeService.listNodes({
        category,
        includeUnavailable: includeUnavailable === "true",
      });
      return res.status(200).json({
        success: true,
        data: nodes,
      });
    } catch (err) {
      next(err);
    }
  }

  async getNodeMetadata(req, res, next) {
    try {
      const { type } = req.params;
      const { version } = req.query || {};
      const metadata = await nodeService.getNodeMetadata(type, version);

      if (!metadata) {
        return res.status(404).json({
          success: false,
          message: `Node type '${type}' not found in catalogue`,
        });
      }

      return res.status(200).json({
        success: true,
        data: metadata,
      });
    } catch (err) {
      next(err);
    }
  }

  async seedNodes(req, res, next) {
    try {
      const result = await nodeService.seedNodeDefinitions();
      return res.status(200).json({
        success: true,
        message: `Successfully seeded ${result.upserted} node definitions into PostgreSQL`,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new NodeController();
