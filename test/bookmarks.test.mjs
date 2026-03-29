import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { matchRoute, bookmarks } from "../src/index.mjs";

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

describe("POST /bookmarks", () => {
  beforeEach(() => {
    bookmarks.clear();
  });

  it("creates a bookmark and returns 201", async () => {
    const result = matchRoute("POST", "/bookmarks");
    assert.ok(result);
    const req = createMockReq(JSON.stringify({ url: "https://example.com", title: "Example", tags: ["test"] }));
    const res = createMockRes();
    await result.handler(req, res, result.match);
    assert.equal(res.statusCode, 201);
    const data = JSON.parse(res.body);
    assert.ok(data.id);
    assert.equal(data.url, "https://example.com");
    assert.equal(data.title, "Example");
    assert.deepEqual(data.tags, ["test"]);
    assert.ok(data.created_at);
  });

  it("creates a bookmark with empty tags when tags omitted", async () => {
    const result = matchRoute("POST", "/bookmarks");
    const req = createMockReq(JSON.stringify({ url: "https://a.com", title: "A" }));
    const res = createMockRes();
    await result.handler(req, res, result.match);
    assert.equal(res.statusCode, 201);
    const data = JSON.parse(res.body);
    assert.deepEqual(data.tags, []);
  });

  it("returns 400 for invalid JSON", async () => {
    const result = matchRoute("POST", "/bookmarks");
    const req = createMockReq("not json{");
    const res = createMockRes();
    await result.handler(req, res, result.match);
    assert.equal(res.statusCode, 400);
    const data = JSON.parse(res.body);
    assert.equal(data.error, "Invalid JSON");
  });

  it("returns 400 when url is missing", async () => {
    const result = matchRoute("POST", "/bookmarks");
    const req = createMockReq(JSON.stringify({ title: "No URL" }));
    const res = createMockRes();
    await result.handler(req, res, result.match);
    assert.equal(res.statusCode, 400);
    const data = JSON.parse(res.body);
    assert.equal(data.error, "Validation failed");
    assert.ok(data.details.some((d) => d.includes("url")));
  });

  it("returns 400 when title is missing", async () => {
    const result = matchRoute("POST", "/bookmarks");
    const req = createMockReq(JSON.stringify({ url: "https://x.com" }));
    const res = createMockRes();
    await result.handler(req, res, result.match);
    assert.equal(res.statusCode, 400);
    const data = JSON.parse(res.body);
    assert.equal(data.error, "Validation failed");
    assert.ok(data.details.some((d) => d.includes("title")));
  });

  it("returns 400 when both url and title are missing", async () => {
    const result = matchRoute("POST", "/bookmarks");
    const req = createMockReq(JSON.stringify({}));
    const res = createMockRes();
    await result.handler(req, res, result.match);
    assert.equal(res.statusCode, 400);
    const data = JSON.parse(res.body);
    assert.equal(data.details.length, 2);
  });

  it("returns 400 when tags is not an array", async () => {
    const result = matchRoute("POST", "/bookmarks");
    const req = createMockReq(JSON.stringify({ url: "https://x.com", title: "X", tags: "bad" }));
    const res = createMockRes();
    await result.handler(req, res, result.match);
    assert.equal(res.statusCode, 400);
    const data = JSON.parse(res.body);
    assert.ok(data.details.some((d) => d.includes("tags")));
  });

  it("returns 400 when tags contains non-strings", async () => {
    const result = matchRoute("POST", "/bookmarks");
    const req = createMockReq(JSON.stringify({ url: "https://x.com", title: "X", tags: [1, 2] }));
    const res = createMockRes();
    await result.handler(req, res, result.match);
    assert.equal(res.statusCode, 400);
    const data = JSON.parse(res.body);
    assert.ok(data.details.some((d) => d.includes("tags")));
  });
});

