import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { matchRoute } from "../src/index.mjs";
import { resetStores, detectDrifts } from "../src/runbook_drift_radar.mjs";

// --- Test helpers ---
function mockReq(bodyStr) {
  return {
    on(event, cb) {
      if (event === "data") process.nextTick(() => cb(Buffer.from(bodyStr)));
      if (event === "end") process.nextTick(() => process.nextTick(() => cb()));
      return this;
    },
  };
}

function mockRes() {
  return {
    statusCode: 0,
    headers: {},
    body: "",
    writeHead(code, hdrs) { this.statusCode = code; this.headers = hdrs || {}; },
    end(data) { this.body = data || ""; },
  };
}

function parse(res) { return JSON.parse(res.body); }

const VALID_RUNBOOK = {
  name: "Users API",
  description: "User service contract",
  endpoints: [
    { path: "/api/users", method: "GET", expectedStatus: 200, expectedShape: { id: "number", name: "string", email: "string" }, maxLatencyMs: 500 },
    { path: "/api/users", method: "POST", expectedStatus: 201, expectedShape: { id: "number", name: "string" } },
  ],
};

const VALID_OBSERVATION = {
  endpointPath: "/api/users",
  method: "GET",
  actualStatus: 200,
  actualShape: { id: "number", name: "string", email: "string" },
  latencyMs: 120,
};

async function createTestRunbook(body) {
  const r = matchRoute("POST", "/drift/runbooks");
  const req = mockReq(JSON.stringify(body || VALID_RUNBOOK));
  const res = mockRes();
  await r.handler(req, res, r.match);
  return parse(res);
}

async function observe(runbookId, body) {
  const r = matchRoute("POST", `/drift/runbooks/${runbookId}/observe`);
  const req = mockReq(JSON.stringify(body));
  const res = mockRes();
  await r.handler(req, res, r.match);
  return { res, data: parse(res) };
}

// ======================== TESTS ========================

describe("POST /drift/runbooks", () => {
  beforeEach(() => resetStores());

  it("creates a runbook and returns 201", async () => {
    const r = matchRoute("POST", "/drift/runbooks");
    assert.ok(r);
    const req = mockReq(JSON.stringify(VALID_RUNBOOK));
    const res = mockRes();
    await r.handler(req, res, r.match);
    assert.equal(res.statusCode, 201);
    const data = parse(res);
    assert.ok(data.id);
    assert.equal(data.name, "Users API");
    assert.equal(data.description, "User service contract");
    assert.equal(data.endpoints.length, 2);
    assert.equal(data.endpoints[0].method, "GET");
    assert.ok(data.createdAt);
  });

  it("returns 400 for invalid JSON", async () => {
    const r = matchRoute("POST", "/drift/runbooks");
    const req = mockReq("{bad json");
    const res = mockRes();
    await r.handler(req, res, r.match);
    assert.equal(res.statusCode, 400);
    assert.equal(parse(res).error, "Invalid JSON");
  });

  it("returns 400 when name is missing", async () => {
    const r = matchRoute("POST", "/drift/runbooks");
    const req = mockReq(JSON.stringify({ endpoints: [{ path: "/x", method: "GET", expectedStatus: 200 }] }));
    const res = mockRes();
    await r.handler(req, res, r.match);
    assert.equal(res.statusCode, 400);
    const data = parse(res);
    assert.equal(data.error, "Validation failed");
    assert.ok(data.details.some((d) => d.includes("name")));
  });

  it("returns 400 when endpoints is empty", async () => {
    const r = matchRoute("POST", "/drift/runbooks");
    const req = mockReq(JSON.stringify({ name: "X", endpoints: [] }));
    const res = mockRes();
    await r.handler(req, res, r.match);
    assert.equal(res.statusCode, 400);
    assert.ok(parse(res).details.some((d) => d.includes("endpoints")));
  });

  it("returns 400 when endpoint has invalid method", async () => {
    const r = matchRoute("POST", "/drift/runbooks");
    const req = mockReq(JSON.stringify({ name: "X", endpoints: [{ path: "/x", method: "INVALID", expectedStatus: 200 }] }));
    const res = mockRes();
    await r.handler(req, res, r.match);
    assert.equal(res.statusCode, 400);
    assert.ok(parse(res).details.some((d) => d.includes("method")));
  });

  it("returns 400 when expectedStatus is out of range", async () => {
    const r = matchRoute("POST", "/drift/runbooks");
    const req = mockReq(JSON.stringify({ name: "X", endpoints: [{ path: "/x", method: "GET", expectedStatus: 99 }] }));
    const res = mockRes();
    await r.handler(req, res, r.match);
    assert.equal(res.statusCode, 400);
    assert.ok(parse(res).details.some((d) => d.includes("expectedStatus")));
  });

  it("normalizes method to uppercase", async () => {
    const rb = await createTestRunbook({ name: "T", endpoints: [{ path: "/x", method: "get", expectedStatus: 200 }] });
    assert.equal(rb.endpoints[0].method, "GET");
  });
});

