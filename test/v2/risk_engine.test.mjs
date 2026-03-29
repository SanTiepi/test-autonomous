import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";

import { createBuilding, clearBuildings } from "../../src/v2/building_registry.mjs";
import { createEvidence, clearEvidenceStore } from "../../src/v2/evidence_engine.mjs";
import { createDiagnostic, clearDiagnosticStore } from "../../src/v2/diagnostic_tracker.mjs";
import { createAction, clearActionStore } from "../../src/v2/action_planner.mjs";
import {
  computeBuildingRisk,
  computePortfolioRisk,
  getRiskHistory,
  clearRiskStore,
  riskStore,
} from "../../src/v2/risk_engine.mjs";

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

function seedEvidence(buildingId) {
  return createEvidence(buildingId, { type: "report", title: "Annual report" });
}

describe("Risk Scoring Engine", () => {
  beforeEach(() => {
    clearBuildings();
    clearEvidenceStore();
    clearDiagnosticStore();
    clearActionStore();
    clearRiskStore();
  });

  // --- Building with no issues ---

  describe("building with no issues", () => {
    it("scores 100 with tier safe", () => {
      const b = seedBuilding();
      seedEvidence(b.id); // recent evidence avoids the -10 deduction

      const risk = computeBuildingRisk(b.id);

      assert.equal(risk.building_id, b.id);
      assert.equal(risk.score, 100);
      assert.equal(risk.tier, "safe");
      assert.equal(risk.factors.length, 0);
      assert.ok(risk.computed_at);
    });
  });

  // --- Critical diagnostic ---

  describe("building with critical diagnostic", () => {
    it("score drops by 20, factors mention critical", () => {
      const b = seedBuilding();
      seedEvidence(b.id);
      createDiagnostic(b.id, { category: "asbestos", score: 10, findings: "Asbestos found" });

      const risk = computeBuildingRisk(b.id);

      assert.ok(risk.score < 100);
      assert.ok(risk.score <= 80);
      assert.ok(risk.factors.some((f) => f.includes("critical")));
    });

    it("critical + warning both apply", () => {
      const b = seedBuilding();
      seedEvidence(b.id);
      createDiagnostic(b.id, { category: "asbestos", score: 10, findings: "Asbestos found" });
      createDiagnostic(b.id, { category: "energy", score: 50, findings: "Poor insulation" });

      const risk = computeBuildingRisk(b.id);

      // -20 (critical) -10 (warning) = 70
      assert.equal(risk.score, 70);
      assert.equal(risk.tier, "watch");
      assert.ok(risk.factors.some((f) => f.includes("critical")));
      assert.ok(risk.factors.some((f) => f.includes("warning")));
    });
  });

  // --- Overdue actions ---

  describe("building with overdue action", () => {
    it("score drops for overdue actions", () => {
      const b = seedBuilding();
      seedEvidence(b.id);

      // Create an action with a past due_date
      const action = createAction({
        building_id: b.id,
        title: "Overdue repair",
        due_date: "2020-01-01",
      });

      const risk = computeBuildingRisk(b.id);

      // -15 (overdue) -5 (1 open action) = 80
      assert.equal(risk.score, 80);
      assert.equal(risk.tier, "safe");
      assert.ok(risk.factors.some((f) => f.includes("overdue")));
      assert.ok(risk.factors.some((f) => f.includes("open")));
    });
  });

  // --- No evidence ---

  describe("building with no evidence", () => {
    it("score drops by 10 for missing evidence", () => {
      const b = seedBuilding();
      // No evidence submitted

      const risk = computeBuildingRisk(b.id);

      assert.equal(risk.score, 90);
      assert.ok(risk.factors.some((f) => f.includes("no evidence")));
    });
  });

  // --- Portfolio risk ---

  describe("computePortfolioRisk", () => {
    it("sorts worst first (ascending score)", () => {
      const b1 = seedBuilding({ address: "Safe Building, Zürich" });
      seedEvidence(b1.id);

      const b2 = seedBuilding({ address: "Risky Building, Bern" });
      seedEvidence(b2.id);
      createDiagnostic(b2.id, { category: "structure", score: 10, findings: "Foundation cracks" });

      const portfolio = computePortfolioRisk();

      assert.equal(portfolio.length, 2);
      // b2 should be first (lower score = worse)
      assert.equal(portfolio[0].building_id, b2.id);
      assert.equal(portfolio[0].address, "Risky Building, Bern");
      assert.ok(portfolio[0].score < portfolio[1].score);
      // b1 should be second (higher score = safer)
      assert.equal(portfolio[1].building_id, b1.id);
    });

    it("includes address and tier", () => {
      const b = seedBuilding({ address: "Test Building" });
      seedEvidence(b.id);

      const portfolio = computePortfolioRisk();

      assert.equal(portfolio.length, 1);
      assert.equal(portfolio[0].address, "Test Building");
      assert.ok(portfolio[0].tier);
    });
  });

  // --- Tier boundaries ---

  describe("tier computation at boundaries", () => {
    it("score 80 is safe", () => {
      const b = seedBuilding();
      seedEvidence(b.id);
      // one open action with past due date: -15 -5 = 80
      createAction({ building_id: b.id, title: "Overdue task", due_date: "2020-01-01" });

      const risk = computeBuildingRisk(b.id);
      assert.equal(risk.score, 80);
      assert.equal(risk.tier, "safe");
    });

    it("score 79 is watch", () => {
      const b = seedBuilding();
      seedEvidence(b.id);
      // one overdue action (-15 -5) + warning diagnostic (-10) = 70, not 79
      // Let's get exactly 79 impossible with integer deductions, so test 70 = watch
      // overdue (-15) + open (-5) + warning (-10) = 70
      createAction({ building_id: b.id, title: "Overdue task", due_date: "2020-01-01" });
      createDiagnostic(b.id, { category: "energy", score: 50, findings: "Poor insulation" });

      const risk = computeBuildingRisk(b.id);
      assert.equal(risk.score, 70);
      assert.equal(risk.tier, "watch");
    });

    it("score 60 is watch", () => {
      const b = seedBuilding();
      seedEvidence(b.id);
      // critical (-20) + warning (-10) + 2 open actions (-10) = 60
      createDiagnostic(b.id, { category: "asbestos", score: 10, findings: "Asbestos" });
      createDiagnostic(b.id, { category: "energy", score: 50, findings: "Poor insulation" });
      createAction({ building_id: b.id, title: "Task A" });
      createAction({ building_id: b.id, title: "Task B" });

      const risk = computeBuildingRisk(b.id);
      assert.equal(risk.score, 60);
      assert.equal(risk.tier, "watch");
    });

    it("score 40 is at_risk", () => {
      const b = seedBuilding();
      // no evidence (-10) + critical (-20) + warning (-10) + overdue (-15) + 1 open (-5) = 40
      createDiagnostic(b.id, { category: "asbestos", score: 10, findings: "Asbestos" });
      createDiagnostic(b.id, { category: "energy", score: 50, findings: "Poor insulation" });
      createAction({ building_id: b.id, title: "Overdue task", due_date: "2020-01-01" });

      const risk = computeBuildingRisk(b.id);
      assert.equal(risk.score, 40);
      assert.equal(risk.tier, "at_risk");
    });

    it("score below 40 is critical", () => {
      const b = seedBuilding();
      // no evidence (-10) + critical (-20) + warning (-10) + overdue (-15) + 3 open (-15) = 30
      createDiagnostic(b.id, { category: "asbestos", score: 10, findings: "Asbestos" });
      createDiagnostic(b.id, { category: "energy", score: 50, findings: "Poor insulation" });
      createAction({ building_id: b.id, title: "Overdue task", due_date: "2020-01-01" });
      createAction({ building_id: b.id, title: "Task B" });
      createAction({ building_id: b.id, title: "Task C" });

      const risk = computeBuildingRisk(b.id);
      assert.equal(risk.score, 30);
      assert.equal(risk.tier, "critical");
    });
  });

  // --- Risk history ---

  describe("getRiskHistory", () => {
    it("stores multiple computations", () => {
      const b = seedBuilding();
      seedEvidence(b.id);

      computeBuildingRisk(b.id);
      computeBuildingRisk(b.id);

      const history = getRiskHistory(b.id);
      assert.equal(history.length, 2);
    });

    it("returns empty array for unknown building", () => {
      assert.deepEqual(getRiskHistory("999"), []);
    });
  });

  // --- Edge cases ---

  describe("edge cases", () => {
    it("returns null for non-existent building", () => {
      assert.equal(computeBuildingRisk("999"), null);
    });

    it("clearRiskStore empties the store", () => {
      const b = seedBuilding();
      seedEvidence(b.id);
      computeBuildingRisk(b.id);
      assert.equal(riskStore.size, 1);
      clearRiskStore();
      assert.equal(riskStore.size, 0);
    });

    it("score does not go below 0", () => {
      const b = seedBuilding();
      // no evidence (-10) + critical (-20) + warning (-10) + overdue (-15) + many open actions
      createDiagnostic(b.id, { category: "asbestos", score: 10, findings: "Asbestos" });
      createDiagnostic(b.id, { category: "energy", score: 50, findings: "Poor" });
      for (let i = 0; i < 20; i++) {
        createAction({ building_id: b.id, title: `Task ${i}`, due_date: "2020-01-01" });
      }

      const risk = computeBuildingRisk(b.id);
      assert.ok(risk.score >= 0);
      assert.equal(risk.tier, "critical");
    });
  });
});
