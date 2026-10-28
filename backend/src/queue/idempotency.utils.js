/**
 * Dormammu Engine - Idempotency Utilities
 * Provides request hashing, trigger deduplication, and atomic task execution claiming.
 */

const crypto = require("crypto");
const prisma = require("../config/db");

/**
 * Generates a deterministic SHA-256 hash of a payload object.
 * Keys are recursively sorted to ensure key ordering does not affect the hash.
 * @param {any} data
 * @returns {string} Hex hash string
 */
function hashPayload(data) {
  if (data === null || data === undefined) return "null";
  if (typeof data !== "object") return crypto.createHash("sha256").update(String(data)).digest("hex");

  function sortObject(obj) {
    if (obj === null || typeof obj !== "object") return obj;
    if (Array.isArray(obj)) return obj.map(sortObject);
    return Object.keys(obj)
      .sort()
      .reduce((acc, key) => {
        acc[key] = sortObject(obj[key]);
        return acc;
      }, {});
  }

  const normalizedJson = JSON.stringify(sortObject(data));
  return crypto.createHash("sha256").update(normalizedJson).digest("hex");
}

/**
 * Checks for existing idempotent WorkflowRun.
 * If found with matching payload hash, returns the existing run.
 * If found with conflicting payload, throws a 409 Conflict error.
 * @param {string} workflowId
 * @param {string} idempotencyKey
 * @param {any} inputPayload
 * @returns {Promise<Object|null>}
 */
async function checkTriggerIdempotency(workflowId, idempotencyKey, inputPayload) {
  if (!idempotencyKey || typeof idempotencyKey !== "string" || !idempotencyKey.trim()) {
    return null;
  }

  const trimmedKey = idempotencyKey.trim();
  const currentHash = hashPayload(inputPayload);

  const existing = await prisma.workflowRun.findUnique({
    where: {
      workflowId_idempotencyKey: {
        workflowId,
        idempotencyKey: trimmedKey,
      },
    },
  });

  if (!existing) {
    return null; // Safe to proceed with new run creation
  }

  // Verify whether the payload matches
  if (existing.idempotencyHash && existing.idempotencyHash !== currentHash) {
    const conflictErr = new Error(
      `Idempotency key '${trimmedKey}' was already used with a different request payload.`
    );
    conflictErr.statusCode = 409;
    conflictErr.code = "IDEMPOTENCY_CONFLICT";
    conflictErr.existingRunId = existing.id;
    throw conflictErr;
  }

  return existing;
}

/**
 * Atomically claims a task for execution by a worker.
 * Prevents concurrent workers from executing the same logical task or overwriting completed states.
 * @param {string} taskExecutionId
 * @param {string} workerId
 * @param {number} lockDurationMs
 * @returns {Promise<{ claimed: boolean, task: Object|null }>}
 */
async function claimTaskExecution(taskExecutionId, workerId, lockDurationMs = 30000) {
  const now = new Date();
  const claimExpiresAt = new Date(now.getTime() + lockDurationMs);

  // Atomic conditional update
  const result = await prisma.taskExecution.updateMany({
    where: {
      id: taskExecutionId,
      OR: [
        { status: "PENDING" },
        { status: "READY" },
        // Stalled lease recovery: active claim expired
        { status: "RUNNING", claimExpiresAt: { lt: now } },
      ],
    },
    data: {
      status: "RUNNING",
      claimedBy: workerId,
      claimExpiresAt,
      startedAt: now,
    },
  });

  if (result.count === 0) {
    // Could not claim: fetch current state to determine why
    const currentTask = await prisma.taskExecution.findUnique({
      where: { id: taskExecutionId },
    });
    return { claimed: false, task: currentTask };
  }

  // Fetch updated task record
  const claimedTask = await prisma.taskExecution.findUnique({
    where: { id: taskExecutionId },
  });

  return { claimed: true, task: claimedTask };
}

module.exports = {
  hashPayload,
  checkTriggerIdempotency,
  claimTaskExecution,
};