describe("GET /drift/runbooks", () => {
  beforeEach(() => resetStores());

  it("returns empty array when no runbooks exist", async () => {
    const r = matchRoute("GET", "/drift/runbooks");
    assert.ok(r);
    const res = mockRes();
    await r.handler({}, res, r.match);
    assert.equal(res.statusCode, 200);
    assert.deepEqual(parse(res), []);
  });

  it("returns all runbooks", async () => {
    await createTestRunbook();
    await createTestRunbook({ name: "Orders API", endpoints: [{ path: "/orders", method: "GET", expectedStatus: 200 }] });
    const r = matchRoute("GET", "/drift/runbooks");
    const res = mockRes();
    await r.handler({}, res, r.match);
    assert.equal(res.statusCode, 200);
    const data = parse(res);
    assert.equal(data.length, 2);
    assert.equal(data[0].name, "Users API");
    assert.equal(data[1].name, "Orders API");
  });
});

describe("GET /drift/runbooks/:id", () => {
  beforeEach(() => resetStores());

  it("returns 200 for existing runbook", async () => {
    const created = await createTestRunbook();
    const r = matchRoute("GET", `/drift/runbooks/${created.id}`);
    assert.ok(r);
    const res = mockRes();
    await r.handler({}, res, r.match);
    assert.equal(res.statusCode, 200);
    assert.equal(parse(res).id, created.id);
    assert.equal(parse(res).name, "Users API");
  });

  it("returns 404 for non-existent runbook", async () => {
    const r = matchRoute("GET", "/drift/runbooks/999");
    assert.ok(r);
    const res = mockRes();
    await r.handler({}, res, r.match);
    assert.equal(res.statusCode, 404);
    assert.equal(parse(res).error, "Runbook not found");
  });
});

describe("POST /drift/runbooks/:id/observe", () => {
  beforeEach(() => resetStores());

  it("records observation with no drift when matching contract", async () => {
    const rb = await createTestRunbook();
    const { res, data } = await observe(rb.id, VALID_OBSERVATION);
    assert.equal(res.statusCode, 201);
    assert.ok(data.observation.id);
    assert.equal(data.observation.endpointPath, "/api/users");
    assert.equal(data.drifts.length, 0);
    assert.equal(data.alerts.length, 0);
  });

  it("returns 404 for non-existent runbook", async () => {
    const r = matchRoute("POST", "/drift/runbooks/999/observe");
    assert.ok(r);
    const req = mockReq(JSON.stringify(VALID_OBSERVATION));
    const res = mockRes();
    await r.handler(req, res, r.match);
    assert.equal(res.statusCode, 404);
    assert.equal(parse(res).error, "Runbook not found");
  });

  it("returns 400 for invalid JSON", async () => {
    const rb = await createTestRunbook();
    const r = matchRoute("POST", `/drift/runbooks/${rb.id}/observe`);
    const req = mockReq("bad{");
    const res = mockRes();
    await r.handler(req, res, r.match);
    assert.equal(res.statusCode, 400);
    assert.equal(parse(res).error, "Invalid JSON");
  });

  it("returns 400 when endpointPath is missing", async () => {
    const rb = await createTestRunbook();
    const { res } = await observe(rb.id, { method: "GET", actualStatus: 200 });
    assert.equal(res.statusCode, 400);
    assert.ok(parse(res).details.some((d) => d.includes("endpointPath")));
  });

  it("returns 400 when actualStatus is out of range", async () => {
    const rb = await createTestRunbook();
    const { res } = await observe(rb.id, { endpointPath: "/api/users", method: "GET", actualStatus: 999 });
    assert.equal(res.statusCode, 400);
    assert.ok(parse(res).details.some((d) => d.includes("actualStatus")));
  });
});

describe("Drift detection — status", () => {
  beforeEach(() => resetStores());

  it("detects status code drift as critical", async () => {
    const rb = await createTestRunbook();
    const { data } = await observe(rb.id, { ...VALID_OBSERVATION, actualStatus: 500 });
    assert.equal(data.drifts.length, 1);
    assert.equal(data.drifts[0].type, "status");
    assert.equal(data.drifts[0].severity, "critical");
    assert.equal(data.drifts[0].expected, 200);
    assert.equal(data.drifts[0].actual, 500);
    assert.equal(data.alerts.length, 1);
    assert.equal(data.alerts[0].status, "active");
  });
});

