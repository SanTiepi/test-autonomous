// Portfolio Dashboard — aggregate stats across all buildings

import { buildings } from "./building_registry.mjs";
import { evidenceStore } from "./evidence_engine.mjs";
import { diagnosticStore } from "./diagnostic_tracker.mjs";
import { actionStore } from "./action_planner.mjs";

// --- Portfolio Summary ---

export function getPortfolioSummary() {
  const buildingsList = [...buildings.values()];
  const riskCounts = { low: 0, medium: 0, high: 0, critical: 0 };

  for (const b of buildingsList) {
    if (riskCounts[b.risk_level] !== undefined) {
      riskCounts[b.risk_level]++;
    }
  }

  return {
    total_buildings: buildings.size,
    total_evidence: evidenceStore.size,
    total_diagnostics: diagnosticStore.size,
    total_actions: actionStore.size,
    buildings_by_risk: riskCounts,
  };
}

// --- Risk Breakdown ---

export function getRiskBreakdown() {
  const result = [];

  for (const b of buildings.values()) {
    const diagnosticCount = [...diagnosticStore.values()].filter(
      (d) => d.building_id === b.id
    ).length;

    const actionCount = [...actionStore.values()].filter(
      (a) => a.building_id === b.id
    ).length;

    const evidenceCount = [...evidenceStore.values()].filter(
      (e) => e.building_id === b.id
    ).length;

    result.push({
      building_id: b.id,
      address: b.address,
      risk_level: b.risk_level,
      diagnostic_count: diagnosticCount,
      action_count: actionCount,
      evidence_count: evidenceCount,
    });
  }

  return result;
}

// --- Completion Stats ---

export function getCompletionStats() {
  const actions = [...actionStore.values()];
  let open = 0;
  let completed = 0;
  let inProgress = 0;

  for (const a of actions) {
    if (a.status === "open") open++;
    else if (a.status === "completed") completed++;
    else if (a.status === "in_progress") inProgress++;
  }

  const total = actions.length;
  const completionRate = total > 0 ? completed / total : 0;

  return {
    actions_open: open,
    actions_completed: completed,
    actions_in_progress: inProgress,
    completion_rate: Math.round(completionRate * 10000) / 10000,
  };
}

// --- Backlog Stats ---

export function getBacklogStats() {
  const actions = [...actionStore.values()];
  const now = new Date().toISOString();
  let overdue = 0;
  let urgent = 0;
  let highPriority = 0;

  for (const a of actions) {
    if (a.status === "completed" || a.status === "cancelled") continue;

    if (a.due_date && a.due_date < now) overdue++;
    if (a.priority === "urgent") urgent++;
    if (a.priority === "high") highPriority++;
  }

  return {
    overdue_actions: overdue,
    urgent_actions: urgent,
    high_priority: highPriority,
  };
}