describe("GET /bookmarks/:id", () => {
  beforeEach(() => {
    bookmarks.clear();
  });

  it("returns a previously created bookmark", async () => {
    // Create one first
    const postRoute = matchRoute("POST", "/bookmarks");
    const req = createMockReq(JSON.stringify({ url: "https://example.com", title: "Ex", tags: ["a"] }));
    const postRes = createMockRes();
    await postRoute.handler(req, postRes, postRoute.match);
    const created = JSON.parse(postRes.body);

    // Now fetch it
    const getRoute = matchRoute("GET", `/bookmarks/${created.id}`);
    assert.ok(getRoute);
    const getRes = createMockRes();
    await getRoute.handler({}, getRes, getRoute.match);
    assert.equal(getRes.statusCode, 200);
    const data = JSON.parse(getRes.body);
    assert.equal(data.id, created.id);
    assert.equal(data.url, "https://example.com");
    assert.equal(data.title, "Ex");
    assert.deepEqual(data.tags, ["a"]);
    assert.ok(data.created_at);
  });

  it("returns 404 for non-existent bookmark", async () => {
    const result = matchRoute("GET", "/bookmarks/999");
    assert.ok(result);
    const res = createMockRes();
    await result.handler({}, res, result.match);
    assert.equal(res.statusCode, 404);
    assert.equal(JSON.parse(res.body).error, "Bookmark not found");
  });
});

describe("GET /bookmarks", () => {
  beforeEach(() => {
    bookmarks.clear();
  });

  it("returns empty array when no bookmarks exist", async () => {
    const result = matchRoute("GET", "/bookmarks");
    assert.ok(result);
    const res = createMockRes();
    await result.handler({}, res, result.match);
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.deepEqual(body.data, []);
    assert.equal(body.total, 0);
    assert.equal(body.page, 1);
    assert.equal(body.limit, 20);
  });

  it("returns all bookmarks with pagination envelope", async () => {
    // Create two bookmarks
    const postRoute = matchRoute("POST", "/bookmarks");
    const req1 = createMockReq(JSON.stringify({ url: "https://a.com", title: "A" }));
    const res1 = createMockRes();
    await postRoute.handler(req1, res1, postRoute.match);
    const req2 = createMockReq(JSON.stringify({ url: "https://b.com", title: "B", tags: ["x"] }));
    const res2 = createMockRes();
    await postRoute.handler(req2, res2, postRoute.match);

    // List all
    const listRoute = matchRoute("GET", "/bookmarks");
    const listRes = createMockRes();
    await listRoute.handler({}, listRes, listRoute.match);
    assert.equal(listRes.statusCode, 200);
    const body = JSON.parse(listRes.body);
    const data = body.data;
    assert.equal(data.length, 2);
    assert.equal(data[0].url, "https://a.com");
    assert.equal(data[1].url, "https://b.com");
  });
});