describe("Drift detection — shape", () => {
  beforeEach(() => resetStores());

  it("detects missing field as high severity", async () => {
    const rb = await createTestRunbook();
    const { data } = await observe(rb.id, {
      ...VALID_OBSERVATION,
      actualShape: { id: "number", name: "string" }, // missing "email"
    });
    assert.equal(data.drifts.length, 1);
    assert.equal(data.drifts[0].type, "missing_field");
    assert.equal(data.drifts[0].field, "email");
    assert.equal(data.drifts[0].severity, "high");
  });

  it("detects extra field as low severity", async () => {
    const rb = await createTestRunbook();
    const { data } = await observe(rb.id, {
      ...VALID_OBSERVATION,
      actualShape: { id: "number", name: "string", email: "string", avatar: "string" },
    });
    assert.equal(data.drifts.length, 1);
    assert.equal(data.drifts[0].type, "extra_field");
    assert.equal(data.drifts[0].field, "avatar");
    assert.equal(data.drifts[0].severity, "low");
  });

  it("detects type mismatch as high severity", async () => {
    const rb = await createTestRunbook();
    const { data } = await observe(rb.id, {
      ...VALID_OBSERVATION,
      actualShape: { id: "string", name: "string", email: "string" }, // id changed from number to string
    });
    assert.equal(data.drifts.length, 1);
    assert.equal(data.drifts[0].type, "type_mismatch");
    assert.equal(data.drifts[0].field, "id");
    assert.equal(data.drifts[0].expected, "number");
    assert.equal(data.drifts[0].actual, "string");
  });
});

describe("Drift detection — latency", () => {
  beforeEach(() => resetStores());

  it("detects latency breach as medium severity", async () => {
    const rb = await createTestRunbook();
    const { data } = await observe(rb.id, { ...VALID_OBSERVATION, latencyMs: 800 }); // max is 500
    assert.equal(data.drifts.length, 1);
    assert.equal(data.drifts[0].type, "latency_breach");
    assert.equal(data.drifts[0].severity, "medium");
    assert.equal(data.drifts[0].expected, 500);
    assert.equal(data.drifts[0].actual, 800);
  });

  it("no drift when latency is within bounds", async () => {
    const rb = await createTestRunbook();
    const { data } = await observe(rb.id, { ...VALID_OBSERVATION, latencyMs: 499 });
    assert.equal(data.drifts.length, 0);
  });
});

describe("Drift detection — multiple drifts", () => {
  beforeEach(() => resetStores());

  it("detects multiple drift types in a single observation", async () => {
    const rb = await createTestRunbook();
    const { data } = await observe(rb.id, {
      endpointPath: "/api/users",
      method: "GET",
      actualStatus: 503,
      actualShape: { id: "string", extra: "boolean" }, // missing name+email, type mismatch id, extra field
      latencyMs: 1200,
    });
    // Expected: status (critical) + missing_field name + missing_field email + type_mismatch id + extra_field extra + latency (medium)
    assert.ok(data.drifts.length >= 5);
    const types = data.drifts.map((d) => d.type);
    assert.ok(types.includes("status"));
    assert.ok(types.includes("missing_field"));
    assert.ok(types.includes("type_mismatch"));
    assert.ok(types.includes("extra_field"));
    assert.ok(types.includes("latency_breach"));
  });
});

describe("Alert occurrences", () => {
  beforeEach(() => resetStores());

  it("increments occurrences on repeated same drift", async () => {
    const rb = await createTestRunbook();
    const { data: d1 } = await observe(rb.id, { ...VALID_OBSERVATION, actualStatus: 500 });
    assert.equal(d1.alerts[0].occurrences, 1);

    const { data: d2 } = await observe(rb.id, { ...VALID_OBSERVATION, actualStatus: 500 });
    assert.equal(d2.alerts[0].occurrences, 2);
    assert.equal(d2.alerts[0].id, d1.alerts[0].id); // same alert

    const { data: d3 } = await observe(rb.id, { ...VALID_OBSERVATION, actualStatus: 500 });
    assert.equal(d3.alerts[0].occurrences, 3);
  });
});

