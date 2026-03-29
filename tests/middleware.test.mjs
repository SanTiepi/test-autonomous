import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { wrapWithLogging } from "../src/middleware.mjs";
import { handleRequest, users } from "../src/index.mjs";

// UUID v4 pattern
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// --- Test helpers ---
function createMockReq(method, url, bodyStr) {
  return {
    method,
    url,
    on(event, cb) {
      if (bodyStr !== undefined) {
        if (event === "data") process.nextTick(() => cb(Buffer.from(bodyStr)));
        if (event === "end") process.nextTick(() => process.nextTick(() => cb()));
      } else {
        if (event === "end") process.nextTick(() => cb());
      }
      return this;
    },
  };
}

function createMockRes() {
  return {
    statusCode: 0,
    headers: {},
    body: "",
    correlationId: undefined,
    writeHead(code, hdrs) { this.statusCode = code; this.headers = hdrs || {}; },
    end(data) { this.body = data || ""; },
  };
}

/** Capture console.log calls during an async function. */
async function captureLog(fn) {
  const logs = [];
  const orig = console.log;
  console.log = (...args) => logs.push(args.join(" "));
  try {
    await fn();
  } finally {
    console.log = orig;
  }
  return logs;
}

describe("wrapWithLogging", () => {
  const wrapped = wrapWithLogging(handleRequest);

  beforeEach(() => {
    users.clear();
  });

  it("generates a correlation ID in UUID format", async () => {
    const req = createMockReq("GET", "/");
    const res = createMockRes();
    await captureLog(() => wrapped(req, res));
    assert.ok(res.correlationId, "correlationId should be set on res");
    assert.match(res.correlationId, UUID_RE, "correlationId should be a valid UUID v4");
  });

  it("logs method and url at start", async () => {
    const req = createMockReq("GET", "/health");
    const res = createMockRes();
    const logs = await captureLog(() => wrapped(req, res));
    const startLog = logs.find((l) => l.includes("→"));
    assert.ok(startLog, "should have a start log line");
    assert.ok(startLog.includes("GET"), "start log should contain method");
    assert.ok(startLog.includes("/health"), "start log should contain url");
    assert.ok(UUID_RE.test(startLog.match(/\[([^\]]+)\]/)[1]), "start log should contain a UUID");
  });

  it("logs status and duration at end", async () => {
    const req = createMockReq("GET", "/");
    const res = createMockRes();
    const logs = await captureLog(() => wrapped(req, res));
    const endLog = logs.find((l) => l.includes("←"));
    assert.ok(endLog, "should have an end log line");
    assert.ok(endLog.includes("200"), "end log should contain status code");
    assert.match(endLog, /\d+ ms/, "end log should contain duration in ms");
  });

  it("tracks duration as a non-negative number", async () => {
    const req = createMockReq("GET", "/");
    const res = createMockRes();
    const logs = await captureLog(() => wrapped(req, res));
    const endLog = logs.find((l) => l.includes("←"));
    const durationMatch = endLog.match(/(\d+) ms/);
    assert.ok(durationMatch, "should contain duration");
    const duration = Number(durationMatch[1]);
    assert.ok(duration >= 0, "duration should be non-negative");
  });

  it("works with static route GET /", async () => {
    const req = createMockReq("GET", "/");
    const res = createMockRes();
    const logs = await captureLog(() => wrapped(req, res));
    assert.equal(res.statusCode, 200);
    assert.ok(logs.length >= 2, "should have at least start and end logs");
    const body = JSON.parse(res.body);
    assert.equal(body.status, "ok");
  });

  it("works with dynamic route POST /users", async () => {
    const req = createMockReq("POST", "/users", JSON.stringify({ name: "Alice", email: "a@b.com" }));
    const res = createMockRes();
    const logs = await captureLog(() => wrapped(req, res));
    assert.equal(res.statusCode, 201);
    const endLog = logs.find((l) => l.includes("←"));
    assert.ok(endLog.includes("201"), "end log should reflect 201 status");
  });

  it("uses the same correlation ID in start and end logs", async () => {
    const req = createMockReq("GET", "/health");
    const res = createMockRes();
    const logs = await captureLog(() => wrapped(req, res));
    const ids = logs.map((l) => l.match(/\[([^\]]+)\]/)?.[1]).filter(Boolean);
    assert.ok(ids.length >= 2, "should have at least 2 log lines with IDs");
    assert.equal(ids[0], ids[1], "start and end should use the same correlation ID");
    assert.equal(ids[0], res.correlationId, "log ID should match res.correlationId");
  });

  it("logs 404 status for unknown routes", async () => {
    const req = createMockReq("GET", "/unknown");
    const res = createMockRes();
    const logs = await captureLog(() => wrapped(req, res));
    assert.equal(res.statusCode, 404);
    const endLog = logs.find((l) => l.includes("←"));
    assert.ok(endLog.includes("404"), "end log should contain 404 status");
  });
});