describe("GET /bookmarks?tag=X", () => {
  beforeEach(() => {
    bookmarks.clear();
  });

  it("returns only bookmarks matching the tag", async () => {
    const postRoute = matchRoute("POST", "/bookmarks");
    const req1 = createMockReq(JSON.stringify({ url: "https://a.com", title: "A", tags: ["js", "node"] }));
    const res1 = createMockRes();
    await postRoute.handler(req1, res1, postRoute.match);

    const req2 = createMockReq(JSON.stringify({ url: "https://b.com", title: "B", tags: ["python"] }));
    const res2 = createMockRes();
    await postRoute.handler(req2, res2, postRoute.match);

    const req3 = createMockReq(JSON.stringify({ url: "https://c.com", title: "C", tags: ["js", "react"] }));
    const res3 = createMockRes();
    await postRoute.handler(req3, res3, postRoute.match);

    const result = matchRoute("GET", "/bookmarks?tag=js");
    assert.ok(result);
    const res = createMockRes();
    await result.handler({}, res, result.match);
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.equal(body.data.length, 2);
    assert.equal(body.data[0].url, "https://a.com");
    assert.equal(body.data[1].url, "https://c.com");
  });

  it("matches tags case-insensitively", async () => {
    const postRoute = matchRoute("POST", "/bookmarks");
    const req1 = createMockReq(JSON.stringify({ url: "https://a.com", title: "A", tags: ["JavaScript", "Node"] }));
    const res1 = createMockRes();
    await postRoute.handler(req1, res1, postRoute.match);

    const req2 = createMockReq(JSON.stringify({ url: "https://b.com", title: "B", tags: ["python"] }));
    const res2 = createMockRes();
    await postRoute.handler(req2, res2, postRoute.match);

    // Query with lowercase should match "JavaScript"
    const result = matchRoute("GET", "/bookmarks?tag=javascript");
    assert.ok(result);
    const res = createMockRes();
    await result.handler({}, res, result.match);
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.equal(body.data.length, 1);
    assert.equal(body.data[0].url, "https://a.com");
    // Stored tags must preserve original casing
    assert.deepEqual(body.data[0].tags, ["JavaScript", "Node"]);
  });

  it("matches tags case-insensitively with uppercase query", async () => {
    const postRoute = matchRoute("POST", "/bookmarks");
    const req1 = createMockReq(JSON.stringify({ url: "https://a.com", title: "A", tags: ["react"] }));
    const res1 = createMockRes();
    await postRoute.handler(req1, res1, postRoute.match);

    const result = matchRoute("GET", "/bookmarks?tag=REACT");
    assert.ok(result);
    const res = createMockRes();
    await result.handler({}, res, result.match);
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.equal(body.data.length, 1);
    assert.equal(body.data[0].url, "https://a.com");
    assert.deepEqual(body.data[0].tags, ["react"]);
  });

  it("exact-case query still returns same results as before", async () => {
    const postRoute = matchRoute("POST", "/bookmarks");
    const req1 = createMockReq(JSON.stringify({ url: "https://a.com", title: "A", tags: ["js", "node"] }));
    const res1 = createMockRes();
    await postRoute.handler(req1, res1, postRoute.match);

    const result = matchRoute("GET", "/bookmarks?tag=js");
    assert.ok(result);
    const res = createMockRes();
    await result.handler({}, res, result.match);
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.equal(body.data.length, 1);
    assert.equal(body.data[0].url, "https://a.com");
  });

  it("returns empty when no bookmarks match the tag", async () => {
    const postRoute = matchRoute("POST", "/bookmarks");
    const req1 = createMockReq(JSON.stringify({ url: "https://a.com", title: "A", tags: ["js"] }));
    const res1 = createMockRes();
    await postRoute.handler(req1, res1, postRoute.match);

    const result = matchRoute("GET", "/bookmarks?tag=nonexistent");
    assert.ok(result);
    const res = createMockRes();
    await result.handler({}, res, result.match);
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.equal(body.data.length, 0);
    assert.equal(body.total, 0);
  });
});

