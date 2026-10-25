/**
 * Webster Execution Engine - Standard Core Node Library
 */

const { defaultRegistry } = require("../node.registry");

// Trigger nodes
const triggerManual = require("./trigger.manual");

// Data nodes
const dataInput = require("./data.input");
const dataObject = require("./data.object");
const dataArrayMap = require("./data.array.map");

// Math nodes
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

// JSON & Text nodes
const jsonParse = require("./json.parse");
const jsonGet = require("./json.get");
const textConcat = require("./text.concat");
const textTemplate = require("./text.template");

// Logic & Flow control nodes
const logicCondition = require("./logic.condition");
const logicSwitch = require("./logic.switch");
const flowMerge = require("./flow.merge");
const flowDelay = require("./flow.delay");

// HTTP nodes
const httpRequest = require("./http.request");
const httpRespond = require("./http.respond");

// AI nodes
const aiClassify = require("./ai.classify");
const aiExtract = require("./ai.extract");
const aiSummarize = require("./ai.summarize");

// Utility & Output nodes
const utilityUuid = require("./utility.uuid");
const utilityDatetime = require("./utility.datetime");
const outputLog = require("./output.log");
const outputReturn = require("./output.return");

const coreNodes = [
  // Triggers
  triggerManual,

  // Data
  dataInput,
  dataObject,
  dataArrayMap,

  // Math
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

  // JSON & Text
  jsonParse,
  jsonGet,
  textConcat,
  textTemplate,

  // Logic & Flow Control
  logicCondition,
  logicSwitch,
  flowMerge,
  flowDelay,

  // HTTP
  httpRequest,
  httpRespond,

  // AI
  aiClassify,
  aiExtract,
  aiSummarize,

  // Utilities & Outputs
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

// Auto-register on module load into default registry
registerCoreNodes(defaultRegistry);

module.exports = {
  coreNodes,
  registerCoreNodes,
};
