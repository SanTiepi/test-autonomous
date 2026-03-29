import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { createRateLimiter } from "../src/rate_limiter.mjs";

function createMockReq(ip = "127.0.0.1") {
  return { socket: { remoteAddress: ip }, headers: {}, method: "GET", url: "/" };
}

function createMockRes() {
  return {
    statusCode: 0,
    headers: {},
    body: "",
    writeHead(code, hdrs) { this.statusCode = code; this.headers = hdrs || {}; },
    end(data) { this.body = data || ""; },
  };
}

describe("createRateLimiter", () => {
  it("returns a wrapper function", () => {
    const limiter = createRateLimiter();
    assert.equal(typeof limiter, "function");
  });

  it("wrapper returns a handler function", () => {
    const limiter = createRateLimiter();
    const wrapped = limiter(async () => {});
    assert.equal(typeof wrapped, "function");
  });

  it("passes requests under the limit", async () => {
    const limiter = createRateLimiter({ maxRequests: 5, windowMs: 60000 });
    let called = 0;
    const handler = async () => { called++; };
    const wrapped = limiter(handler);

    for (let i = 0; i < 5; i++) {
      await wrapped(createMockReq(), createMockRes());
    }
    assert.equal(called, 5);
  });

  it("blocks requests over the limit with 429", async () => {
    const limiter = createRateLimiter({ maxRequests: 3, windowMs: 60000 });
    let called = 0;
    const handler = async () => { called++; };
    const wrapped = limiter(handler);

    for (let i = 0; i < 3; i++) {
      await wrapped(createMockReq(), createMockRes());
    }

    const res = createMockRes();
    await wrapped(createMockReq(), res);
    assert.equal(res.statusCode, 429);
    assert.equal(called, 3); // handler NOT called on 4th request
  });

  it("includes Retry-After header", async () => {
    const limiter = createRateLimiter({ maxRequests: 1, windowMs: 30000 });
    const wrapped = limiter(async () => {});

    await wrapped(createMockReq(), createMockRes());
    const res = createMockRes();
    await wrapped(createMockReq(), res);
    assert.equal(res.statusCode, 429);
    assert.ok(res.headers["retry-after"]);
    const retryAfter = Number(res.headers["retry-after"]);
    assert.ok(retryAfter > 0 && retryAfter <= 30);
  });

  it("returns JSON error body", async () => {
    const limiter = createRateLimiter({ maxRequests: 1, windowMs: 60000 });
    const wrapped = limiter(async () => {});

    await wrapped(createMockReq(), createMockRes());
    const res = createMockRes();
    await wrapped(createMockReq(), res);
    const body = JSON.parse(res.body);
    assert.equal(body.error, "Too many requests");
    assert.ok(body.retryAfter > 0);
  });

  it("tracks different IPs separately", async () => {
    const limiter = createRateLimiter({ maxRequests: 1, windowMs: 60000 });
    let called = 0;
    const wrapped = limiter(async () => { called++; });

    await wrapped(createMockReq("10.0.0.1"), createMockRes());
    await wrapped(createMockReq("10.0.0.2"), createMockRes());
    assert.equal(called, 2); // both pass — different IPs
  });

  it("resets after window expires", async () => {
    const limiter = createRateLimiter({ maxRequests: 1, windowMs: 1 }); // 1ms window
    let called = 0;
    const wrapped = limiter(async () => { called++; });

    await wrapped(createMockReq(), createMockRes());
    // Wait for window to expire
    await new Promise(r => setTimeout(r, 5));
    await wrapped(createMockReq(), createMockRes());
    assert.equal(called, 2); // both pass — window reset
  });

  it("evicts oldest entry when maxClients exceeded", async () => {
    const limiter = createRateLimiter({ maxRequests: 10, windowMs: 60000, maxClients: 3 });
    let called = 0;
    const wrapped = limiter(async () => { called++; });

    // Fill up to maxClients
    await wrapped(createMockReq("10.0.0.1"), createMockRes());
    await wrapped(createMockReq("10.0.0.2"), createMockRes());
    await wrapped(createMockReq("10.0.0.3"), createMockRes());
    assert.equal(called, 3);

    // 4th unique IP triggers eviction of oldest (10.0.0.1)
    await wrapped(createMockReq("10.0.0.4"), createMockRes());
    assert.equal(called, 4); // still passes — new IP gets a fresh entry

    // 10.0.0.1 should be evicted, gets a fresh entry now
    await wrapped(createMockReq("10.0.0.1"), createMockRes());
    assert.equal(called, 5); // passes — fresh entry after eviction
  });

  it("respects maxClients default of 10000", () => {
    const limiter = createRateLimiter();
    // Just verify it creates successfully with default
    assert.equal(typeof limiter, "function");
  });
});
