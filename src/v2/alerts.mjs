// Alerts — alert generation and review workflow

import { listBuildings, getBuilding } from "./building_registry.mjs";
import { listEvidenceByBuilding } from "./evidence_engine.mjs";
import { listDiagnosticsByBuilding } from "./diagnostic_tracker.mjs";
import { listActionsByBuilding } from "./action_planner.mjs";

const alertStore = new Map();
let nextId = 1;

const ALL_CATEGORIES = ["asbestos", "energy", "structure", "fire", "accessibility"];
const STALE_EVIDENCE_DAYS = 365;

// --- Deduplication ---

function dedupeKey(buildingId, type) {
  return `${buildingId}:${type}`;
}

function existingOpenKeys() {
  const keys = new Set();
  for (const alert of alertStore.values()) {
    if (alert.status !== "resolved") {
      keys.add(dedupeKey(alert.building_id, alert.type));
    }
  }
  return keys;
}

// --- Alert creation helper ---

function createAlert(buildingId, type, message, severity) {
  const id = String(nextId++);
  const alert = {
    id,
    building_id: buildingId,
    type,
    message,
    severity,
    status: "open",
    created_at: new Date().toISOString(),
    resolved_at: null,
  };
  alertStore.set(id, alert);
  return alert;
}

// --- Generation ---

export function generateAlerts(buildingId) {
  const building = getBuilding(buildingId);
  if (!building) return [];

  const existing = existingOpenKeys();
  const created = [];

  // Check for stale evidence
  const evidence = listEvidenceByBuilding(buildingId);
  const now = Date.now();
  const staleThreshold = now - STALE_EVIDENCE_DAYS * 24 * 60 * 60 * 1000;
  const allStale = evidence.length > 0 && evidence.every((e) => new Date(e.submitted_at).getTime() < staleThreshold);
  const noEvidence = evidence.length === 0;

  if (allStale || noEvidence) {
    const key = dedupeKey(buildingId, "stale_evidence");
    if (!existing.has(key)) {
      const msg = noEvidence
        ? `Building ${buildingId} has no evidence on file`
        : `Building ${buildingId} has no recent evidence (all older than ${STALE_EVIDENCE_DAYS} days)`;
      const alert = createAlert(buildingId, "stale_evidence", msg, "warning");
      existing.add(key);
      created.push(alert);
    }
  }

  // Check for overdue actions
  const actions = listActionsByBuilding(buildingId);
  const hasOverdue = actions.some((a) => {
    if (a.status === "completed" || a.status === "cancelled") return false;
    if (!a.due_date) return false;
    return new Date(a.due_date).getTime() < now;
  });

  if (hasOverdue) {
    const key = dedupeKey(buildingId, "overdue_action");
    if (!existing.has(key)) {
      const alert = createAlert(
        buildingId,
        "overdue_action",
        `Building ${buildingId} has overdue actions`,
        "critical"
      );
      existing.add(key);
      created.push(alert);
    }
  }

  // Check for high risk building
  if (building.risk_level === "high" || building.risk_level === "critical") {
    const key = dedupeKey(buildingId, "high_risk");
    if (!existing.has(key)) {
      const alert = createAlert(
        buildingId,
        "high_risk",
        `Building ${buildingId} is marked as ${building.risk_level} risk`,
        building.risk_level === "critical" ? "critical" : "warning"
      );
      existing.add(key);
      created.push(alert);
    }
  }

  // Check for missing diagnostic categories
  const diagnostics = listDiagnosticsByBuilding(buildingId);
  const coveredCategories = new Set(diagnostics.map((d) => d.category));
  const missingCategories = ALL_CATEGORIES.filter((c) => !coveredCategories.has(c));

  if (missingCategories.length > 0) {
    const key = dedupeKey(buildingId, "missing_diagnostic");
    if (!existing.has(key)) {
      const alert = createAlert(
        buildingId,
        "missing_diagnostic",
        `Building ${buildingId} is missing diagnostics for: ${missingCategories.join(", ")}`,
        "info"
      );
      existing.add(key);
      created.push(alert);
    }
  }

  return created;
}

export function generateAllAlerts() {
  const buildings = listBuildings();
  const allCreated = [];
  for (const building of buildings) {
    const created = generateAlerts(building.id);
    allCreated.push(...created);
  }
  return allCreated;
}

// --- Query ---

export function getAlert(id) {
  return alertStore.get(id) || null;
}

export function listAlertsByBuilding(buildingId) {
  return [...alertStore.values()].filter((a) => a.building_id === buildingId);
}

export function listAllAlerts(status) {
  const all = [...alertStore.values()];
  if (status) {
    return all.filter((a) => a.status === status);
  }
  return all;
}

// --- Workflow ---

export function acknowledgeAlert(id) {
  const alert = alertStore.get(id);
  if (!alert) return null;
  alert.status = "acknowledged";
  return alert;
}

export function resolveAlert(id, notes) {
  const alert = alertStore.get(id);
  if (!alert) return null;
  alert.status = "resolved";
  alert.resolved_at = new Date().toISOString();
  if (notes !== undefined) alert.notes = notes;
  return alert;
}

// --- Store management (for testing) ---

export function clearAlertStore() {
  alertStore.clear();
  nextId = 1;
}

export { alertStore };