describe("GET /drift/runbooks/:id/drift", () => {
  beforeEach(() => resetStores());

  it("returns drift report with per-endpoint summaries", async () => {
    const rb = await createTestRunbook();
    await observe(rb.id, VALID_OBSERVATION);
    await observe(rb.id, { ...VALID_OBSERVATION, actualStatus: 500 });

    const r = matchRoute("GET", `/drift/runbooks/${rb.id}/drift`);
    assert.ok(r);
    const res = mockRes();
    await r.handler({}, res, r.match);
    assert.equal(res.statusCode, 200);
    const report = parse(res);
    assert.equal(report.runbookId, rb.id);
    assert.equal(report.runbookName, "Users API");
    assert.equal(report.totalObservations, 2);
    assert.equal(report.totalActiveAlerts, 1);
    assert.equal(report.endpoints.length, 2);
    const getEp = report.endpoints.find((e) => e.method === "GET");
    assert.equal(getEp.observationCount, 2);
    assert.equal(getEp.activeAlertCount, 1);
  });

  it("returns 404 for non-existent runbook", async () => {
    const r = matchRoute("GET", "/drift/runbooks/999/drift");
    assert.ok(r);
    const res = mockRes();
    await r.handler({}, res, r.match);
    assert.equal(res.statusCode, 404);
    assert.equal(parse(res).error, "Runbook not found");
  });

  it("returns zero counts when no observations yet", async () => {
    const rb = await createTestRunbook();
    const r = matchRoute("GET", `/drift/runbooks/${rb.id}/drift`);
    const res = mockRes();
    await r.handler({}, res, r.match);
    const report = parse(res);
    assert.equal(report.totalObservations, 0);
    assert.equal(report.totalActiveAlerts, 0);
  });
});

describe("GET /drift/alerts", () => {
  beforeEach(() => resetStores());

  it("returns empty array when no alerts", async () => {
    const r = matchRoute("GET", "/drift/alerts");
    assert.ok(r);
    const res = mockRes();
    await r.handler({}, res, r.match);
    assert.equal(res.statusCode, 200);
    assert.deepEqual(parse(res), []);
  });

  it("returns only active alerts by default", async () => {
    const rb = await createTestRunbook();
    await observe(rb.id, { ...VALID_OBSERVATION, actualStatus: 500 }); // creates 1 alert
    await observe(rb.id, { ...VALID_OBSERVATION, latencyMs: 800 }); // creates another alert

    const r = matchRoute("GET", "/drift/alerts");
    const res = mockRes();
    await r.handler({}, res, r.match);
    assert.equal(res.statusCode, 200);
    const data = parse(res);
    assert.equal(data.length, 2);
    assert.ok(data.every((a) => a.status === "active"));
  });

  it("filters by runbook_id when provided", async () => {
    const rb1 = await createTestRunbook();
    const rb2 = await createTestRunbook({ name: "Other", endpoints: [{ path: "/other", method: "GET", expectedStatus: 200, expectedShape: { x: "number" } }] });
    await observe(rb1.id, { ...VALID_OBSERVATION, actualStatus: 500 });
    await observe(rb2.id, { endpointPath: "/other", method: "GET", actualStatus: 500, actualShape: { x: "number" } });

    const r = matchRoute("GET", `/drift/alerts?runbook_id=${rb1.id}`);
    const res = mockRes();
    await r.handler({}, res, r.match);
    const data = parse(res);
    assert.equal(data.length, 1);
    assert.equal(data[0].runbookId, rb1.id);
  });
});

