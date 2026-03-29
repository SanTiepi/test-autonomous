import { randomUUID } from "node:crypto";

/**
 * Wraps a request handler with correlation-ID logging.
 * Logs start/end of each request with method, url, status, and duration.
 */
export function wrapWithLogging(handler) {
  return async function loggingHandler(req, res) {
    const correlationId = randomUUID();
    res.correlationId = correlationId;

    const start = Date.now();
    console.log(`[${correlationId}] → ${req.method} ${req.url}`);

    // Intercept writeHead to capture the status code
    const originalWriteHead = res.writeHead.bind(res);
    let statusCode = 200;
    res.writeHead = function (code, ...args) {
      statusCode = code;
      return originalWriteHead(code, ...args);
    };

    try {
      await handler(req, res);
    } finally {
      const duration = Date.now() - start;
      console.log(`[${correlationId}] ← ${statusCode} ${duration} ms`);
    }
  };
}
