import { randomUUID } from "node:crypto";

/**
 * Creates a rate-limiting middleware wrapper.
 * @param {object} opts
 * @param {number} opts.maxRequests - Max requests per window (default: 100)
 * @param {number} opts.windowMs - Window duration in ms (default: 60000)
 * @returns {function} wrapper(handler) => async (req, res)
 */
export function createRateLimiter({ maxRequests = 100, windowMs = 60000, maxClients = 10000 } = {}) {
  const clients = new Map();

  function getClientIp(req) {
    return req.socket?.remoteAddress || req.headers?.["x-forwarded-for"] || "unknown";
  }

  function cleanup(now) {
    for (const [ip, entry] of clients) {
      if (now >= entry.resetAt) clients.delete(ip);
    }
  }

  function evictOldest() {
    // Map iterates in insertion order — first entry is oldest
    const oldest = clients.keys().next().value;
    if (oldest !== undefined) clients.delete(oldest);
  }

  return function wrapWithRateLimit(handler) {
    return async function rateLimitedHandler(req, res) {
      const now = Date.now();
      const ip = getClientIp(req);

      // Periodic cleanup (every 10th request)
      if (Math.random() < 0.1) cleanup(now);

      let entry = clients.get(ip);
      if (!entry || now >= entry.resetAt) {
        // LRU eviction: cap map size to prevent unbounded growth
        if (!entry && clients.size >= maxClients) evictOldest();
        entry = { count: 0, resetAt: now + windowMs };
        clients.set(ip, entry);
      }

      entry.count++;

      if (entry.count > maxRequests) {
        const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
        res.writeHead(429, {
          "content-type": "application/json",
          "retry-after": String(retryAfter),
        });
        res.end(JSON.stringify({ error: "Too many requests", retryAfter }));
        return;
      }

      await handler(req, res);
    };
  };
}
