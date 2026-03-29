import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";

import { createBuilding, clearBuildings } from "../../src/v2/building_registry.mjs";
import { createEvidence, clearEvidenceStore } from "../../src/v2/evidence_engine.mjs";
import { createDiagnostic, clearDiagnosticStore } from "../../src/v2/diagnostic_tracker.mjs";
import { createAction, clearActionStore, actionStore } from "../../src/v2/action_planner.mjs";
import {
  generateAlerts,
  generateAllAlerts,
  getAlert,
  listAlertsByBuilding,
  listAllAlerts,
  acknowledgeAlert,
  resolveAlert,
  clearAlertStore,
  alertStore,
} from "../../src/v2/alerts.mjs";

// --- Helpers ---

function seedBuilding(overrides = {}) {
  return createBuilding({
    address: "Bahnhofstrasse 1, 8001 Zürich",
    type: "commercial",
    year: 1990,
    risk_level: "low",
    ...overrides,
  });
}

describe("Alerts", () => {
  beforeEach(() => {
    clearBuildings();
    clearEvidenceStore();
    clearDiagnosticStore();
    clearActionStore();
    clearAlertStore();
  });

  // --- Generation ---

  describe("generateAlerts", () => {
    it("generates alert for overdue action", () => {
      const b = seedBuilding();
      // Create an action with a past due date
      const action = createAction({
        building_id: b.id,
        title: "Roof repair",
        due_date: "2020-01-01T00:00:00.000Z",
      });

      const alerts = generateAlerts(b.id);

      const overdueAlert = alerts.find((a) => a.type === "overdue_action");
      assert.ok(overdueAlert, "should have an overdue_action alert");
      assert.equal(overdueAlert.severity, "critical");
      assert.equal(overdueAlert.status, "open");
      assert.equal(overdueAlert.building_id, b.id);
    });

    it("generates alert for missing diagnostic category", () => {
      const b = seedBuilding();
      // Only add one diagnostic category — 4 are missing
      createDiagnostic(b.id, { category: "energy", score: 80, findings: "OK" });

      const alerts = generateAlerts(b.id);

      const missingAlert = alerts.find((a) => a.type === "missing_diagnostic");
      assert.ok(missingAlert, "should have a missing_diagnostic alert");
      assert.equal(missingAlert.severity, "info");
      assert.ok(missingAlert.message.includes("asbestos"));
      assert.ok(missingAlert.message.includes("structure"));
      assert.ok(missingAlert.message.includes("fire"));
      assert.ok(missingAlert.message.includes("accessibility"));
    });

    it("generates alert for high-risk building", () => {
      const b = seedBuilding({ risk_level: "high" });

      const alerts = generateAlerts(b.id);

      const riskAlert = alerts.find((a) => a.type === "high_risk");
      assert.ok(riskAlert, "should have a high_risk alert");
      assert.equal(riskAlert.severity, "warning");
    });

    it("generates alert for stale evidence (no evidence at all)", () => {
      const b = seedBuilding();

      const alerts = generateAlerts(b.id);

      const staleAlert = alerts.find((a) => a.type === "stale_evidence");
      assert.ok(staleAlert, "should have a stale_evidence alert when no evidence");
      assert.equal(staleAlert.severity, "warning");
    });

    it("deduplication: generate twice does not create duplicates", () => {
      const b = seedBuilding({ risk_level: "high" });

      const first = generateAlerts(b.id);
      assert.ok(first.length > 0, "should create alerts on first call");

      const second = generateAlerts(b.id);
      assert.equal(second.length, 0, "should not create duplicates on second call");

      // Total alerts for this building should remain the same
      const all = listAlertsByBuilding(b.id);
      assert.equal(all.length, first.length);
    });

    it("returns empty array for unknown building", () => {
      const alerts = generateAlerts("999");
      assert.deepEqual(alerts, []);
    });
  });

  describe("generateAllAlerts", () => {
    it("scans all buildings", () => {
      const b1 = seedBuilding({ risk_level: "high" });
      const b2 = seedBuilding({ address: "Rue du Marché 10, 1204 Genève", risk_level: "critical" });

      const alerts = generateAllAlerts();

      const b1Alerts = alerts.filter((a) => a.building_id === b1.id);
      const b2Alerts = alerts.filter((a) => a.building_id === b2.id);
      assert.ok(b1Alerts.length > 0);
      assert.ok(b2Alerts.length > 0);
    });
  });

  // --- Query ---

  describe("getAlert", () => {
    it("returns alert by id", () => {
      const b = seedBuilding({ risk_level: "high" });
      const created = generateAlerts(b.id);
      assert.ok(created.length > 0);

      const found = getAlert(created[0].id);
      assert.equal(found.id, created[0].id);
    });

    it("returns null for unknown id", () => {
      assert.equal(getAlert("999"), null);
    });
  });

  describe("listAlertsByBuilding", () => {
    it("filters by building_id", () => {
      const b1 = seedBuilding();
      const b2 = seedBuilding({ address: "Rue du Marché 10, 1204 Genève" });
      generateAlerts(b1.id);
      generateAlerts(b2.id);

      const b1Alerts = listAlertsByBuilding(b1.id);
      assert.ok(b1Alerts.length > 0);
      assert.ok(b1Alerts.every((a) => a.building_id === b1.id));
    });
  });

  describe("listAllAlerts", () => {
    it("returns all alerts without filter", () => {
      const b = seedBuilding({ risk_level: "high" });
      generateAlerts(b.id);

      const all = listAllAlerts();
      assert.ok(all.length > 0);
    });

    it("filters by status", () => {
      const b = seedBuilding({ risk_level: "high" });
      const created = generateAlerts(b.id);
      assert.ok(created.length > 0);

      // Acknowledge one
      acknowledgeAlert(created[0].id);

      const openAlerts = listAllAlerts("open");
      const ackedAlerts = listAllAlerts("acknowledged");

      assert.ok(openAlerts.every((a) => a.status === "open"));
      assert.ok(ackedAlerts.every((a) => a.status === "acknowledged"));
      assert.equal(ackedAlerts.length, 1);
    });
  });

  // --- Workflow ---

  describe("acknowledgeAlert", () => {
    it("changes status to acknowledged", () => {
      const b = seedBuilding({ risk_level: "high" });
      const [alert] = generateAlerts(b.id);

      const result = acknowledgeAlert(alert.id);

      assert.equal(result.status, "acknowledged");
      assert.equal(result.id, alert.id);
    });

    it("returns null for unknown id", () => {
      assert.equal(acknowledgeAlert("999"), null);
    });
  });

  describe("resolveAlert", () => {
    it("changes status to resolved and sets resolved_at", () => {
      const b = seedBuilding({ risk_level: "high" });
      const [alert] = generateAlerts(b.id);

      const result = resolveAlert(alert.id, "Issue addressed");

      assert.equal(result.status, "resolved");
      assert.ok(result.resolved_at);
      assert.equal(result.notes, "Issue addressed");
    });

    it("returns null for unknown id", () => {
      assert.equal(resolveAlert("999", "test"), null);
    });
  });

  describe("clearAlertStore", () => {
    it("empties the store", () => {
      const b = seedBuilding({ risk_level: "high" });
      generateAlerts(b.id);
      assert.ok(alertStore.size > 0);

      clearAlertStore();
      assert.equal(alertStore.size, 0);
    });
  });
});
