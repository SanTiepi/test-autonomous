import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { matchRoute, todos, validateTodo } from "../src/index.mjs";

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

describe("validateTodo", () => {
  it("accepts valid todo", () => {
    assert.deepEqual(validateTodo({ title: "Buy milk" }), []);
  });

  it("rejects missing title", () => {
    assert.ok(validateTodo({}).length > 0);
  });

  it("rejects empty title", () => {
    assert.ok(validateTodo({ title: "" }).length > 0);
  });

  it("rejects whitespace-only title", () => {
    assert.ok(validateTodo({ title: "   " }).length > 0);
  });

  it("rejects title over 200 chars", () => {
    assert.ok(validateTodo({ title: "x".repeat(201) }).length > 0);
  });
});

describe("Todo CRUD", () => {
  beforeEach(() => {
    todos.clear();
  });

  it("POST /todos creates a todo", async () => {
    const result = matchRoute("POST", "/todos");
    assert.ok(result);
    const req = createMockReq(JSON.stringify({ title: "Buy milk" }));
    const res = createMockRes();
    await result.handler(req, res, result.match);
    assert.equal(res.statusCode, 201);
    const data = JSON.parse(res.body);
    assert.equal(data.title, "Buy milk");
    assert.equal(data.completed, false);
    assert.ok(data.id);
  });

  it("POST /todos rejects invalid body", async () => {
    const result = matchRoute("POST", "/todos");
    const req = createMockReq(JSON.stringify({}));
    const res = createMockRes();
    await result.handler(req, res, result.match);
    assert.equal(res.statusCode, 400);
  });

  it("POST /todos rejects empty title", async () => {
    const result = matchRoute("POST", "/todos");
    const req = createMockReq(JSON.stringify({ title: "" }));
    const res = createMockRes();
    await result.handler(req, res, result.match);
    assert.equal(res.statusCode, 400);
  });

  it("POST /todos rejects whitespace-only title", async () => {
    const result = matchRoute("POST", "/todos");
    const req = createMockReq(JSON.stringify({ title: "   " }));
    const res = createMockRes();
    await result.handler(req, res, result.match);
    assert.equal(res.statusCode, 400);
  });

  it("POST /todos rejects invalid JSON", async () => {
    const result = matchRoute("POST", "/todos");
    const req = createMockReq("not json{");
    const res = createMockRes();
    await result.handler(req, res, result.match);
    assert.equal(res.statusCode, 400);
  });

  it("GET /todos lists all todos", async () => {
    todos.set("1", { id: "1", title: "A", completed: false });
    todos.set("2", { id: "2", title: "B", completed: true });
    const result = matchRoute("GET", "/todos");
    assert.ok(result);
    const res = createMockRes();
    await result.handler({}, res, result.match);
    assert.equal(res.statusCode, 200);
    const data = JSON.parse(res.body);
    assert.equal(data.length, 2);
  });

  it("GET /todos returns empty array when none exist", async () => {
    const result = matchRoute("GET", "/todos");
    const res = createMockRes();
    await result.handler({}, res, result.match);
    assert.equal(res.statusCode, 200);
    assert.deepEqual(JSON.parse(res.body), []);
  });

  it("GET /todos/:id returns a todo", async () => {
    todos.set("1", { id: "1", title: "Test", completed: false });
    const result = matchRoute("GET", "/todos/1");
    assert.ok(result);
    const res = createMockRes();
    await result.handler({}, res, result.match);
    assert.equal(res.statusCode, 200);
    assert.equal(JSON.parse(res.body).title, "Test");
  });

  it("GET /todos/:id returns 404 for missing todo", async () => {
    const result = matchRoute("GET", "/todos/999");
    const res = createMockRes();
    await result.handler({}, res, result.match);
    assert.equal(res.statusCode, 404);
  });

  it("PUT /todos/:id updates title", async () => {
    todos.set("1", { id: "1", title: "Old", completed: false });
    const result = matchRoute("PUT", "/todos/1");
    assert.ok(result);
    const req = createMockReq(JSON.stringify({ title: "New" }));
    const res = createMockRes();
    await result.handler(req, res, result.match);
    assert.equal(res.statusCode, 200);
    assert.equal(JSON.parse(res.body).title, "New");
  });

  it("PUT /todos/:id updates completed", async () => {
    todos.set("1", { id: "1", title: "Task", completed: false });
    const result = matchRoute("PUT", "/todos/1");
    const req = createMockReq(JSON.stringify({ completed: true }));
    const res = createMockRes();
    await result.handler(req, res, result.match);
    assert.equal(res.statusCode, 200);
    assert.equal(JSON.parse(res.body).completed, true);
  });

  it("PUT /todos/:id returns 404 for missing todo", async () => {
    const result = matchRoute("PUT", "/todos/999");
    const req = createMockReq(JSON.stringify({ title: "X" }));
    const res = createMockRes();
    await result.handler(req, res, result.match);
    assert.equal(res.statusCode, 404);
  });

  it("PUT /todos/:id rejects invalid title", async () => {
    todos.set("1", { id: "1", title: "Task", completed: false });
    const result = matchRoute("PUT", "/todos/1");
    const req = createMockReq(JSON.stringify({ title: "" }));
    const res = createMockRes();
    await result.handler(req, res, result.match);
    assert.equal(res.statusCode, 400);
  });

  it("PUT /todos/:id rejects whitespace-only title", async () => {
    todos.set("1", { id: "1", title: "Task", completed: false });
    const result = matchRoute("PUT", "/todos/1");
    const req = createMockReq(JSON.stringify({ title: "   " }));
    const res = createMockRes();
    await result.handler(req, res, result.match);
    assert.equal(res.statusCode, 400);
  });

  it("PUT /todos/:id rejects non-boolean completed", async () => {
    todos.set("1", { id: "1", title: "Task", completed: false });
    const result = matchRoute("PUT", "/todos/1");
    const req = createMockReq(JSON.stringify({ completed: "yes" }));
    const res = createMockRes();
    await result.handler(req, res, result.match);
    assert.equal(res.statusCode, 400);
  });

  // --- PATCH /todos/:id ---

  it("PATCH /todos/:id updates only title, preserves completed", async () => {
    todos.set("1", { id: "1", title: "Old", completed: true });
    const result = matchRoute("PATCH", "/todos/1");
    assert.ok(result);
    const req = createMockReq(JSON.stringify({ title: "New" }));
    const res = createMockRes();
    await result.handler(req, res, result.match);
    assert.equal(res.statusCode, 200);
    const data = JSON.parse(res.body);
    assert.equal(data.title, "New");
    assert.equal(data.completed, true);
  });

  it("PATCH /todos/:id updates only completed, preserves title", async () => {
    todos.set("1", { id: "1", title: "Keep", completed: false });
    const result = matchRoute("PATCH", "/todos/1");
    const req = createMockReq(JSON.stringify({ completed: true }));
    const res = createMockRes();
    await result.handler(req, res, result.match);
    assert.equal(res.statusCode, 200);
    const data = JSON.parse(res.body);
    assert.equal(data.title, "Keep");
    assert.equal(data.completed, true);
  });

  it("PATCH /todos/:id with empty body returns todo unchanged", async () => {
    todos.set("1", { id: "1", title: "Same", completed: false });
    const result = matchRoute("PATCH", "/todos/1");
    const req = createMockReq(JSON.stringify({}));
    const res = createMockRes();
    await result.handler(req, res, result.match);
    assert.equal(res.statusCode, 200);
    const data = JSON.parse(res.body);
    assert.equal(data.title, "Same");
    assert.equal(data.completed, false);
  });

  it("PATCH /todos/:id returns 404 for non-existent todo", async () => {
    const result = matchRoute("PATCH", "/todos/999");
    assert.ok(result);
    const req = createMockReq(JSON.stringify({ title: "X" }));
    const res = createMockRes();
    await result.handler(req, res, result.match);
    assert.equal(res.statusCode, 404);
  });

  it("PATCH /todos with missing id returns 404 (no route match)", async () => {
    const result = matchRoute("PATCH", "/todos");
    assert.equal(result, null);
  });

  it("PATCH /todos/:id rejects invalid title", async () => {
    todos.set("1", { id: "1", title: "Task", completed: false });
    const result = matchRoute("PATCH", "/todos/1");
    const req = createMockReq(JSON.stringify({ title: "" }));
    const res = createMockRes();
    await result.handler(req, res, result.match);
    assert.equal(res.statusCode, 400);
  });

  it("PATCH /todos/:id rejects unknown fields", async () => {
    todos.set("1", { id: "1", title: "Task", completed: false });
    const result = matchRoute("PATCH", "/todos/1");
    const req = createMockReq(JSON.stringify({ title: "New", priority: 5 }));
    const res = createMockRes();
    await result.handler(req, res, result.match);
    assert.equal(res.statusCode, 400);
    const data = JSON.parse(res.body);
    assert.equal(data.error, "Validation failed");
    assert.ok(data.details[0].includes("priority"));
  });

  it("PATCH /todos/:id rejects non-boolean completed", async () => {
    todos.set("1", { id: "1", title: "Task", completed: false });
    const result = matchRoute("PATCH", "/todos/1");
    const req = createMockReq(JSON.stringify({ completed: "yes" }));
    const res = createMockRes();
    await result.handler(req, res, result.match);
    assert.equal(res.statusCode, 400);
  });

  it("DELETE /todos/:id deletes a todo", async () => {
    todos.set("1", { id: "1", title: "Gone", completed: false });
    const result = matchRoute("DELETE", "/todos/1");
    assert.ok(result);
    const res = createMockRes();
    await result.handler({}, res, result.match);
    assert.equal(res.statusCode, 204);
    assert.equal(todos.has("1"), false);
  });

  it("DELETE /todos/:id returns 404 for missing todo", async () => {
    const result = matchRoute("DELETE", "/todos/999");
    const res = createMockRes();
    await result.handler({}, res, result.match);
    assert.equal(res.statusCode, 404);
  });
});
