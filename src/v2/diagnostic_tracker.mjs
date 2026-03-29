// Diagnostic Tracker — track building diagnostics with scores

import { getBuilding } from "./building_registry.mjs";

const diagnosticStore = new Map();
let nextId = 1;

const VALID_CATEGORIES = ["asbestos", "energy", "structure", "fire", "accessibility"];

function computeSeverity(score) {
  if (score >= 70) return "ok";
  if (score >= 40) return "warning";
  return "critical";
}

// --- Validation ---

export function validateDiagnostic(body) {
  const errors = [];

  if (typeof body.category !== "string" || !VALID_CATEGORIES.includes(body.category)) {
    errors.push(`category: required, one of ${VALID_CATEGORIES.join(", ")}`);
  }

  if (typeof body.score !== "number" || body.score < 0 || body.score > 100) {
    errors.push("score: required number between 0 and 100");
  }

  if (typeof body.findings !== "string" || body.findings.trim().length === 0) {
    errors.push("findings: required non-empty string");
  }

  return errors;
}

// --- CRUD ---

export function createDiagnostic(buildingId, body) {
  const building = getBuilding(buildingId);
  if (!building) {
    return { error: "building not found" };
  }

  const id = String(nextId++);
  const diagnostic = {
    id,
    building_id: buildingId,
    category: body.category,
    score: body.score,
    severity: computeSeverity(body.score),
    findings: body.findings.trim(),
    assessed_at: new Date().toISOString(),
  };
  diagnosticStore.set(id, diagnostic);
  return diagnostic;
}

export function getDiagnostic(id) {
  return diagnosticStore.get(id) || null;
}

export function listDiagnosticsByBuilding(buildingId) {
  return [...diagnosticStore.values()].filter((d) => d.building_id === buildingId);
}

export function updateDiagnostic(id, body) {
  const diagnostic = diagnosticStore.get(id);
  if (!diagnostic) return null;

  if (body.category !== undefined) diagnostic.category = body.category;
  if (body.score !== undefined) {
    diagnostic.score = body.score;
    diagnostic.severity = computeSeverity(body.score);
  }
  if (body.findings !== undefined) diagnostic.findings = body.findings.trim();
  diagnostic.assessed_at = new Date().toISOString();

  return diagnostic;
}

export function deleteDiagnostic(id) {
  return diagnosticStore.delete(id);
}

export function getDiagnosticSummary(buildingId) {
  const diagnostics = listDiagnosticsByBuilding(buildingId);
  const categories = {};

  for (const d of diagnostics) {
    if (!categories[d.category]) {
      categories[d.category] = { latest_score: d.score, severity: d.severity, count: 0, assessed_at: d.assessed_at };
    }
    categories[d.category].count++;
    // Keep the most recent diagnostic per category
    if (d.assessed_at >= categories[d.category].assessed_at) {
      categories[d.category].latest_score = d.score;
      categories[d.category].severity = d.severity;
      categories[d.category].assessed_at = d.assessed_at;
    }
  }

  // Clean up the internal assessed_at field from the output
  for (const cat of Object.values(categories)) {
    delete cat.assessed_at;
  }

  // Overall risk: worst severity across all categories
  const severities = Object.values(categories).map((c) => c.severity);
  let overall_risk = "ok";
  if (severities.includes("critical")) overall_risk = "critical";
  else if (severities.includes("warning")) overall_risk = "warning";

  return { building_id: buildingId, categories, overall_risk };
}

// --- Store management (for testing) ---

export function clearDiagnosticStore() {
  diagnosticStore.clear();
  nextId = 1;
}

export { diagnosticStore };
