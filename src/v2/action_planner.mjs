// Action Planner — generate and track remediation actions from diagnostics

import { listDiagnosticsByBuilding } from "./diagnostic_tracker.mjs";
import { getBuilding } from "./building_registry.mjs";

const actionStore = new Map();
let nextId = 1;

const VALID_PRIORITIES = ["low", "medium", "high", "urgent"];
const VALID_STATUSES = ["open", "in_progress", "completed", "cancelled"];

// --- Generation rules ---
// Each rule: { category, minSeverity, title, priority }
const GENERATION_RULES = [
  { category: "asbestos", severity: "critical", title: "Asbestos removal", priority: "urgent" },
  { category: "asbestos", severity: "warning", title: "Asbestos assessment", priority: "high" },
  { category: "energy", severity: "critical", title: "Energy retrofit", priority: "high" },
  { category: "energy", severity: "warning", title: "Energy audit", priority: "medium" },
  { category: "structure", severity: "critical", title: "Structural reinforcement", priority: "urgent" },
  { category: "structure", severity: "warning", title: "Structural inspection", priority: "high" },
  { category: "fire", severity: "critical", title: "Fire safety overhaul", priority: "urgent" },
  { category: "fire", severity: "warning", title: "Fire safety review", priority: "high" },
  { category: "accessibility", severity: "critical", title: "Accessibility retrofit", priority: "high" },
  { category: "accessibility", severity: "warning", title: "Accessibility audit", priority: "medium" },
];

// --- Deduplication key ---

function dedupeKey(buildingId, diagnosticId, ruleTitle) {
  return `${buildingId}:${diagnosticId}:${ruleTitle}`;
}

// Build a Set of existing dedupe keys for fast lookup
function existingDedupeKeys() {
  const keys = new Set();
  for (const action of actionStore.values()) {
    keys.add(dedupeKey(action.building_id, action.diagnostic_id, action.title));
  }
  return keys;
}

// --- Generation ---

export function generateActionsFromDiagnostics(buildingId) {
  const building = getBuilding(buildingId);
  if (!building) return [];

  const diagnostics = listDiagnosticsByBuilding(buildingId);
  const existing = existingDedupeKeys();
  const created = [];

  for (const diag of diagnostics) {
    if (diag.severity !== "warning" && diag.severity !== "critical") continue;

    for (const rule of GENERATION_RULES) {
      if (rule.category !== diag.category || rule.severity !== diag.severity) continue;

      const key = dedupeKey(buildingId, diag.id, rule.title);
      if (existing.has(key)) continue;

      const id = String(nextId++);
      const action = {
        id,
        building_id: buildingId,
        diagnostic_id: diag.id,
        title: rule.title,
        description: `Auto-generated from diagnostic ${diag.id} (${diag.category}, ${diag.severity})`,
        priority: rule.priority,
        status: "open",
        estimated_cost: null,
        due_date: null,
        created_at: new Date().toISOString(),
      };
      actionStore.set(id, action);
      existing.add(key);
      created.push(action);
    }
  }

  return created;
}

// --- CRUD ---

export function createAction(body) {
  const errors = [];
  if (typeof body.building_id !== "string" || !body.building_id) {
    errors.push("building_id: required");
  }
  if (typeof body.title !== "string" || !body.title.trim()) {
    errors.push("title: required non-empty string");
  }
  if (body.priority && !VALID_PRIORITIES.includes(body.priority)) {
    errors.push(`priority: must be one of ${VALID_PRIORITIES.join(", ")}`);
  }
  if (errors.length) return { error: "Validation failed", details: errors };

  const id = String(nextId++);
  const action = {
    id,
    building_id: body.building_id,
    diagnostic_id: body.diagnostic_id || null,
    title: body.title.trim(),
    description: body.description || "",
    priority: body.priority || "medium",
    status: "open",
    estimated_cost: body.estimated_cost ?? null,
    due_date: body.due_date || null,
    created_at: new Date().toISOString(),
  };
  actionStore.set(id, action);
  return action;
}

export function getAction(id) {
  return actionStore.get(id) || null;
}

export function listActionsByBuilding(buildingId) {
  return [...actionStore.values()].filter((a) => a.building_id === buildingId);
}

export function updateActionStatus(id, status) {
  const action = actionStore.get(id);
  if (!action) return null;
  if (!VALID_STATUSES.includes(status)) {
    return { error: `invalid status: must be one of ${VALID_STATUSES.join(", ")}` };
  }
  action.status = status;
  return action;
}

export function deleteAction(id) {
  return actionStore.delete(id);
}

// --- Store management (for testing) ---

export function clearActionStore() {
  actionStore.clear();
  nextId = 1;
}

export { actionStore };
