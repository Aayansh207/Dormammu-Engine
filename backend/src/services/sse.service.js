const { CHANNELS } = require("../queue/queue.constants");

class SseService {
  constructor() {
    this._clients = new Map(); // runId -> Set<Response>
    this._isRedisSubscribed = false;
  }

  /**
   * Initializes Redis subscriber for cross-process event broadcasting.
   */
  initRedisSubscriber() {
    if (this._isRedisSubscribed) return;
    try {
      const { getSharedSubscriberClient } = require("../queue/redis.connection");
      const subscriber = getSharedSubscriberClient();

      subscriber.subscribe(CHANNELS.SSE_EVENTS, (err) => {
        if (err) {
          console.warn("[SseService] Redis subscription warning:", err.message);
        } else {
          this._isRedisSubscribed = true;
        }
      });

      subscriber.on("message", (channel, message) => {
        if (channel === CHANNELS.SSE_EVENTS) {
          try {
            const parsed = JSON.parse(message);
            if (parsed && parsed.runId && parsed.event) {
              this._broadcastLocal(parsed.runId, parsed.event, parsed.data);
            }
          } catch (e) {
            // Ignore parse error
          }
        }
      });
    } catch (e) {
      // Redis might not be initialized yet
    }
  }

  /**
   * Registers an Express HTTP response as an active SSE subscriber for a workflow run.
   * @param {string} runId
   * @param {import('express').Response} res
   */
  subscribe(runId, res) {
    this.initRedisSubscriber();

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders?.();

    if (!this._clients.has(runId)) {
      this._clients.set(runId, new Set());
    }
    const set = this._clients.get(runId);
    set.add(res);

    // Initial ping
    this.sendRaw(res, "connected", { runId, timestamp: new Date().toISOString() });

    res.on("close", () => {
      set.delete(res);
      if (set.size === 0) {
        this._clients.delete(runId);
      }
    });
  }

  /**
   * Formats and writes an event to a single subscriber.
   * @param {import('express').Response} res
   * @param {string} event
   * @param {Object} data
   */
  sendRaw(res, event, data) {
    try {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    } catch (err) {
      // Ignored if client already closed
    }
  }

  /**
   * Internal helper to broadcast to local connected responses in this process.
   * @private
   */
  _broadcastLocal(runId, event, data) {
    const clients = this._clients.get(runId);
    if (!clients || clients.size === 0) return;

    for (const res of clients) {
      this.sendRaw(res, event, data);
    }
  }

  /**
   * Broadcasts an event to all subscribers listening to runId.
   * Also publishes to Redis Pub/Sub for other worker/API processes.
   * @param {string} runId
   * @param {string} event
   * @param {Object} data
   */
  emitRunEvent(runId, event, data) {
    // 1. Broadcast to local clients in current process
    this._broadcastLocal(runId, event, data);

    // 2. Publish to Redis Pub/Sub for other processes
    try {
      const { getSharedRedisClient } = require("../queue/redis.connection");
      const publisher = getSharedRedisClient();
      if (publisher && publisher.status === "ready") {
        publisher.publish(
          CHANNELS.SSE_EVENTS,
          JSON.stringify({ runId, event, data })
        ).catch(() => {});
      }
    } catch (e) {
      // Non-fatal if Redis is not configured or in unit test environment
    }
  }

  /**
   * Returns active subscriber count for a runId.
   */
  getSubscriberCount(runId) {
    return this._clients.get(runId)?.size || 0;
  }
}

const defaultSseService = new SseService();

module.exports = {
  SseService,
  defaultSseService,
};

