import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { matchRoute, users, validateUser } from "../src/index.mjs";

describe("matchRoute", () => {
  it("matches static routes", () => {
    const result = matchRoute("GET", "/");
    assert.ok(result);
    assert.equal(result.match, null);
  });

  it("matches GET /health", () => {
    assert.ok(matchRoute("GET", "/health"));
  });

  it("matches POST /users", () => {
    const result = matchRoute("POST", "/users");
    assert.ok(result);
  });

  it("matches GET /users/:id", () => {
    const result = matchRoute("GET", "/users/42");
    assert.ok(result);
    assert.equal(result.match[1], "42");
  });

  it("matches PUT /users/:id", () => {
    const result = matchRoute("PUT", "/users/7");
    assert.ok(result);
    assert.equal(result.match[1], "7");
  });

  it("matches DELETE /users/:id", () => {
    const result = matchRoute("DELETE", "/users/1");
    assert.ok(result);
  });

  it("returns null for unknown routes", () => {
    assert.equal(matchRoute("GET", "/nope"), null);
  });
});

describe("validateUser", () => {
  it("accepts valid user", () => {
    assert.deepEqual(validateUser({ name: "Alice", email: "a@b.com" }), []);
  });

  it("rejects missing name", () => {
    const errors = validateUser({ email: "a@b.com" });
    assert.ok(errors.length > 0);
  });

  it("rejects empty name", () => {
    const errors = validateUser({ name: "", email: "a@b.com" });
    assert.ok(errors.length > 0);
  });

  it("rejects name over 100 chars", () => {
    const errors = validateUser({ name: "x".repeat(101), email: "a@b.com" });
    assert.ok(errors.length > 0);
  });

  it("rejects missing email", () => {
    const errors = validateUser({ name: "Alice" });
    assert.ok(errors.length > 0);
  });

  it("rejects email without @", () => {
    const errors = validateUser({ name: "Alice", email: "nope" });
    assert.ok(errors.length > 0);
  });

  it("rejects both invalid", () => {
    const errors = validateUser({});
    assert.equal(errors.length, 2);
  });
});

describe("CRUD integration", () => {
  beforeEach(() => {
    users.clear();
  });

  it("POST /users creates a user", async () => {
    const result = matchRoute("POST", "/users");
    const body = JSON.stringify({ name: "Alice", email: "a@b.com" });
    const req = createMockReq(body);
    const res = createMockRes();
    await result.handler(req, res, result.match);
    assert.equal(res.statusCode, 201);
    const data = JSON.parse(res.body);
    assert.equal(data.name, "Alice");
    assert.ok(data.id);
  });

  it("GET /users/:id returns the user", async () => {
    users.set("1", { id: "1", name: "Bob", email: "b@c.com" });
    const result = matchRoute("GET", "/users/1");
    const res = createMockRes();
    await result.handler({}, res, result.match);
    assert.equal(res.statusCode, 200);
    assert.equal(JSON.parse(res.body).name, "Bob");
  });

  it("GET /users/:id returns 404 for missing user", async () => {
    const result = matchRoute("GET", "/users/999");
    const res = createMockRes();
    await result.handler({}, res, result.match);
    assert.equal(res.statusCode, 404);
  });

  it("PUT /users/:id updates the user", async () => {
    users.set("1", { id: "1", name: "Old", email: "old@x.com" });
    const result = matchRoute("PUT", "/users/1");
    const body = JSON.stringify({ name: "New", email: "new@x.com" });
    const req = createMockReq(body);
    const res = createMockRes();
    await result.handler(req, res, result.match);
    assert.equal(res.statusCode, 200);
    assert.equal(JSON.parse(res.body).name, "New");
  });

  it("PUT /users/:id returns 404 for missing user", async () => {
    const result = matchRoute("PUT", "/users/999");
    const body = JSON.stringify({ name: "X", email: "x@y.com" });
    const req = createMockReq(body);
    const res = createMockRes();
    await result.handler(req, res, result.match);
    assert.equal(res.statusCode, 404);
  });

  it("DELETE /users/:id deletes the user", async () => {
    users.set("1", { id: "1", name: "Gone", email: "g@x.com" });
    const result = matchRoute("DELETE", "/users/1");
    const res = createMockRes();
    await result.handler({}, res, result.match);
    assert.equal(res.statusCode, 204);
    assert.equal(users.has("1"), false);
  });

  it("DELETE /users/:id returns 404 for missing user", async () => {
    const result = matchRoute("DELETE", "/users/999");
    const res = createMockRes();
    await result.handler({}, res, result.match);
    assert.equal(res.statusCode, 404);
  });

  it("POST /users rejects invalid body", async () => {
    const result = matchRoute("POST", "/users");
    const req = createMockReq(JSON.stringify({}));
    const res = createMockRes();
    await result.handler(req, res, result.match);
    assert.equal(res.statusCode, 400);
  });

  it("POST /users rejects invalid JSON", async () => {
    const result = matchRoute("POST", "/users");
    const req = createMockReq("not json{");
    const res = createMockRes();
    await result.handler(req, res, result.match);
    assert.equal(res.statusCode, 400);
  });
});

// --- Test helpers ---
function createMockReq(bodyStr) {
  return {
    on(event, cb) {
      if (event === "data") process.nextTick(() => cb(Buffer.from(bodyStr)));
      if (event === "end") process.nextTick(() => process.nextTick(() => cb()));
      return this;
    },
  };
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
