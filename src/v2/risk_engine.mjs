// Risk Scoring Engine — compute deterministic risk scores per building

import { getBuilding, listBuildings } from "./building_registry.mjs";
import { listEvidenceByBuilding } from "./evidence_engine.mjs";
import { listDiagnosticsByBuilding } from "./diagnostic_tracker.mjs";
import { listActionsByBuilding } from "./action_planner.mjs";

const riskStore = new Map(); // building_id → [{ score, tier, factors, computed_at }, ...]

// --- Tier calculation ---

function tierFromScore(score) {
  if (score >= 80) return "safe";
  if (score >= 60) return "watch";
  if (score >= 40) return "at_risk";
  return "critical";
}

// --- Core computation ---

export function computeBuildingRisk(buildingId) {
  const building = getBuilding(buildingId);
  if (!building) return null;

  let score = 100;
  const factors = [];

  // 1. Diagnostic severity
  const diagnostics = listDiagnosticsByBuilding(buildingId);
  const hasCritical = diagnostics.some((d) => d.severity === "critical");
  const hasWarning = diagnostics.some((d) => d.severity === "warning");

  if (hasCritical) {
    score -= 20;
    factors.push("critical diagnostic severity detected");
  }
  if (hasWarning) {
    score -= 10;
    factors.push("warning diagnostic severity detected");
  }

  // 2. Actions — overdue and open
  const actions = listActionsByBuilding(buildingId);
  const now = new Date();
  const overdueActions = actions.filter(
    (a) => a.status === "open" && a.due_date && new Date(a.due_date) < now
  );
  const openActions = actions.filter((a) => a.status === "open");

  if (overdueActions.length > 0) {
    score -= 15;
    factors.push(`${overdueActions.length} overdue action(s)`);
  }

  if (openActions.length > 0) {
    score -= 5 * openActions.length;
    factors.push(`${openActions.length} open action(s)`);
  }

  // 3. Evidence freshness
  const evidences = listEvidenceByBuilding(buildingId);
  if (evidences.length === 0) {
    score -= 10;
    factors.push("no evidence submitted");
  } else {
    const latestDate = evidences.reduce((latest, e) => {
      const d = new Date(e.submitted_at);
      return d > latest ? d : latest;
    }, new Date(0));
    const daysSince = (now - latestDate) / (1000 * 60 * 60 * 24);
    if (daysSince > 365) {
      score -= 10;
      factors.push("no evidence submitted in last 365 days");
    }
  }

  // Clamp score to 0 minimum
  if (score < 0) score = 0;

  const tier = tierFromScore(score);
  const computed_at = now.toISOString();

  const entry = { building_id: buildingId, score, tier, factors, computed_at };

  // Store history
  if (!riskStore.has(buildingId)) {
    riskStore.set(buildingId, []);
  }
  riskStore.get(buildingId).push(entry);

  return entry;
}

export function computePortfolioRisk() {
  const buildings = listBuildings();
  const results = [];

  for (const b of buildings) {
    const risk = computeBuildingRisk(b.id);
    if (risk) {
      results.push({
        building_id: b.id,
        address: b.address,
        score: risk.score,
        tier: risk.tier,
      });
    }
  }

  // Sort by score ascending (worst first)
  results.sort((a, b) => a.score - b.score);
  return results;
}

export function getRiskHistory(buildingId) {
  return riskStore.get(buildingId) || [];
}

export function clearRiskStore() {
  riskStore.clear();
}

export { riskStore };
