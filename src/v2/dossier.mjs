// Dossier — assembles a complete building dossier in one traceable view

import { getBuilding } from "./building_registry.mjs";
import { listEvidenceByBuilding } from "./evidence_engine.mjs";
import { listDiagnosticsByBuilding } from "./diagnostic_tracker.mjs";
import { listActionsByBuilding } from "./action_planner.mjs";

const ALL_CATEGORIES = ["asbestos", "energy", "structure", "fire", "accessibility"];
const RECENT_DAYS = 365;

let dossierCache = new Map();

function computeCompleteness(evidence, diagnostics, actions) {
  const coveredCategories = new Set(diagnostics.map((d) => d.category));
  const missingCategories = ALL_CATEGORIES.filter((c) => !coveredCategories.has(c));

  const now = Date.now();
  const oneYearAgo = now - RECENT_DAYS * 24 * 60 * 60 * 1000;
  const hasRecentEvidence = evidence.some((e) => new Date(e.submitted_at).getTime() >= oneYearAgo);

  return {
    evidence_count: evidence.length,
    diagnostic_count: diagnostics.length,
    action_count: actions.length,
    has_recent_evidence: hasRecentEvidence,
    has_all_categories: missingCategories.length === 0,
    missing_categories: missingCategories,
  };
}

export function generateDossier(buildingId) {
  if (dossierCache.has(buildingId)) {
    return dossierCache.get(buildingId);
  }

  const building = getBuilding(buildingId);
  if (!building) return null;

  const evidence = listEvidenceByBuilding(buildingId);
  const diagnostics = listDiagnosticsByBuilding(buildingId);
  const actions = listActionsByBuilding(buildingId);
  const completeness = computeCompleteness(evidence, diagnostics, actions);

  const dossier = {
    building,
    evidence,
    diagnostics,
    actions,
    completeness,
    generated_at: new Date().toISOString(),
  };

  dossierCache.set(buildingId, dossier);
  return dossier;
}

export function exportDossierAsJson(buildingId) {
  const dossier = generateDossier(buildingId);
  if (!dossier) return null;
  return JSON.stringify(dossier, null, 2);
}

export function clearDossierCache() {
  dossierCache.clear();
}