describe("PATCH /drift/alerts/:id/resolve", () => {
  beforeEach(() => resetStores());

  it("resolves an active alert", async () => {
    const rb = await createTestRunbook();
    const { data: obs } = await observe(rb.id, { ...VALID_OBSERVATION, actualStatus: 500 });
    const alertId = obs.alerts[0].id;

    const r = matchRoute("PATCH", `/drift/alerts/${alertId}/resolve`);
    assert.ok(r);
    const req = mockReq(JSON.stringify({ resolution: "Server was restarted" }));
    const res = mockRes();
    await r.handler(req, res, r.match);
    assert.equal(res.statusCode, 200);
    const alert = parse(res);
    assert.equal(alert.status, "resolved");
    assert.equal(alert.resolution, "Server was restarted");
    assert.ok(alert.resolvedAt);
  });

  it("returns 404 for non-existent alert", async () => {
    const r = matchRoute("PATCH", "/drift/alerts/999/resolve");
    assert.ok(r);
    const req = mockReq(JSON.stringify({}));
    const res = mockRes();
    await r.handler(req, res, r.match);
    assert.equal(res.statusCode, 404);
    assert.equal(parse(res).error, "Alert not found");
  });

  it("returns 409 when alert is already resolved", async () => {
    const rb = await createTestRunbook();
    const { data: obs } = await observe(rb.id, { ...VALID_OBSERVATION, actualStatus: 500 });
    const alertId = obs.alerts[0].id;

    // Resolve it once
    const r1 = matchRoute("PATCH", `/drift/alerts/${alertId}/resolve`);
    const req1 = mockReq(JSON.stringify({ resolution: "Fixed" }));
    const res1 = mockRes();
    await r1.handler(req1, res1, r1.match);
    assert.equal(res1.statusCode, 200);

    // Try again
    const r2 = matchRoute("PATCH", `/drift/alerts/${alertId}/resolve`);
    const req2 = mockReq(JSON.stringify({}));
    const res2 = mockRes();
    await r2.handler(req2, res2, r2.match);
    assert.equal(res2.statusCode, 409);
    assert.equal(parse(res2).error, "Alert already resolved");
  });

  it("returns 400 for invalid JSON", async () => {
    const rb = await createTestRunbook();
    const { data: obs } = await observe(rb.id, { ...VALID_OBSERVATION, actualStatus: 500 });
    const alertId = obs.alerts[0].id;

    const r = matchRoute("PATCH", `/drift/alerts/${alertId}/resolve`);
    const req = mockReq("bad{");
    const res = mockRes();
    await r.handler(req, res, r.match);
    assert.equal(res.statusCode, 400);
    assert.equal(parse(res).error, "Invalid JSON");
  });

  it("resolved alerts excluded from active alerts list", async () => {
    const rb = await createTestRunbook();
    await observe(rb.id, { ...VALID_OBSERVATION, actualStatus: 500 });
    await observe(rb.id, { ...VALID_OBSERVATION, latencyMs: 800 });

    // 2 active alerts
    let r = matchRoute("GET", "/drift/alerts");
    let res = mockRes();
    await r.handler({}, res, r.match);
    assert.equal(parse(res).length, 2);

    // Resolve one
    const alerts = parse(res);
    const resolveRoute = matchRoute("PATCH", `/drift/alerts/${alerts[0].id}/resolve`);
    const resolveReq = mockReq(JSON.stringify({ resolution: "ok" }));
    const resolveRes = mockRes();
    await resolveRoute.handler(resolveReq, resolveRes, resolveRoute.match);

    // Now only 1 active
    r = matchRoute("GET", "/drift/alerts");
    res = mockRes();
    await r.handler({}, res, r.match);
    assert.equal(parse(res).length, 1);
  });
});

describe("detectDrifts (unit)", () => {
  it("returns empty array when everything matches", () => {
    const ep = { expectedStatus: 200, expectedShape: { a: "string" }, maxLatencyMs: 100 };
    const obs = { actualStatus: 200, actualShape: { a: "string" }, latencyMs: 50 };
    assert.deepEqual(detectDrifts(ep, obs), []);
  });

  it("handles null shapes gracefully", () => {
    const ep = { expectedStatus: 200, expectedShape: null, maxLatencyMs: null };
    const obs = { actualStatus: 200, actualShape: null, latencyMs: null };
    assert.deepEqual(detectDrifts(ep, obs), []);
  });

  it("handles observation for unmatched endpoint (no endpoint spec)", async () => {
    resetStores();
    const rb = await createTestRunbook();
    // Observe an endpoint not in the runbook
    const { data } = await observe(rb.id, {
      endpointPath: "/api/unknown",
      method: "GET",
      actualStatus: 200,
    });
    assert.equal(data.drifts.length, 0); // no spec to compare against
    assert.ok(data.observation.id);
  });
});

describe("Drift report — resolved alerts tracking", () => {
  beforeEach(() => resetStores());

  it("drift report shows resolved alert count", async () => {
    const rb = await createTestRunbook();
    const { data: obs } = await observe(rb.id, { ...VALID_OBSERVATION, actualStatus: 500 });

    // Resolve it
    const r = matchRoute("PATCH", `/drift/alerts/${obs.alerts[0].id}/resolve`);
    const req = mockReq(JSON.stringify({}));
    const res = mockRes();
    await r.handler(req, res, r.match);

    // Check report
    const dr = matchRoute("GET", `/drift/runbooks/${rb.id}/drift`);
    const dRes = mockRes();
    await dr.handler({}, dRes, dr.match);
    const report = parse(dRes);
    assert.equal(report.totalActiveAlerts, 0);
    assert.equal(report.totalResolvedAlerts, 1);
  });
});
