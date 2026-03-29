import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";

import { createBuilding, clearBuildings } from "../../src/v2/building_registry.mjs";
import { createEvidence, clearEvidenceStore } from "../../src/v2/evidence_engine.mjs";
import { createDiagnostic, clearDiagnosticStore } from "../../src/v2/diagnostic_tracker.mjs";
import { createAction, clearActionStore } from "../../src/v2/action_planner.mjs";
import {
  generateDossier,
  exportDossierAsJson,
  clearDossierCache,
} from "../../src/v2/dossier.mjs";

// --- Helpers ---

function seedBuilding(overrides = {}) {
  return createBuilding({
    address: "Bahnhofstrasse 1, 8001 Zürich",
    type: "commercial",
    year: 1990,
    risk_level: "high",
    ...overrides,
  });
}

describe("Dossier", () => {
  beforeEach(() => {
    clearBuildings();
    clearEvidenceStore();
    clearDiagnosticStore();
    clearActionStore();
    clearDossierCache();
  });

  describe("generateDossier", () => {
    it("includes building, evidence, diagnostics, and actions", () => {
      const b = seedBuilding();
      createEvidence(b.id, { type: "document", title: "Inspection report" });
      createDiagnostic(b.id, { category: "asbestos", score: 80, findings: "Clear" });
      createAction({ building_id: b.id, title: "Annual review" });

      const dossier = generateDossier(b.id);

      assert.ok(dossier);
      assert.equal(dossier.building.id, b.id);
      assert.equal(dossier.evidence.length, 1);
      assert.equal(dossier.diagnostics.length, 1);
      assert.equal(dossier.actions.length, 1);
      assert.ok(dossier.generated_at);
    });

    it("reports missing categories in completeness", () => {
      const b = seedBuilding();
      createDiagnostic(b.id, { category: "asbestos", score: 80, findings: "Clear" });
      createDiagnostic(b.id, { category: "energy", score: 70, findings: "OK" });

      const dossier = generateDossier(b.id);

      assert.equal(dossier.completeness.has_all_categories, false);
      assert.deepEqual(
        dossier.completeness.missing_categories.sort(),
        ["accessibility", "fire", "structure"]
      );
    });

    it("has_all_categories is true when all 5 are covered", () => {
      const b = seedBuilding();
      for (const cat of ["asbestos", "energy", "structure", "fire", "accessibility"]) {
        createDiagnostic(b.id, { category: cat, score: 80, findings: "OK" });
      }

      const dossier = generateDossier(b.id);

      assert.equal(dossier.completeness.has_all_categories, true);
      assert.deepEqual(dossier.completeness.missing_categories, []);
    });

    it("has_recent_evidence is true when evidence submitted within last 365 days", () => {
      const b = seedBuilding();
      // createEvidence sets submitted_at to now, which is recent
      createEvidence(b.id, { type: "photo", title: "Facade photo" });

      const dossier = generateDossier(b.id);
      assert.equal(dossier.completeness.has_recent_evidence, true);
    });

    it("has_recent_evidence is false when no evidence exists", () => {
      const b = seedBuilding();

      const dossier = generateDossier(b.id);
      assert.equal(dossier.completeness.has_recent_evidence, false);
    });

    it("returns null for non-existent building", () => {
      const dossier = generateDossier("999");
      assert.equal(dossier, null);
    });

    it("completeness counts are correct", () => {
      const b = seedBuilding();
      createEvidence(b.id, { type: "document", title: "Doc 1" });
      createEvidence(b.id, { type: "photo", title: "Photo 1" });
      createDiagnostic(b.id, { category: "asbestos", score: 50, findings: "Needs review" });
      createAction({ building_id: b.id, title: "Action A" });
      createAction({ building_id: b.id, title: "Action B" });
      createAction({ building_id: b.id, title: "Action C" });

      const dossier = generateDossier(b.id);

      assert.equal(dossier.completeness.evidence_count, 2);
      assert.equal(dossier.completeness.diagnostic_count, 1);
      assert.equal(dossier.completeness.action_count, 3);
    });
  });

  describe("exportDossierAsJson", () => {
    it("returns valid JSON string", () => {
      const b = seedBuilding();
      createEvidence(b.id, { type: "document", title: "Test doc" });

      const jsonStr = exportDossierAsJson(b.id);

      assert.equal(typeof jsonStr, "string");
      const parsed = JSON.parse(jsonStr);
      assert.equal(parsed.building.id, b.id);
      assert.ok(parsed.completeness);
      assert.ok(parsed.generated_at);
    });

    it("returns null for non-existent building", () => {
      const result = exportDossierAsJson("999");
      assert.equal(result, null);
    });
  });

  describe("clearDossierCache", () => {
    it("clears the cache so dossier is regenerated", () => {
      const b = seedBuilding();
      const first = generateDossier(b.id);
      assert.equal(first.evidence.length, 0);

      // Add evidence after caching
      createEvidence(b.id, { type: "document", title: "New doc" });

      // Should still return cached version
      const cached = generateDossier(b.id);
      assert.equal(cached.evidence.length, 0);

      // After clearing cache, regeneration picks up new evidence
      clearDossierCache();
      const refreshed = generateDossier(b.id);
      assert.equal(refreshed.evidence.length, 1);
    });
  });
});
