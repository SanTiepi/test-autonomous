import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  validateEvidence,
  createEvidence,
  getEvidence,
  listEvidenceByBuilding,
  updateEvidenceStatus,
  deleteEvidence,
  clearEvidenceStore,
  evidenceStore,
} from "../../src/v2/evidence_engine.mjs";
import { createBuilding, clearBuildings } from "../../src/v2/building_registry.mjs";

const VALID_BUILDING = {
  address: "Bahnhofstrasse 1, 8001 Zürich",
  type: "commercial",
  year: 1990,
  risk_level: "low",
};

const VALID_EVIDENCE = {
  type: "document",
  title: "Asbestos inspection report",
};

describe("Evidence Engine", () => {
  let building;

  beforeEach(() => {
    clearEvidenceStore();
    clearBuildings();
    building = createBuilding(VALID_BUILDING);
  });

  // --- Validation ---

  describe("validateEvidence", () => {
    it("returns no errors for valid body", () => {
      const errors = validateEvidence(VALID_EVIDENCE);
      assert.deepEqual(errors, []);
    });

    it("rejects missing type", () => {
      const errors = validateEvidence({ title: "Report" });
      assert.ok(errors.some((e) => e.includes("type")));
    });

    it("rejects missing title", () => {
      const errors = validateEvidence({ type: "document" });
      assert.ok(errors.some((e) => e.includes("title")));
    });
  });

  // --- Create ---

  describe("createEvidence", () => {
    it("creates evidence for existing building", () => {
      const ev = createEvidence(building.id, VALID_EVIDENCE);
      assert.ok(ev.id);
      assert.equal(ev.building_id, building.id);
      assert.equal(ev.type, "document");
      assert.equal(ev.title, "Asbestos inspection report");
      assert.equal(ev.status, "pending");
      assert.ok(ev.submitted_at);
      assert.equal(ev.verified_at, null);
    });

    it("rejects evidence for non-existent building", () => {
      const ev = createEvidence("999", VALID_EVIDENCE);
      assert.equal(ev.error, "building not found");
    });
  });

  // --- Read ---

  describe("getEvidence", () => {
    it("returns evidence by id", () => {
      const created = createEvidence(building.id, VALID_EVIDENCE);
      const found = getEvidence(created.id);
      assert.equal(found.id, created.id);
    });

    it("returns null for unknown id", () => {
      assert.equal(getEvidence("999"), null);
    });
  });

  // --- List ---

  describe("listEvidenceByBuilding", () => {
    it("lists evidence for a building", () => {
      createEvidence(building.id, VALID_EVIDENCE);
      createEvidence(building.id, { ...VALID_EVIDENCE, title: "Fire cert" });
      const list = listEvidenceByBuilding(building.id);
      assert.equal(list.length, 2);
    });

    it("returns empty array for building with no evidence", () => {
      const list = listEvidenceByBuilding(building.id);
      assert.deepEqual(list, []);
    });
  });

  // --- Status transitions ---

  describe("updateEvidenceStatus", () => {
    it("transitions pending → verified", () => {
      const ev = createEvidence(building.id, VALID_EVIDENCE);
      const updated = updateEvidenceStatus(ev.id, "verified", "Looks good");
      assert.equal(updated.status, "verified");
      assert.equal(updated.notes, "Looks good");
      assert.ok(updated.verified_at);
    });

    it("transitions pending → rejected", () => {
      const ev = createEvidence(building.id, VALID_EVIDENCE);
      const updated = updateEvidenceStatus(ev.id, "rejected", "Insufficient");
      assert.equal(updated.status, "rejected");
      assert.equal(updated.notes, "Insufficient");
      assert.ok(updated.verified_at);
    });

    it("rejects invalid transition verified → pending", () => {
      const ev = createEvidence(building.id, VALID_EVIDENCE);
      updateEvidenceStatus(ev.id, "verified", "OK");
      const result = updateEvidenceStatus(ev.id, "pending", "Revert");
      assert.ok(result.error);
      assert.ok(result.error.includes("invalid transition"));
    });

    it("returns null for unknown id", () => {
      assert.equal(updateEvidenceStatus("999", "verified", "note"), null);
    });
  });

  // --- Delete ---

  describe("deleteEvidence", () => {
    it("deletes existing evidence", () => {
      const ev = createEvidence(building.id, VALID_EVIDENCE);
      assert.equal(deleteEvidence(ev.id), true);
      assert.equal(getEvidence(ev.id), null);
    });

    it("returns false for unknown id", () => {
      assert.equal(deleteEvidence("999"), false);
    });
  });

  // --- Store management ---

  describe("clearEvidenceStore", () => {
    it("clears all evidence", () => {
      createEvidence(building.id, VALID_EVIDENCE);
      assert.equal(evidenceStore.size, 1);
      clearEvidenceStore();
      assert.equal(evidenceStore.size, 0);
    });
  });
});