describe("PUT /bookmarks/:id", () => {
  beforeEach(() => {
    bookmarks.clear();
  });

  it("updates an existing bookmark and returns 200", async () => {
    // Create one first
    const postRoute = matchRoute("POST", "/bookmarks");
    const req = createMockReq(JSON.stringify({ url: "https://old.com", title: "Old", tags: ["old"] }));
    const postRes = createMockRes();
    await postRoute.handler(req, postRes, postRoute.match);
    const created = JSON.parse(postRes.body);

    // Update it
    const putRoute = matchRoute("PUT", `/bookmarks/${created.id}`);
    assert.ok(putRoute);
    const putReq = createMockReq(JSON.stringify({ url: "https://new.com", title: "New", tags: ["new", "updated"] }));
    const putRes = createMockRes();
    await putRoute.handler(putReq, putRes, putRoute.match);
    assert.equal(putRes.statusCode, 200);
    const data = JSON.parse(putRes.body);
    assert.equal(data.id, created.id);
    assert.equal(data.url, "https://new.com");
    assert.equal(data.title, "New");
    assert.deepEqual(data.tags, ["new", "updated"]);
    assert.equal(data.created_at, created.created_at);
  });

  it("returns 404 when bookmark does not exist", async () => {
    const result = matchRoute("PUT", "/bookmarks/999");
    assert.ok(result);
    const req = createMockReq(JSON.stringify({ url: "https://x.com", title: "X" }));
    const res = createMockRes();
    await result.handler(req, res, result.match);
    assert.equal(res.statusCode, 404);
    assert.equal(JSON.parse(res.body).error, "Bookmark not found");
  });

  it("returns 400 for invalid JSON", async () => {
    // Create one first
    const postRoute = matchRoute("POST", "/bookmarks");
    const req = createMockReq(JSON.stringify({ url: "https://a.com", title: "A" }));
    const postRes = createMockRes();
    await postRoute.handler(req, postRes, postRoute.match);
    const created = JSON.parse(postRes.body);

    const putRoute = matchRoute("PUT", `/bookmarks/${created.id}`);
    const putReq = createMockReq("not json{");
    const putRes = createMockRes();
    await putRoute.handler(putReq, putRes, putRoute.match);
    assert.equal(putRes.statusCode, 400);
    assert.equal(JSON.parse(putRes.body).error, "Invalid JSON");
  });

  it("returns 400 for validation failure", async () => {
    // Create one first
    const postRoute = matchRoute("POST", "/bookmarks");
    const req = createMockReq(JSON.stringify({ url: "https://a.com", title: "A" }));
    const postRes = createMockRes();
    await postRoute.handler(req, postRes, postRoute.match);
    const created = JSON.parse(postRes.body);

    const putRoute = matchRoute("PUT", `/bookmarks/${created.id}`);
    const putReq = createMockReq(JSON.stringify({ url: "", title: "" }));
    const putRes = createMockRes();
    await putRoute.handler(putReq, putRes, putRoute.match);
    assert.equal(putRes.statusCode, 400);
    const data = JSON.parse(putRes.body);
    assert.equal(data.error, "Validation failed");
    assert.ok(data.details.length >= 2);
  });
});

describe("DELETE /bookmarks/:id", () => {
  beforeEach(() => {
    bookmarks.clear();
  });

  it("deletes an existing bookmark and returns 204", async () => {
    // Create one first
    const postRoute = matchRoute("POST", "/bookmarks");
    const req = createMockReq(JSON.stringify({ url: "https://del.com", title: "Del" }));
    const postRes = createMockRes();
    await postRoute.handler(req, postRes, postRoute.match);
    const created = JSON.parse(postRes.body);

    // Delete it
    const delRoute = matchRoute("DELETE", `/bookmarks/${created.id}`);
    assert.ok(delRoute);
    const delRes = createMockRes();
    await delRoute.handler({}, delRes, delRoute.match);
    assert.equal(delRes.statusCode, 204);

    // Verify it's gone
    const getRoute = matchRoute("GET", `/bookmarks/${created.id}`);
    const getRes = createMockRes();
    await getRoute.handler({}, getRes, getRoute.match);
    assert.equal(getRes.statusCode, 404);
  });

  it("returns 404 when bookmark does not exist", async () => {
    const result = matchRoute("DELETE", "/bookmarks/999");
    assert.ok(result);
    const res = createMockRes();
    await result.handler({}, res, result.match);
    assert.equal(res.statusCode, 404);
    assert.equal(JSON.parse(res.body).error, "Bookmark not found");
  });
});

