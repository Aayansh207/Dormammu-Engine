/**
 * Dormammu Engine - Transactional Outbox Service
 * Bridges PostgreSQL state mutations and Redis queue dispatches with at-least-once durability.
 */

const prisma = require("../config/db");
const { enqueueTaskJob } = require("./queue.producer");
const { QUEUES, JOB_TYPES } = require("./queue.constants");

class OutboxService {
  constructor() {
    this._dispatcherInterval = null;
    this._isDispatching = false;
  }

  /**
   * Persists an intended queue job inside a PostgreSQL transaction.
   * @param {import('@prisma/client').PrismaClient} tx
   * @param {Object} options
   */
  async recordDispatch(tx, { queueName = QUEUES.WORKFLOW_TASKS, jobName = JOB_TYPES.EXECUTE_NODE, payload }) {
    const client = tx || prisma;
    return client.outboxMessage.create({
      data: {
        queueName,
        jobName,
        payload,
        status: "PENDING",
      },
    });
  }

  /**
   * Dispatches pending outbox entries to BullMQ with at-least-once delivery.
   * @param {number} [limit=50]
   * @returns {Promise<number>} Number of dispatched messages
   */
  async dispatchPending(limit = 50) {
    if (this._isDispatching) return 0;
    this._isDispatching = true;

    try {
      const pendingMessages = await prisma.outboxMessage.findMany({
        where: { status: "PENDING" },
        orderBy: { createdAt: "asc" },
        take: limit,
      });

      if (pendingMessages.length === 0) return 0;

      let dispatchedCount = 0;
      for (const msg of pendingMessages) {
        try {
          const payload = msg.payload;
          if (msg.queueName === QUEUES.WORKFLOW_TASKS && msg.jobName === JOB_TYPES.EXECUTE_NODE) {
            await enqueueTaskJob({
              runId: payload.runId,
              workflowId: payload.workflowId,
              workflowVersionId: payload.workflowVersionId,
              nodeId: payload.nodeId,
              taskExecutionId: payload.taskExecutionId,
              attempt: payload.attempt || 1,
              delay: payload.delay || 0,
            });
          }

          await prisma.outboxMessage.update({
            where: { id: msg.id },
            data: {
              status: "DISPATCHED",
              dispatchedAt: new Date(),
            },
          });
          dispatchedCount++;
        } catch (err) {
          console.warn(`[Outbox Dispatch Error] Message ${msg.id}: ${err.message}`);
          await prisma.outboxMessage.update({
            where: { id: msg.id },
            data: {
              retryCount: { increment: 1 },
              error: err.message,
              status: msg.retryCount >= 5 ? "FAILED" : "PENDING",
            },
          });
        }
      }

      return dispatchedCount;
    } finally {
      this._isDispatching = false;
    }
  }

  /**
   * Starts periodic outbox dispatcher loop.
   * @param {number} [intervalMs=5000]
   */
  startDispatcher(intervalMs = 5000) {
    if (this._dispatcherInterval) return;
    this._dispatcherInterval = setInterval(() => {
      this.dispatchPending().catch((err) => {
        console.warn(`[Outbox Background Dispatch Error] ${err.message}`);
      });
    }, intervalMs);
    if (this._dispatcherInterval.unref) {
      this._dispatcherInterval.unref();
    }
  }

  /**
   * Stops periodic outbox dispatcher.
   */
  stopDispatcher() {
    if (this._dispatcherInterval) {
      clearInterval(this._dispatcherInterval);
      this._dispatcherInterval = null;
    }
  }
}

const defaultOutboxService = new OutboxService();

module.exports = {
  OutboxService,
  defaultOutboxService,
};
