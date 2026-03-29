import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";

import { createBuilding, clearBuildings } from "../../src/v2/building_registry.mjs";
import { createDiagnostic, clearDiagnosticStore } from "../../src/v2/diagnostic_tracker.mjs";
import {
  generateActionsFromDiagnostics,
  createAction,
  getAction,
  listActionsByBuilding,
  updateActionStatus,
  deleteAction,
  clearActionStore,
  actionStore,
} from "../../src/v2/action_planner.mjs";

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

describe("Action Planner", () => {
  beforeEach(() => {
    clearBuildings();
    clearDiagnosticStore();
    clearActionStore();
  });

  // --- Generation ---

  describe("generateActionsFromDiagnostics", () => {
    it("creates actions for critical diagnostics", () => {
      const b = seedBuilding();
      createDiagnostic(b.id, { category: "asbestos", score: 10, findings: "Asbestos found in walls" });
      createDiagnostic(b.id, { category: "structure", score: 20, findings: "Foundation cracks" });

      const actions = generateActionsFromDiagnostics(b.id);

      assert.equal(actions.length, 2);
      const titles = actions.map((a) => a.title).sort();
      assert.deepEqual(titles, ["Asbestos removal", "Structural reinforcement"]);
      assert.ok(actions.every((a) => a.building_id === b.id));
      assert.ok(actions.every((a) => a.status === "open"));
    });

    it("creates actions for warning diagnostics", () => {
      const b = seedBuilding();
      createDiagnostic(b.id, { category: "energy", score: 50, findings: "Poor insulation" });

      const actions = generateActionsFromDiagnostics(b.id);

      assert.equal(actions.length, 1);
      assert.equal(actions[0].title, "Energy audit");
      assert.equal(actions[0].priority, "medium");
    });

    it("does not create actions for ok diagnostics", () => {
      const b = seedBuilding();
      createDiagnostic(b.id, { category: "energy", score: 85, findings: "All good" });

      const actions = generateActionsFromDiagnostics(b.id);
      assert.equal(actions.length, 0);
    });

    it("deduplication: calling generate twice does not create duplicates", () => {
      const b = seedBuilding();
      createDiagnostic(b.id, { category: "asbestos", score: 10, findings: "Asbestos found" });

      const first = generateActionsFromDiagnostics(b.id);
      assert.equal(first.length, 1);

      const second = generateActionsFromDiagnostics(b.id);
      assert.equal(second.length, 0);

      // Store still has exactly 1 action
      assert.equal(listActionsByBuilding(b.id).length, 1);
    });

    it("returns empty array for unknown building", () => {
      const actions = generateActionsFromDiagnostics("999");
      assert.deepEqual(actions, []);
    });

    it("assigns correct priority per rule", () => {
      const b = seedBuilding();
      createDiagnostic(b.id, { category: "fire", score: 15, findings: "No alarms" });

      const actions = generateActionsFromDiagnostics(b.id);
      assert.equal(actions.length, 1);
      assert.equal(actions[0].title, "Fire safety overhaul");
      assert.equal(actions[0].priority, "urgent");
    });
  });

  // --- CRUD ---

  describe("createAction", () => {
    it("creates a manual action", () => {
      const b = seedBuilding();
      const action = createAction({
        building_id: b.id,
        title: "Roof repair",
        priority: "high",
        estimated_cost: 50000,
      });

      assert.ok(action.id);
      assert.equal(action.building_id, b.id);
      assert.equal(action.title, "Roof repair");
      assert.equal(action.priority, "high");
      assert.equal(action.status, "open");
      assert.equal(action.estimated_cost, 50000);
    });

    it("rejects missing building_id", () => {
      const result = createAction({ title: "Test" });
      assert.ok(result.error);
    });

    it("rejects missing title", () => {
      const result = createAction({ building_id: "1", title: "" });
      assert.ok(result.error);
    });

    it("rejects invalid priority", () => {
      const result = createAction({ building_id: "1", title: "X", priority: "extreme" });
      assert.ok(result.error);
    });
  });

  describe("getAction", () => {
    it("returns action by id", () => {
      const b = seedBuilding();
      const created = createAction({ building_id: b.id, title: "Test action" });
      const found = getAction(created.id);
      assert.equal(found.id, created.id);
      assert.equal(found.title, "Test action");
    });

    it("returns null for unknown id", () => {
      assert.equal(getAction("999"), null);
    });
  });

  describe("updateActionStatus", () => {
    it("updates status to in_progress", () => {
      const b = seedBuilding();
      const action = createAction({ building_id: b.id, title: "Fix thing" });
      const updated = updateActionStatus(action.id, "in_progress");
      assert.equal(updated.status, "in_progress");
    });

    it("updates status to completed", () => {
      const b = seedBuilding();
      const action = createAction({ building_id: b.id, title: "Fix thing" });
      const updated = updateActionStatus(action.id, "completed");
      assert.equal(updated.status, "completed");
    });

    it("returns null for unknown id", () => {
      assert.equal(updateActionStatus("999", "completed"), null);
    });

    it("rejects invalid status", () => {
      const b = seedBuilding();
      const action = createAction({ building_id: b.id, title: "Fix thing" });
      const result = updateActionStatus(action.id, "done");
      assert.ok(result.error);
    });
  });

  describe("listActionsByBuilding", () => {
    it("filters by building_id", () => {
      const b1 = seedBuilding();
      const b2 = seedBuilding({ address: "Rue du Marché 10, 1204 Genève" });

      createAction({ building_id: b1.id, title: "Action A" });
      createAction({ building_id: b1.id, title: "Action B" });
      createAction({ building_id: b2.id, title: "Action C" });

      const b1Actions = listActionsByBuilding(b1.id);
      assert.equal(b1Actions.length, 2);
      assert.ok(b1Actions.every((a) => a.building_id === b1.id));

      const b2Actions = listActionsByBuilding(b2.id);
      assert.equal(b2Actions.length, 1);
      assert.equal(b2Actions[0].title, "Action C");
    });

    it("returns empty for building with no actions", () => {
      const b = seedBuilding();
      assert.deepEqual(listActionsByBuilding(b.id), []);
    });
  });

  describe("deleteAction", () => {
    it("deletes an action", () => {
      const b = seedBuilding();
      const action = createAction({ building_id: b.id, title: "To delete" });
      assert.equal(deleteAction(action.id), true);
      assert.equal(getAction(action.id), null);
    });

    it("returns false for unknown id", () => {
      assert.equal(deleteAction("999"), false);
    });
  });

  describe("clearActionStore", () => {
    it("empties the store", () => {
      const b = seedBuilding();
      createAction({ building_id: b.id, title: "Test" });
      assert.equal(actionStore.size, 1);
      clearActionStore();
      assert.equal(actionStore.size, 0);
    });
  });
});