describe("POST /bookmarks/import", () => {
  beforeEach(() => {
    bookmarks.clear();
  });

  it("bulk imports valid bookmarks and returns 201", async () => {
    const result = matchRoute("POST", "/bookmarks/import");
    assert.ok(result);
    const payload = [
      { url: "https://a.com", title: "A", tags: ["js"] },
      { url: "https://b.com", title: "B", tags: ["py"] },
      { url: "https://c.com", title: "C" },
    ];
    const req = createMockReq(JSON.stringify(payload));
    const res = createMockRes();
    await result.handler(req, res, result.match);
    assert.equal(res.statusCode, 201);
    const data = JSON.parse(res.body);
    assert.equal(data.length, 3);
    assert.ok(data[0].id);
    assert.equal(data[0].url, "https://a.com");
    assert.deepEqual(data[0].tags, ["js"]);
    assert.ok(data[0].created_at);
    assert.equal(data[1].url, "https://b.com");
    assert.deepEqual(data[2].tags, []);
    // Verify persisted in store
    assert.equal(bookmarks.size, 3);
  });

  it("returns 400 when payload is not an array", async () => {
    const result = matchRoute("POST", "/bookmarks/import");
    const req = createMockReq(JSON.stringify({ url: "https://a.com", title: "A" }));
    const res = createMockRes();
    await result.handler(req, res, result.match);
    assert.equal(res.statusCode, 400);
    const data = JSON.parse(res.body);
    assert.equal(data.error, "Body must be a JSON array");
  });

  it("returns 400 when any entry is invalid", async () => {
    const result = matchRoute("POST", "/bookmarks/import");
    const payload = [
      { url: "https://ok.com", title: "OK" },
      { url: "", title: "" },
    ];
    const req = createMockReq(JSON.stringify(payload));
    const res = createMockRes();
    await result.handler(req, res, result.match);
    assert.equal(res.statusCode, 400);
    const data = JSON.parse(res.body);
    assert.equal(data.error, "Validation failed");
    assert.equal(data.details.length, 1);
    assert.equal(data.details[0].index, 1);
    // No bookmarks should be created on failure
    assert.equal(bookmarks.size, 0);
  });

  it("returns 400 for invalid JSON body", async () => {
    const result = matchRoute("POST", "/bookmarks/import");
    const req = createMockReq("not json[");
    const res = createMockRes();
    await result.handler(req, res, result.match);
    assert.equal(res.statusCode, 400);
    assert.equal(JSON.parse(res.body).error, "Invalid JSON");
  });
});

describe("Bookmark error response contract (error + details)", () => {
  beforeEach(() => {
    bookmarks.clear();
  });

  it("POST /bookmarks invalid JSON includes error and details array", async () => {
    const result = matchRoute("POST", "/bookmarks");
    const req = createMockReq("not json{");
    const res = createMockRes();
    await result.handler(req, res, result.match);
    const data = JSON.parse(res.body);
    assert.equal(typeof data.error, "string");
    assert.ok(Array.isArray(data.details), "details must be an array");
  });

  it("POST /bookmarks validation failure includes error and details array", async () => {
    const result = matchRoute("POST", "/bookmarks");
    const req = createMockReq(JSON.stringify({ url: "", title: "" }));
    const res = createMockRes();
    await result.handler(req, res, result.match);
    const data = JSON.parse(res.body);
    assert.equal(typeof data.error, "string");
    assert.ok(Array.isArray(data.details), "details must be an array");
    assert.ok(data.details.length > 0);
  });

  it("GET /bookmarks/:id not found includes error and details array", async () => {
    const result = matchRoute("GET", "/bookmarks/999");
    const res = createMockRes();
    await result.handler({}, res, result.match);
    const data = JSON.parse(res.body);
    assert.equal(typeof data.error, "string");
    assert.ok(Array.isArray(data.details), "details must be an array");
  });

  it("PUT /bookmarks/:id not found includes error and details array", async () => {
    const result = matchRoute("PUT", "/bookmarks/999");
    const req = createMockReq(JSON.stringify({ url: "https://x.com", title: "X" }));
    const res = createMockRes();
    await result.handler(req, res, result.match);
    const data = JSON.parse(res.body);
    assert.equal(typeof data.error, "string");
    assert.ok(Array.isArray(data.details), "details must be an array");
  });

  it("PUT /bookmarks/:id invalid JSON includes error and details array", async () => {
    const postRoute = matchRoute("POST", "/bookmarks");
    const createReq = createMockReq(JSON.stringify({ url: "https://a.com", title: "A" }));
    const createRes = createMockRes();
    await postRoute.handler(createReq, createRes, postRoute.match);
    const created = JSON.parse(createRes.body);

    const putRoute = matchRoute("PUT", `/bookmarks/${created.id}`);
    const putReq = createMockReq("bad json");
    const putRes = createMockRes();
    await putRoute.handler(putReq, putRes, putRoute.match);
    const data = JSON.parse(putRes.body);
    assert.equal(typeof data.error, "string");
    assert.ok(Array.isArray(data.details), "details must be an array");
  });

  it("PUT /bookmarks/:id validation failure includes error and details array", async () => {
    const postRoute = matchRoute("POST", "/bookmarks");
    const createReq = createMockReq(JSON.stringify({ url: "https://a.com", title: "A" }));
    const createRes = createMockRes();
    await postRoute.handler(createReq, createRes, postRoute.match);
    const created = JSON.parse(createRes.body);

    const putRoute = matchRoute("PUT", `/bookmarks/${created.id}`);
    const putReq = createMockReq(JSON.stringify({ url: "", title: "" }));
    const putRes = createMockRes();
    await putRoute.handler(putReq, putRes, putRoute.match);
    const data = JSON.parse(putRes.body);
    assert.equal(typeof data.error, "string");
    assert.ok(Array.isArray(data.details), "details must be an array");
    assert.ok(data.details.length > 0);
  });

  it("DELETE /bookmarks/:id not found includes error and details array", async () => {
    const result = matchRoute("DELETE", "/bookmarks/999");
    const res = createMockRes();
    await result.handler({}, res, result.match);
    const data = JSON.parse(res.body);
    assert.equal(typeof data.error, "string");
    assert.ok(Array.isArray(data.details), "details must be an array");
  });

  it("POST /bookmarks/import invalid JSON includes error and details array", async () => {
    const result = matchRoute("POST", "/bookmarks/import");
    const req = createMockReq("bad json[");
    const res = createMockRes();
    await result.handler(req, res, result.match);
    const data = JSON.parse(res.body);
    assert.equal(typeof data.error, "string");
    assert.ok(Array.isArray(data.details), "details must be an array");
  });

  it("POST /bookmarks/import non-array body includes error and details array", async () => {
    const result = matchRoute("POST", "/bookmarks/import");
    const req = createMockReq(JSON.stringify({ url: "https://a.com", title: "A" }));
    const res = createMockRes();
    await result.handler(req, res, result.match);
    const data = JSON.parse(res.body);
    assert.equal(typeof data.error, "string");
    assert.ok(Array.isArray(data.details), "details must be an array");
  });

  it("POST /bookmarks/import validation failure includes error and details array", async () => {
    const result = matchRoute("POST", "/bookmarks/import");
    const req = createMockReq(JSON.stringify([{ url: "", title: "" }]));
    const res = createMockRes();
    await result.handler(req, res, result.match);
    const data = JSON.parse(res.body);
    assert.equal(typeof data.error, "string");
    assert.ok(Array.isArray(data.details), "details must be an array");
    assert.ok(data.details.length > 0);
  });
});

