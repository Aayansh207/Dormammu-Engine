/**
 * Webster Execution Engine - Server-Sent Events (SSE) Execution Broadcaster
 * Streams real-time node transitions and workflow lifecycle events to connected clients.
 */

class SseService {
  constructor() {
    this._clients = new Map(); // runId -> Set<Response>
  }

  /**
   * Registers an Express HTTP response as an active SSE subscriber for a workflow run.
   * @param {string} runId
   * @param {import('express').Response} res
   */
  subscribe(runId, res) {
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
   * Broadcasts an event to all subscribers listening to runId.
   * @param {string} runId
   * @param {string} event
   * @param {Object} data
   */
  emitRunEvent(runId, event, data) {
    const clients = this._clients.get(runId);
    if (!clients || clients.size === 0) return;

    for (const res of clients) {
      this.sendRaw(res, event, data);
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
