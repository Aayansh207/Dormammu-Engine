/**
 * Webster Execution Engine - Initial Core Node Library
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
const mathAverage = require("./math.average");
const jsonParse = require("./json.parse");
const jsonGet = require("./json.get");
const textConcat = require("./text.concat");
const utilityUuid = require("./utility.uuid");
const utilityDatetime = require("./utility.datetime");
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
  mathAverage,
  jsonParse,
  jsonGet,
  textConcat,
  utilityUuid,
  utilityDatetime,
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
