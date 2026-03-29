// Evidence Engine — in-memory store for evidence/proofs attached to buildings

import { getBuilding } from "./building_registry.mjs";

const evidenceStore = new Map();
let nextId = 1;

const VALID_TYPES = ["photo", "document", "report", "certificate", "inspection", "other"];
const VALID_STATUSES = ["pending", "verified", "rejected"];
const ALLOWED_TRANSITIONS = {
  pending: ["verified", "rejected"],
  verified: [],
  rejected: [],
};

// --- Validation ---

export function validateEvidence(body) {
  const errors = [];

  if (typeof body.type !== "string" || !VALID_TYPES.includes(body.type)) {
    errors.push(`type: required, one of ${VALID_TYPES.join(", ")}`);
  }

  if (typeof body.title !== "string" || body.title.trim().length === 0) {
    errors.push("title: required non-empty string");
  }

  return errors;
}

// --- CRUD ---

export function createEvidence(buildingId, body) {
  const building = getBuilding(buildingId);
  if (!building) {
    return { error: "building not found" };
  }

  const id = String(nextId++);
  const evidence = {
    id,
    building_id: buildingId,
    type: body.type,
    title: body.title.trim(),
    status: "pending",
    submitted_at: new Date().toISOString(),
    verified_at: null,
    notes: body.notes || null,
  };
  evidenceStore.set(id, evidence);
  return evidence;
}

export function getEvidence(id) {
  return evidenceStore.get(id) || null;
}

export function listEvidenceByBuilding(buildingId) {
  return [...evidenceStore.values()].filter((e) => e.building_id === buildingId);
}

export function updateEvidenceStatus(id, status, notes) {
  const evidence = evidenceStore.get(id);
  if (!evidence) return null;

  const allowed = ALLOWED_TRANSITIONS[evidence.status];
  if (!allowed || !allowed.includes(status)) {
    return { error: `invalid transition: ${evidence.status} → ${status}` };
  }

  evidence.status = status;
  evidence.notes = notes ?? evidence.notes;
  if (status === "verified" || status === "rejected") {
    evidence.verified_at = new Date().toISOString();
  }
  return evidence;
}

export function deleteEvidence(id) {
  return evidenceStore.delete(id);
}

// --- Store management (for testing) ---

export function clearEvidenceStore() {
  evidenceStore.clear();
  nextId = 1;
}

export { evidenceStore };
