import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";

import { createBuilding, clearBuildings } from "../../src/v2/building_registry.mjs";
import { createEvidence, clearEvidenceStore } from "../../src/v2/evidence_engine.mjs";
import { createDiagnostic, clearDiagnosticStore } from "../../src/v2/diagnostic_tracker.mjs";
import {
  createAction,
  updateActionStatus,
  clearActionStore,
} from "../../src/v2/action_planner.mjs";
import {
  getPortfolioSummary,
  getRiskBreakdown,
  getCompletionStats,
  getBacklogStats,
} from "../../src/v2/portfolio_dashboard.mjs";

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

describe("Portfolio Dashboard", () => {
  beforeEach(() => {
    clearBuildings();
    clearEvidenceStore();
    clearDiagnosticStore();
    clearActionStore();
  });

  // --- Empty portfolio ---

  describe("empty portfolio", () => {
    it("getPortfolioSummary returns zeros", () => {
      const summary = getPortfolioSummary();
      assert.equal(summary.total_buildings, 0);
      assert.equal(summary.total_evidence, 0);
      assert.equal(summary.total_diagnostics, 0);
      assert.equal(summary.total_actions, 0);
      assert.deepEqual(summary.buildings_by_risk, { low: 0, medium: 0, high: 0, critical: 0 });
    });

    it("getRiskBreakdown returns empty array", () => {
      assert.deepEqual(getRiskBreakdown(), []);
    });

    it("getCompletionStats returns zeros", () => {
      const stats = getCompletionStats();
      assert.equal(stats.actions_open, 0);
      assert.equal(stats.actions_completed, 0);
      assert.equal(stats.actions_in_progress, 0);
      assert.equal(stats.completion_rate, 0);
    });

    it("getBacklogStats returns zeros", () => {
      const stats = getBacklogStats();
      assert.equal(stats.overdue_actions, 0);
      assert.equal(stats.urgent_actions, 0);
      assert.equal(stats.high_priority, 0);
    });
  });

  // --- Portfolio Summary ---

  describe("getPortfolioSummary", () => {
    it("returns correct counts", () => {
      const b1 = seedBuilding({ risk_level: "high" });
      const b2 = seedBuilding({ address: "Rue du Marché 10", risk_level: "low" });

      createEvidence(b1.id, { type: "photo", title: "Front photo" });
      createEvidence(b1.id, { type: "report", title: "Annual report" });
      createEvidence(b2.id, { type: "certificate", title: "Energy cert" });

      createDiagnostic(b1.id, { category: "asbestos", score: 10, findings: "Found" });
      createDiagnostic(b2.id, { category: "energy", score: 55, findings: "Poor" });

      createAction({ building_id: b1.id, title: "Fix A" });
      createAction({ building_id: b2.id, title: "Fix B" });

      const summary = getPortfolioSummary();
      assert.equal(summary.total_buildings, 2);
      assert.equal(summary.total_evidence, 3);
      assert.equal(summary.total_diagnostics, 2);
      assert.equal(summary.total_actions, 2);
      assert.deepEqual(summary.buildings_by_risk, { low: 1, medium: 0, high: 1, critical: 0 });
    });
  });

  // --- Risk Breakdown ---

  describe("getRiskBreakdown", () => {
    it("lists all buildings with their stats", () => {
      const b1 = seedBuilding({ risk_level: "critical" });
      const b2 = seedBuilding({ address: "Paradeplatz 8", risk_level: "low" });

      createDiagnostic(b1.id, { category: "structure", score: 20, findings: "Cracks" });
      createDiagnostic(b1.id, { category: "fire", score: 30, findings: "No alarms" });
      createEvidence(b1.id, { type: "photo", title: "Crack photo" });
      createAction({ building_id: b1.id, title: "Fix cracks" });

      const breakdown = getRiskBreakdown();
      assert.equal(breakdown.length, 2);

      const entry1 = breakdown.find((e) => e.building_id === b1.id);
      assert.equal(entry1.risk_level, "critical");
      assert.equal(entry1.diagnostic_count, 2);
      assert.equal(entry1.action_count, 1);
      assert.equal(entry1.evidence_count, 1);

      const entry2 = breakdown.find((e) => e.building_id === b2.id);
      assert.equal(entry2.risk_level, "low");
      assert.equal(entry2.diagnostic_count, 0);
      assert.equal(entry2.action_count, 0);
      assert.equal(entry2.evidence_count, 0);
    });

    it("includes address in each entry", () => {
      seedBuilding({ address: "Specific Address 42" });
      const breakdown = getRiskBreakdown();
      assert.equal(breakdown[0].address, "Specific Address 42");
    });
  });

  // --- Completion Stats ---

  describe("getCompletionStats", () => {
    it("computes correct rates", () => {
      const b = seedBuilding();

      const a1 = createAction({ building_id: b.id, title: "A1" });
      const a2 = createAction({ building_id: b.id, title: "A2" });
      const a3 = createAction({ building_id: b.id, title: "A3" });
      const a4 = createAction({ building_id: b.id, title: "A4" });

      updateActionStatus(a1.id, "completed");
      updateActionStatus(a2.id, "completed");
      updateActionStatus(a3.id, "in_progress");
      // a4 stays open

      const stats = getCompletionStats();
      assert.equal(stats.actions_open, 1);
      assert.equal(stats.actions_completed, 2);
      assert.equal(stats.actions_in_progress, 1);
      assert.equal(stats.completion_rate, 0.5);
    });

    it("returns 0 rate when no actions exist", () => {
      const stats = getCompletionStats();
      assert.equal(stats.completion_rate, 0);
    });
  });

  // --- Backlog Stats ---

  describe("getBacklogStats", () => {
    it("counts urgent and high priority actions", () => {
      const b = seedBuilding();

      createAction({ building_id: b.id, title: "Urgent A", priority: "urgent" });
      createAction({ building_id: b.id, title: "Urgent B", priority: "urgent" });
      createAction({ building_id: b.id, title: "High A", priority: "high" });
      createAction({ building_id: b.id, title: "Low A", priority: "low" });

      const stats = getBacklogStats();
      assert.equal(stats.urgent_actions, 2);
      assert.equal(stats.high_priority, 1);
    });

    it("counts overdue actions", () => {
      const b = seedBuilding();

      createAction({ building_id: b.id, title: "Overdue", priority: "medium", due_date: "2020-01-01" });
      createAction({ building_id: b.id, title: "Future", priority: "medium", due_date: "2099-01-01" });
      createAction({ building_id: b.id, title: "No date", priority: "medium" });

      const stats = getBacklogStats();
      assert.equal(stats.overdue_actions, 1);
    });

    it("excludes completed and cancelled from backlog", () => {
      const b = seedBuilding();

      const a1 = createAction({ building_id: b.id, title: "Done urgent", priority: "urgent" });
      const a2 = createAction({ building_id: b.id, title: "Cancelled high", priority: "high" });
      createAction({ building_id: b.id, title: "Active urgent", priority: "urgent" });

      updateActionStatus(a1.id, "completed");
      updateActionStatus(a2.id, "cancelled");

      const stats = getBacklogStats();
      assert.equal(stats.urgent_actions, 1);
      assert.equal(stats.high_priority, 0);
    });
  });
});
