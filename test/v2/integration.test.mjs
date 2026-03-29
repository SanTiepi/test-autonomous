// Integration test — full SwissBuildingOS V2 stack

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { Readable } from "node:stream";
import { matchRoute } from "../../src/v2/server.mjs";
import { clearBuildings } from "../../src/v2/building_registry.mjs";
import { clearEvidenceStore } from "../../src/v2/evidence_engine.mjs";
import { clearDiagnosticStore } from "../../src/v2/diagnostic_tracker.mjs";
import { clearActionStore } from "../../src/v2/action_planner.mjs";

// --- Test helpers ---

function fakeReq(method, url, body) {
  const payload = body !== undefined ? JSON.stringify(body) : "";
  const stream = new Readable({
    read() {
      if (payload) this.push(payload);
      this.push(null);
    },
  });
  stream.method = method;
  stream.url = url;
  stream.headers = { "content-type": "application/json" };
  return stream;
}

function fakeRes() {
  let _status;
  let _headers = {};
  let _body = "";
  return {
    writeHead(status, headers) {
      _status = status;
      if (headers) Object.assign(_headers, headers);
    },
    end(data) {
      if (data) _body = data;
    },
    get status() {
      return _status;
    },
    get body() {
      return _body ? JSON.parse(_body) : null;
    },
    get headers() {
      return _headers;
    },
  };
}

async function call(method, url, body) {
  const route = matchRoute(method, url);
  if (!route) {
    return { status: 404, body: { error: "Not found" } };
  }
  const req = fakeReq(method, url, body);
  const res = fakeRes();
  await route.handler(req, res, route.match);
  return { status: res.status, body: res.body };
}

// --- Fixtures ---

const VALID_BUILDING = {
  address: "Bahnhofstrasse 1, 8001 Zurich",
  type: "commercial",
  year: 1990,
  risk_level: "high",
};

const VALID_EVIDENCE = {
  type: "inspection",
  title: "Annual fire inspection report",
  notes: "All clear",
};

const VALID_DIAGNOSTIC = {
  category: "energy",
  score: 35,
  findings: "Poor insulation in north wing",
};

// --- Tests ---

