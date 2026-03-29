import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  validateDiagnostic,
  createDiagnostic,
  getDiagnostic,
  listDiagnosticsByBuilding,
  updateDiagnostic,
  deleteDiagnostic,
  getDiagnosticSummary,
  clearDiagnosticStore,
  diagnosticStore,
} from "../../src/v2/diagnostic_tracker.mjs";
import { createBuilding, clearBuildings } from "../../src/v2/building_registry.mjs";

const VALID_BUILDING = {
  address: "Bahnhofstrasse 1, 8001 Zürich",
  type: "commercial",
  year: 1990,
  risk_level: "low",
};

const VALID_DIAGNOSTIC = {
  category: "energy",
  score: 75,
  findings: "Good insulation, minor window leaks",
};

describe("Diagnostic Tracker", () => {
  let building;

  beforeEach(() => {
    clearDiagnosticStore();
    clearBuildings();
    building = createBuilding(VALID_BUILDING);
  });

  // --- Validation ---

  describe("validateDiagnostic", () => {
    it("returns no errors for valid body", () => {
      const errors = validateDiagnostic(VALID_DIAGNOSTIC);
      assert.deepEqual(errors, []);
    });

    it("rejects invalid category", () => {
      const errors = validateDiagnostic({ ...VALID_DIAGNOSTIC, category: "plumbing" });
      assert.ok(errors.some((e) => e.includes("category")));
    });

    it("rejects score out of range", () => {
      const errors = validateDiagnostic({ ...VALID_DIAGNOSTIC, score: 150 });
      assert.ok(errors.some((e) => e.includes("score")));
    });

    it("rejects missing findings", () => {
      const errors = validateDiagnostic({ category: "energy", score: 50 });
      assert.ok(errors.some((e) => e.includes("findings")));
    });
  });

  // --- Create with severity computation ---

  describe("createDiagnostic", () => {
    it("creates diagnostic and computes severity", () => {
      const diag = createDiagnostic(building.id, VALID_DIAGNOSTIC);
      assert.ok(diag.id);
      assert.equal(diag.building_id, building.id);
      assert.equal(diag.category, "energy");
      assert.equal(diag.score, 75);
      assert.equal(diag.severity, "ok");
      assert.ok(diag.assessed_at);
    });

    it("score 80 → severity ok", () => {
      const diag = createDiagnostic(building.id, { ...VALID_DIAGNOSTIC, score: 80 });
      assert.equal(diag.severity, "ok");
    });

    it("score 50 → severity warning", () => {
      const diag = createDiagnostic(building.id, { ...VALID_DIAGNOSTIC, score: 50 });
      assert.equal(diag.severity, "warning");
    });

    it("score 30 → severity critical", () => {
      const diag = createDiagnostic(building.id, { ...VALID_DIAGNOSTIC, score: 30 });
      assert.equal(diag.severity, "critical");
    });

    it("rejects diagnostic for non-existent building", () => {
      const diag = createDiagnostic("999", VALID_DIAGNOSTIC);
      assert.equal(diag.error, "building not found");
    });
  });

  // --- Read ---

  describe("getDiagnostic", () => {
    it("returns diagnostic by id", () => {
      const created = createDiagnostic(building.id, VALID_DIAGNOSTIC);
      const found = getDiagnostic(created.id);
      assert.equal(found.id, created.id);
    });

    it("returns null for unknown id", () => {
      assert.equal(getDiagnostic("999"), null);
    });
  });

  // --- List ---

  describe("listDiagnosticsByBuilding", () => {
    it("lists diagnostics for a building", () => {
      createDiagnostic(building.id, VALID_DIAGNOSTIC);
      createDiagnostic(building.id, { ...VALID_DIAGNOSTIC, category: "fire", score: 40 });
      const list = listDiagnosticsByBuilding(building.id);
      assert.equal(list.length, 2);
    });

    it("returns empty array for building with no diagnostics", () => {
      assert.deepEqual(listDiagnosticsByBuilding(building.id), []);
    });
  });

  // --- Update ---

  describe("updateDiagnostic", () => {
    it("updates and recomputes severity", () => {
      const diag = createDiagnostic(building.id, VALID_DIAGNOSTIC);
      assert.equal(diag.severity, "ok"); // score 75
      const updated = updateDiagnostic(diag.id, { score: 35 });
      assert.equal(updated.score, 35);
      assert.equal(updated.severity, "critical");
    });

    it("returns null for unknown id", () => {
      assert.equal(updateDiagnostic("999", { score: 50 }), null);
    });
  });

  // --- Delete ---

  describe("deleteDiagnostic", () => {
    it("deletes existing diagnostic", () => {
      const diag = createDiagnostic(building.id, VALID_DIAGNOSTIC);
      assert.equal(deleteDiagnostic(diag.id), true);
      assert.equal(getDiagnostic(diag.id), null);
    });

    it("returns false for unknown id", () => {
      assert.equal(deleteDiagnostic("999"), false);
    });
  });

  // --- Summary ---

  describe("getDiagnosticSummary", () => {
    it("returns summary for building with multiple diagnostics", () => {
      createDiagnostic(building.id, { category: "energy", score: 80, findings: "Good" });
      createDiagnostic(building.id, { category: "fire", score: 50, findings: "Needs work" });
      createDiagnostic(building.id, { category: "asbestos", score: 30, findings: "Dangerous" });

      const summary = getDiagnosticSummary(building.id);
      assert.equal(summary.building_id, building.id);

      // Check categories
      assert.equal(summary.categories.energy.latest_score, 80);
      assert.equal(summary.categories.energy.severity, "ok");
      assert.equal(summary.categories.energy.count, 1);

      assert.equal(summary.categories.fire.latest_score, 50);
      assert.equal(summary.categories.fire.severity, "warning");
      assert.equal(summary.categories.fire.count, 1);

      assert.equal(summary.categories.asbestos.latest_score, 30);
      assert.equal(summary.categories.asbestos.severity, "critical");
      assert.equal(summary.categories.asbestos.count, 1);

      // Overall risk should be critical (worst)
      assert.equal(summary.overall_risk, "critical");
    });

    it("returns empty summary for building with no diagnostics", () => {
      const summary = getDiagnosticSummary(building.id);
      assert.equal(summary.building_id, building.id);
      assert.deepEqual(summary.categories, {});
      assert.equal(summary.overall_risk, "ok");
    });
  });

  // --- Store management ---

  describe("clearDiagnosticStore", () => {
    it("clears all diagnostics", () => {
      createDiagnostic(building.id, VALID_DIAGNOSTIC);
      assert.equal(diagnosticStore.size, 1);
      clearDiagnosticStore();
      assert.equal(diagnosticStore.size, 0);
    });
  });
});