describe("GET /bookmarks/export", () => {
  beforeEach(() => {
    bookmarks.clear();
  });

  it("returns empty array when no bookmarks exist", async () => {
    const result = matchRoute("GET", "/bookmarks/export");
    assert.ok(result);
    const res = createMockRes();
    await result.handler({}, res, result.match);
    assert.equal(res.statusCode, 200);
    assert.deepEqual(JSON.parse(res.body), []);
  });

  it("returns all bookmarks in insertion order after creating multiple", async () => {
    const postRoute = matchRoute("POST", "/bookmarks");
    const req1 = createMockReq(JSON.stringify({ url: "https://a.com", title: "A", tags: ["js"] }));
    const res1 = createMockRes();
    await postRoute.handler(req1, res1, postRoute.match);

    const req2 = createMockReq(JSON.stringify({ url: "https://b.com", title: "B", tags: ["py"] }));
    const res2 = createMockRes();
    await postRoute.handler(req2, res2, postRoute.match);

    const req3 = createMockReq(JSON.stringify({ url: "https://c.com", title: "C" }));
    const res3 = createMockRes();
    await postRoute.handler(req3, res3, postRoute.match);

    const result = matchRoute("GET", "/bookmarks/export");
    assert.ok(result);
    const res = createMockRes();
    await result.handler({}, res, result.match);
    assert.equal(res.statusCode, 200);
    const data = JSON.parse(res.body);
    assert.equal(data.length, 3);
    assert.equal(data[0].url, "https://a.com");
    assert.equal(data[0].title, "A");
    assert.deepEqual(data[0].tags, ["js"]);
    assert.equal(data[1].url, "https://b.com");
    assert.equal(data[2].url, "https://c.com");
    assert.deepEqual(data[2].tags, []);
  });

  it("responds with 200 and valid JSON array", async () => {
    const postRoute = matchRoute("POST", "/bookmarks");
    const req1 = createMockReq(JSON.stringify({ url: "https://x.com", title: "X" }));
    const res1 = createMockRes();
    await postRoute.handler(req1, res1, postRoute.match);

    const result = matchRoute("GET", "/bookmarks/export");
    const res = createMockRes();
    await result.handler({}, res, result.match);
    assert.equal(res.statusCode, 200);
    const data = JSON.parse(res.body);
    assert.ok(Array.isArray(data));
    assert.equal(data.length, 1);
    assert.ok(data[0].id);
    assert.ok(data[0].created_at);
  });
});

