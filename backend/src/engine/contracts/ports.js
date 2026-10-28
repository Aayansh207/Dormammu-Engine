/**
 * Webster Execution Engine - Port Contracts & Type Checking
 */

const PortTypes = {
  STRING: "string",
  NUMBER: "number",
  BOOLEAN: "boolean",
  OBJECT: "object",
  ARRAY: "array",
  ANY: "any",
};

/**
 * Validates whether a value matches the declared port type.
 * @param {any} value
 * @param {string} declaredType - one of PortTypes
 * @returns {boolean}
 */
function isValueCompatibleWithType(value, declaredType) {
  if (declaredType === PortTypes.ANY || declaredType === undefined || declaredType === null) {
    return true;
  }
  if (value === null || value === undefined) {
    return true; // null/undefined compatibility handled by required check
  }

  switch (declaredType) {
    case PortTypes.STRING:
      return typeof value === "string";
    case PortTypes.NUMBER:
      if (typeof value === "number") return !Number.isNaN(value);
      if (typeof value === "string" && value.trim() !== "" && !Number.isNaN(Number(value))) return true;
      if (typeof value === "object" && value !== null && !Array.isArray(value)) {
        const inner = value.value !== undefined ? value.value : (value.output !== undefined ? value.output : value.payload);
        if (typeof inner === "number" && !Number.isNaN(inner)) return true;
        if (typeof inner === "string" && inner.trim() !== "" && !Number.isNaN(Number(inner))) return true;
      }
      return false;
    case PortTypes.BOOLEAN:
      return typeof value === "boolean";
    case PortTypes.OBJECT:
      return typeof value === "object" && !Array.isArray(value);
    case PortTypes.ARRAY:
      return Array.isArray(value);
    default:
      return true;
  }
}

/**
 * Creates an input port definition.
 * @param {Object} options
 * @param {string} options.name - unique port name on the node
 * @param {string} [options.type=PortTypes.ANY] - data type
 * @param {boolean} [options.required=false] - whether an incoming value is mandatory
 * @param {any} [options.defaultValue=undefined] - default value if not connected or undefined
 * @param {string} [options.description=""]
 * @param {boolean} [options.allowMultiple=false] - whether multiple incoming edges are permitted
 */
function defineInputPort({
  name,
  type = PortTypes.ANY,
  required = false,
  defaultValue = undefined,
  description = "",
  allowMultiple = false,
}) {
  if (!name || typeof name !== "string") {
    throw new Error("Port name must be a non-empty string");
  }
  return {
    name,
    type,
    required: Boolean(required),
    defaultValue,
    description,
    allowMultiple: Boolean(allowMultiple),
  };
}

/**
 * Creates an output port definition.
 * @param {Object} options
 * @param {string} options.name - unique port name on the node
 * @param {string} [options.type=PortTypes.ANY] - data type
 * @param {string} [options.description=""]
 */
function defineOutputPort({
  name,
  type = PortTypes.ANY,
  description = "",
}) {
  if (!name || typeof name !== "string") {
    throw new Error("Port name must be a non-empty string");
  }
  return {
    name,
    type,
    description,
  };
}

module.exports = {
  PortTypes,
  isValueCompatibleWithType,
  defineInputPort,
  defineOutputPort,
};
