/**
 * Webster Execution Engine - Initial Core Node Library (16 Nodes)
 */

const { defaultRegistry } = require("../node.registry");

const triggerManual = require("./trigger.manual");
const dataInput = require("./data.input");
const mathAdd = require("./math.add");
const mathSubtract = require("./math.subtract");
const mathMultiply = require("./math.multiply");
const mathDivide = require("./math.divide");
const mathModulo = require("./math.modulo");
const mathPower = require("./math.power");
const mathRound = require("./math.round");
const mathAbs = require("./math.abs");
const mathMin = require("./math.min");
const mathMax = require("./math.max");
const jsonParse = require("./json.parse");
const jsonGet = require("./json.get");
const outputLog = require("./output.log");
const outputReturn = require("./output.return");

const coreNodes = [
  triggerManual,
  dataInput,
  mathAdd,
  mathSubtract,
  mathMultiply,
  mathDivide,
  mathModulo,
  mathPower,
  mathRound,
  mathAbs,
  mathMin,
  mathMax,
  jsonParse,
  jsonGet,
  outputLog,
  outputReturn,
];

/**
 * Registers all core nodes into the specified registry (or default registry).
 * @param {import('../node.registry').NodeRegistry} [registry=defaultRegistry]
 */
function registerCoreNodes(registry = defaultRegistry) {
  for (const nodeDef of coreNodes) {
    if (!registry.has(nodeDef.type)) {
      registry.register(nodeDef);
    }
  }
}

// Auto-register core nodes into the default singleton registry
registerCoreNodes(defaultRegistry);

module.exports = {
  coreNodes,
  registerCoreNodes,
};