describe("GET /bookmarks/stats", () => {
  beforeEach(() => bookmarks.clear());

  it("returns stats for empty collection", async () => {
    const route = matchRoute("GET", "/bookmarks/stats");
    assert.ok(route);
    const res = createMockRes();
    await route.handler({}, res, route.match);
    assert.equal(res.statusCode, 200);
    const data = JSON.parse(res.body);
    assert.equal(data.total, 0);
    assert.deepEqual(data.by_tag, {});
    assert.equal(data.oldest, null);
    assert.equal(data.newest, null);
  });

  it("returns correct stats with multiple bookmarks", async () => {
    // Create bookmarks with tags
    const postRoute = matchRoute("POST", "/bookmarks");
    const res1 = createMockRes();
    await postRoute.handler(createMockReq(JSON.stringify({ url: "https://a.com", title: "A", tags: ["js", "node"] })), res1, postRoute.match);
    const res2 = createMockRes();
    await postRoute.handler(createMockReq(JSON.stringify({ url: "https://b.com", title: "B", tags: ["js", "python"] })), res2, postRoute.match);

    const route = matchRoute("GET", "/bookmarks/stats");
    const res = createMockRes();
    await route.handler({}, res, route.match);
    const data = JSON.parse(res.body);

    assert.equal(data.total, 2);
    assert.equal(data.by_tag.js, 2);
    assert.equal(data.by_tag.node, 1);
    assert.equal(data.by_tag.python, 1);
    assert.ok(data.oldest);
    assert.ok(data.newest);
  });
});

describe("GET /bookmarks/recent", () => {
  beforeEach(() => bookmarks.clear());

  it("returns empty array when no bookmarks", async () => {
    const route = matchRoute("GET", "/bookmarks/recent");
    assert.ok(route);
    const res = createMockRes();
    await route.handler({}, res, route.match);
    assert.equal(res.statusCode, 200);
    assert.deepEqual(JSON.parse(res.body), []);
  });

  it("returns up to 5 most recent bookmarks in newest-first order", async () => {
    const postRoute = matchRoute("POST", "/bookmarks");
    for (let i = 1; i <= 7; i++) {
      const res = createMockRes();
      await postRoute.handler(createMockReq(JSON.stringify({ url: `https://${i}.com`, title: `B${i}` })), res, postRoute.match);
    }
    const route = matchRoute("GET", "/bookmarks/recent");
    const res = createMockRes();
    await route.handler({}, res, route.match);
    const data = JSON.parse(res.body);
    assert.equal(data.length, 5);
    assert.equal(data[0].title, "B7"); // newest first
    assert.equal(data[4].title, "B3");
  });

  it("returns all if fewer than 5 bookmarks", async () => {
    const postRoute = matchRoute("POST", "/bookmarks");
    for (let i = 1; i <= 3; i++) {
      const res = createMockRes();
      await postRoute.handler(createMockReq(JSON.stringify({ url: `https://${i}.com`, title: `B${i}` })), res, postRoute.match);
    }
    const route = matchRoute("GET", "/bookmarks/recent");
    const res = createMockRes();
    await route.handler({}, res, route.match);
    const data = JSON.parse(res.body);
    assert.equal(data.length, 3);
  });
});
