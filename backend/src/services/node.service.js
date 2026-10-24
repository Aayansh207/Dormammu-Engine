/**
 * Webster Execution Engine - Node Definition Service
 * PostgreSQL Source of Truth for Node Metadata and Catalogue
 */

const prisma = require("../config/db");
const { defaultRegistry } = require("../engine/registry/node.registry");

class NodeService {
  /**
   * Deterministically seeds or upserts registered node definitions into PostgreSQL.
   * Safe to call multiple times without creating duplicates.
   * @param {import('../engine/registry/node.registry').NodeRegistry} [registry=defaultRegistry]
   * @returns {Promise<{ total: number, upserted: number }>}
   */
  async seedNodeDefinitions(registry = defaultRegistry) {
    const registeredNodes = registry.list();
    let upsertedCount = 0;

    for (const node of registeredNodes) {
      const versionNum = typeof node.version === "number" ? node.version : parseInt(node.version, 10) || 1;

      await prisma.nodeDefinition.upsert({
        where: {
          type_version: {
            type: node.type,
            version: versionNum,
          },
        },
        update: {
          label: node.label,
          description: node.description,
          category: node.category,
          inputs: node.inputs,
          outputs: node.outputs,
          configSchema: node.configSchema,
          capabilities: node.capabilities,
          isAvailable: true,
          updatedAt: new Date(),
        },
        create: {
          type: node.type,
          version: versionNum,
          label: node.label,
          description: node.description,
          category: node.category,
          inputs: node.inputs,
          outputs: node.outputs,
          configSchema: node.configSchema,
          capabilities: node.capabilities,
          isAvailable: true,
        },
      });
      upsertedCount++;
    }

    return { total: registeredNodes.length, upserted: upsertedCount };
  }

  /**
   * Lists all node definitions stored in PostgreSQL.
   * Cross-references with the in-process registry to verify handler availability.
   * @param {Object} [options={}]
   * @param {boolean} [options.includeUnavailable=false]
   * @param {string} [options.category]
   * @returns {Promise<Array<Object>>}
   */
  async listNodes({ includeUnavailable = false, category = null } = {}) {
    try {
      const whereClause = {
        ...(includeUnavailable ? {} : { isAvailable: true }),
        ...(category ? { category } : {}),
      };

      let storedDefinitions = await prisma.nodeDefinition.findMany({
        where: whereClause,
        orderBy: [{ category: "asc" }, { type: "asc" }],
      });

      // If database has no definitions seeded yet, seed from registry and re-query
      if (storedDefinitions.length === 0) {
        await this.seedNodeDefinitions(defaultRegistry);
        storedDefinitions = await prisma.nodeDefinition.findMany({
          where: whereClause,
          orderBy: [{ category: "asc" }, { type: "asc" }],
        });
      }

      return storedDefinitions.map((def) => {
        const hasExecutableHandler = defaultRegistry.has(def.type);
        return {
          id: def.id,
          type: def.type,
          version: def.version,
          label: def.label,
          description: def.description,
          category: def.category,
          inputs: def.inputs,
          outputs: def.outputs,
          configSchema: def.configSchema,
          capabilities: def.capabilities,
          isAvailable: def.isAvailable,
          hasExecutableHandler,
          createdAt: def.createdAt,
          updatedAt: def.updatedAt,
        };
      });
    } catch (err) {
      console.warn("Falling back to in-memory registry catalogue due to DB error:", err.message);
      return defaultRegistry.list().map((node) => ({
        ...node,
        isAvailable: true,
        hasExecutableHandler: true,
      }));
    }
  }

  /**
   * Retrieves definition metadata for a specific node type from PostgreSQL.
   * @param {string} type
   * @param {number} [version=null]
   * @returns {Promise<Object|null>}
   */
  async getNodeMetadata(type, version = null) {
    try {
      let definition = await prisma.nodeDefinition.findFirst({
        where: {
          type,
          ...(version ? { version: Number(version) } : {}),
        },
        orderBy: { version: "desc" },
      });

      if (!definition && defaultRegistry.has(type)) {
        // Auto-seed this node and retrieve
        await this.seedNodeDefinitions(defaultRegistry);
        definition = await prisma.nodeDefinition.findFirst({
          where: {
            type,
            ...(version ? { version: Number(version) } : {}),
          },
          orderBy: { version: "desc" },
        });
      }

      if (!definition) {
        return null;
      }

      return {
        id: definition.id,
        type: definition.type,
        version: definition.version,
        label: definition.label,
        description: definition.description,
        category: definition.category,
        inputs: definition.inputs,
        outputs: definition.outputs,
        configSchema: definition.configSchema,
        capabilities: definition.capabilities,
        isAvailable: definition.isAvailable,
        hasExecutableHandler: defaultRegistry.has(definition.type),
        createdAt: definition.createdAt,
        updatedAt: definition.updatedAt,
      };
    } catch (err) {
      console.warn("Falling back to registry metadata due to DB error:", err.message);
      if (defaultRegistry.has(type)) {
        return {
          ...defaultRegistry.getMetadata(type),
          isAvailable: true,
          hasExecutableHandler: true,
        };
      }
      return null;
    }
  }
}

module.exports = new NodeService();
