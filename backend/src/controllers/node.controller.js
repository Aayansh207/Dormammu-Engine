/**
 * Webster Execution Engine - Node Catalogue Controller
 */

const { defaultRegistry } = require("../engine/registry/node.registry");

class NodeController {
  async listNodes(req, res, next) {
    try {
      const nodes = defaultRegistry.list();
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
      if (!defaultRegistry.has(type)) {
        return res.status(404).json({
          success: false,
          message: `Node type '${type}' not found in registry catalogue`,
        });
      }
      const metadata = defaultRegistry.getMetadata(type);
      return res.status(200).json({
        success: true,
        data: metadata,
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new NodeController();