describe("SwissBuildingOS V2 Integration", () => {
  beforeEach(() => {
    clearBuildings();
    clearEvidenceStore();
    clearDiagnosticStore();
    clearActionStore();
  });

  // ============================================================
  // Full lifecycle test
  // ============================================================

  describe("Full lifecycle", () => {
    it("creates building -> evidence -> diagnostics -> actions -> dashboard", async () => {
      // 1. Create a building
      const b = await call("POST", "/v2/buildings", VALID_BUILDING);
      assert.equal(b.status, 201);
      const buildingId = b.body.id;
      assert.ok(buildingId);

      // 2. Attach evidence
      const ev = await call("POST", `/v2/buildings/${buildingId}/evidence`, VALID_EVIDENCE);
      assert.equal(ev.status, 201);
      assert.equal(ev.body.building_id, buildingId);
      assert.equal(ev.body.status, "pending");

      // 3. List evidence for building
      const evList = await call("GET", `/v2/buildings/${buildingId}/evidence`);
      assert.equal(evList.status, 200);
      assert.equal(evList.body.length, 1);

      // 4. Verify evidence
      const verified = await call("PATCH", `/v2/evidence/${ev.body.id}/verify`, {
        status: "verified",
        notes: "Checked by inspector",
      });
      assert.equal(verified.status, 200);
      assert.equal(verified.body.status, "verified");
      assert.ok(verified.body.verified_at);

      // 5. Create diagnostics
      const d1 = await call("POST", `/v2/buildings/${buildingId}/diagnostics`, VALID_DIAGNOSTIC);
      assert.equal(d1.status, 201);
      assert.equal(d1.body.severity, "critical"); // score 35 < 40 -> critical

      const d2 = await call("POST", `/v2/buildings/${buildingId}/diagnostics`, {
        category: "asbestos",
        score: 15,
        findings: "Asbestos detected in ceiling tiles",
      });
      assert.equal(d2.status, 201);
      assert.equal(d2.body.severity, "critical"); // score 15 -> critical

      // 6. List diagnostics
      const dList = await call("GET", `/v2/buildings/${buildingId}/diagnostics`);
      assert.equal(dList.status, 200);
      assert.equal(dList.body.length, 2);

      // 7. Diagnostic summary
      const summary = await call("GET", `/v2/buildings/${buildingId}/diagnostics/summary`);
      assert.equal(summary.status, 200);
      assert.equal(summary.body.overall_risk, "critical");
      assert.ok(summary.body.categories.energy);
      assert.ok(summary.body.categories.asbestos);

      // 8. Generate actions from diagnostics
      const actions = await call("POST", `/v2/buildings/${buildingId}/actions/generate`);
      assert.equal(actions.status, 201);
      assert.ok(actions.body.length >= 2); // at least energy audit + asbestos removal

      // 9. List actions
      const aList = await call("GET", `/v2/buildings/${buildingId}/actions`);
      assert.equal(aList.status, 200);
      assert.equal(aList.body.length, actions.body.length);

      // 10. Update action status
      const actionId = actions.body[0].id;
      const updated = await call("PATCH", `/v2/actions/${actionId}/status`, { status: "in_progress" });
      assert.equal(updated.status, 200);
      assert.equal(updated.body.status, "in_progress");

      // 11. Dashboard summary
      const dash = await call("GET", "/v2/dashboard/summary");
      assert.equal(dash.status, 200);
      assert.equal(dash.body.total_buildings, 1);
      assert.equal(dash.body.total_evidence, 1);
      assert.equal(dash.body.total_diagnostics, 2);
      assert.ok(dash.body.total_actions >= 2);

      // 12. Risk breakdown
      const risk = await call("GET", "/v2/dashboard/risk-breakdown");
      assert.equal(risk.status, 200);
      assert.equal(risk.body.length, 1);
      assert.equal(risk.body[0].building_id, buildingId);
      assert.equal(risk.body[0].diagnostic_count, 2);

      // 13. Completion stats
      const comp = await call("GET", "/v2/dashboard/completion");
      assert.equal(comp.status, 200);
      assert.equal(comp.body.actions_in_progress, 1);

      // 14. Backlog stats
      const backlog = await call("GET", "/v2/dashboard/backlog");
      assert.equal(backlog.status, 200);
      assert.ok(backlog.body.urgent_actions >= 0);
    });
  });

  // ============================================================
  // Evidence routes
  // ============================================================

  describe("Evidence routes", () => {
    it("returns 404 when creating evidence for non-existent building", async () => {
      const res = await call("POST", "/v2/buildings/999/evidence", VALID_EVIDENCE);
      assert.equal(res.status, 404);
      assert.equal(res.body.error, "Building not found");
    });

    it("returns validation error for invalid evidence", async () => {
      const b = await call("POST", "/v2/buildings", VALID_BUILDING);
      const res = await call("POST", `/v2/buildings/${b.body.id}/evidence`, { type: "bogus", title: "" });
      assert.equal(res.status, 400);
      assert.equal(res.body.error, "Validation failed");
      assert.ok(res.body.details.length >= 2);
    });

    it("gets evidence by id", async () => {
      const b = await call("POST", "/v2/buildings", VALID_BUILDING);
      const ev = await call("POST", `/v2/buildings/${b.body.id}/evidence`, VALID_EVIDENCE);
      const res = await call("GET", `/v2/evidence/${ev.body.id}`);
      assert.equal(res.status, 200);
      assert.equal(res.body.title, VALID_EVIDENCE.title);
    });

    it("returns 404 for non-existent evidence", async () => {
      const res = await call("GET", "/v2/evidence/999");
      assert.equal(res.status, 404);
      assert.equal(res.body.error, "Evidence not found");
    });

    it("rejects invalid status transition", async () => {
      const b = await call("POST", "/v2/buildings", VALID_BUILDING);
      const ev = await call("POST", `/v2/buildings/${b.body.id}/evidence`, VALID_EVIDENCE);
      // Verify it first
      await call("PATCH", `/v2/evidence/${ev.body.id}/verify`, { status: "verified" });
      // Try to verify again (verified -> verified is not allowed)
      const res = await call("PATCH", `/v2/evidence/${ev.body.id}/verify`, { status: "rejected" });
      assert.equal(res.status, 400);
      assert.ok(res.body.error.includes("invalid transition"));
    });

    it("deletes evidence", async () => {
      const b = await call("POST", "/v2/buildings", VALID_BUILDING);
      const ev = await call("POST", `/v2/buildings/${b.body.id}/evidence`, VALID_EVIDENCE);
      const del = await call("DELETE", `/v2/evidence/${ev.body.id}`);
      assert.equal(del.status, 204);
      const get = await call("GET", `/v2/evidence/${ev.body.id}`);
      assert.equal(get.status, 404);
    });

    it("returns 404 deleting non-existent evidence", async () => {
      const res = await call("DELETE", "/v2/evidence/999");
      assert.equal(res.status, 404);
    });

    it("returns 404 listing evidence for non-existent building", async () => {
      const res = await call("GET", "/v2/buildings/999/evidence");
      assert.equal(res.status, 404);
    });
  });

  // ============================================================
  // Diagnostic routes
  // ============================================================

  describe("Diagnostic routes", () => {
    it("returns 404 when creating diagnostic for non-existent building", async () => {
      const res = await call("POST", "/v2/buildings/999/diagnostics", VALID_DIAGNOSTIC);
      assert.equal(res.status, 404);
      assert.equal(res.body.error, "Building not found");
    });

    it("returns validation error for invalid diagnostic", async () => {
      const b = await call("POST", "/v2/buildings", VALID_BUILDING);
      const res = await call("POST", `/v2/buildings/${b.body.id}/diagnostics`, { category: "nope", score: -1, findings: "" });
      assert.equal(res.status, 400);
      assert.equal(res.body.error, "Validation failed");
      assert.ok(res.body.details.length >= 3);
    });

    it("gets diagnostic by id", async () => {
      const b = await call("POST", "/v2/buildings", VALID_BUILDING);
      const d = await call("POST", `/v2/buildings/${b.body.id}/diagnostics`, VALID_DIAGNOSTIC);
      const res = await call("GET", `/v2/diagnostics/${d.body.id}`);
      assert.equal(res.status, 200);
      assert.equal(res.body.category, "energy");
    });

    it("returns 404 for non-existent diagnostic", async () => {
      const res = await call("GET", "/v2/diagnostics/999");
      assert.equal(res.status, 404);
      assert.equal(res.body.error, "Diagnostic not found");
    });

    it("updates a diagnostic", async () => {
      const b = await call("POST", "/v2/buildings", VALID_BUILDING);
      const d = await call("POST", `/v2/buildings/${b.body.id}/diagnostics`, VALID_DIAGNOSTIC);
      const res = await call("PUT", `/v2/diagnostics/${d.body.id}`, { score: 80, findings: "Improved" });
      assert.equal(res.status, 200);
      assert.equal(res.body.score, 80);
      assert.equal(res.body.severity, "ok");
      assert.equal(res.body.findings, "Improved");
    });

    it("returns 404 updating non-existent diagnostic", async () => {
      const res = await call("PUT", "/v2/diagnostics/999", { score: 80 });
      assert.equal(res.status, 404);
    });

    it("deletes a diagnostic", async () => {
      const b = await call("POST", "/v2/buildings", VALID_BUILDING);
      const d = await call("POST", `/v2/buildings/${b.body.id}/diagnostics`, VALID_DIAGNOSTIC);
      const del = await call("DELETE", `/v2/diagnostics/${d.body.id}`);
      assert.equal(del.status, 204);
      const get = await call("GET", `/v2/diagnostics/${d.body.id}`);
      assert.equal(get.status, 404);
    });

    it("returns 404 deleting non-existent diagnostic", async () => {
      const res = await call("DELETE", "/v2/diagnostics/999");
      assert.equal(res.status, 404);
    });

    it("returns diagnostic summary", async () => {
      const b = await call("POST", "/v2/buildings", VALID_BUILDING);
      await call("POST", `/v2/buildings/${b.body.id}/diagnostics`, VALID_DIAGNOSTIC);
      await call("POST", `/v2/buildings/${b.body.id}/diagnostics`, {
        category: "structure",
        score: 85,
        findings: "Good shape",
      });
      const res = await call("GET", `/v2/buildings/${b.body.id}/diagnostics/summary`);
      assert.equal(res.status, 200);
      assert.equal(res.body.building_id, b.body.id);
      assert.equal(res.body.overall_risk, "critical"); // energy=35 -> critical, structure=85 -> ok
      assert.ok(res.body.categories.energy);
      assert.ok(res.body.categories.structure);
    });

    it("returns 404 for summary of non-existent building", async () => {
      const res = await call("GET", "/v2/buildings/999/diagnostics/summary");
      assert.equal(res.status, 404);
    });

    it("returns 404 listing diagnostics for non-existent building", async () => {
      const res = await call("GET", "/v2/buildings/999/diagnostics");
      assert.equal(res.status, 404);
    });
  });

  // ============================================================
  // Action routes
  // ============================================================

  describe("Action routes", () => {
    it("generates actions from diagnostics", async () => {
      const b = await call("POST", "/v2/buildings", VALID_BUILDING);
      await call("POST", `/v2/buildings/${b.body.id}/diagnostics`, {
        category: "fire",
        score: 20,
        findings: "Major fire hazards",
      });
      const res = await call("POST", `/v2/buildings/${b.body.id}/actions/generate`);
      assert.equal(res.status, 201);
      assert.ok(res.body.length >= 1);
      assert.equal(res.body[0].building_id, b.body.id);
      assert.equal(res.body[0].status, "open");
    });

    it("returns 404 generating actions for non-existent building", async () => {
      const res = await call("POST", "/v2/buildings/999/actions/generate");
      assert.equal(res.status, 404);
      assert.equal(res.body.error, "Building not found");
    });

    it("deduplicates generated actions", async () => {
      const b = await call("POST", "/v2/buildings", VALID_BUILDING);
      await call("POST", `/v2/buildings/${b.body.id}/diagnostics`, {
        category: "fire",
        score: 20,
        findings: "Major fire hazards",
      });
      const first = await call("POST", `/v2/buildings/${b.body.id}/actions/generate`);
      assert.ok(first.body.length >= 1);
      // Generate again — should produce no new actions
      const second = await call("POST", `/v2/buildings/${b.body.id}/actions/generate`);
      assert.equal(second.body.length, 0);
    });

    it("gets action by id", async () => {
      const b = await call("POST", "/v2/buildings", VALID_BUILDING);
      await call("POST", `/v2/buildings/${b.body.id}/diagnostics`, VALID_DIAGNOSTIC);
      const gen = await call("POST", `/v2/buildings/${b.body.id}/actions/generate`);
      const actionId = gen.body[0].id;
      const res = await call("GET", `/v2/actions/${actionId}`);
      assert.equal(res.status, 200);
      assert.equal(res.body.id, actionId);
    });

    it("returns 404 for non-existent action", async () => {
      const res = await call("GET", "/v2/actions/999");
      assert.equal(res.status, 404);
      assert.equal(res.body.error, "Action not found");
    });

    it("updates action status", async () => {
      const b = await call("POST", "/v2/buildings", VALID_BUILDING);
      await call("POST", `/v2/buildings/${b.body.id}/diagnostics`, VALID_DIAGNOSTIC);
      const gen = await call("POST", `/v2/buildings/${b.body.id}/actions/generate`);
      const actionId = gen.body[0].id;
      const res = await call("PATCH", `/v2/actions/${actionId}/status`, { status: "completed" });
      assert.equal(res.status, 200);
      assert.equal(res.body.status, "completed");
    });

    it("rejects invalid action status", async () => {
      const b = await call("POST", "/v2/buildings", VALID_BUILDING);
      await call("POST", `/v2/buildings/${b.body.id}/diagnostics`, VALID_DIAGNOSTIC);
      const gen = await call("POST", `/v2/buildings/${b.body.id}/actions/generate`);
      const actionId = gen.body[0].id;
      const res = await call("PATCH", `/v2/actions/${actionId}/status`, { status: "bogus" });
      assert.equal(res.status, 400);
      assert.ok(res.body.error.includes("invalid status"));
    });

    it("returns 404 updating non-existent action status", async () => {
      const res = await call("PATCH", "/v2/actions/999/status", { status: "completed" });
      assert.equal(res.status, 404);
    });

    it("deletes an action", async () => {
      const b = await call("POST", "/v2/buildings", VALID_BUILDING);
      await call("POST", `/v2/buildings/${b.body.id}/diagnostics`, VALID_DIAGNOSTIC);
      const gen = await call("POST", `/v2/buildings/${b.body.id}/actions/generate`);
      const actionId = gen.body[0].id;
      const del = await call("DELETE", `/v2/actions/${actionId}`);
      assert.equal(del.status, 204);
      const get = await call("GET", `/v2/actions/${actionId}`);
      assert.equal(get.status, 404);
    });

    it("returns 404 deleting non-existent action", async () => {
      const res = await call("DELETE", "/v2/actions/999");
      assert.equal(res.status, 404);
    });

    it("returns 404 listing actions for non-existent building", async () => {
      const res = await call("GET", "/v2/buildings/999/actions");
      assert.equal(res.status, 404);
    });
  });

  // ============================================================
  // Dashboard routes
  // ============================================================

  describe("Dashboard routes", () => {
    it("returns empty portfolio summary", async () => {
      const res = await call("GET", "/v2/dashboard/summary");
      assert.equal(res.status, 200);
      assert.equal(res.body.total_buildings, 0);
      assert.equal(res.body.total_evidence, 0);
      assert.equal(res.body.total_diagnostics, 0);
      assert.equal(res.body.total_actions, 0);
    });

    it("returns risk breakdown with data", async () => {
      const b = await call("POST", "/v2/buildings", VALID_BUILDING);
      await call("POST", `/v2/buildings/${b.body.id}/evidence`, VALID_EVIDENCE);
      const res = await call("GET", "/v2/dashboard/risk-breakdown");
      assert.equal(res.status, 200);
      assert.equal(res.body.length, 1);
      assert.equal(res.body[0].evidence_count, 1);
    });

    it("returns completion stats", async () => {
      const res = await call("GET", "/v2/dashboard/completion");
      assert.equal(res.status, 200);
      assert.equal(res.body.actions_open, 0);
      assert.equal(res.body.actions_completed, 0);
      assert.equal(res.body.completion_rate, 0);
    });

    it("returns backlog stats", async () => {
      const res = await call("GET", "/v2/dashboard/backlog");
      assert.equal(res.status, 200);
      assert.equal(res.body.overdue_actions, 0);
      assert.equal(res.body.urgent_actions, 0);
    });
  });

  // ============================================================
  // 404 for unknown routes
  // ============================================================

  describe("Unknown routes", () => {
    it("returns 404 for unmatched route", async () => {
      const res = await call("GET", "/v2/nonexistent");
      assert.equal(res.status, 404);
      assert.equal(res.body.error, "Not found");
    });
  });
});
