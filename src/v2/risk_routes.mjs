// Risk Scoring Engine HTTP routes

import { json } from "./http.mjs";
import {
  computeBuildingRisk,
  computePortfolioRisk,
  getRiskHistory,
} from "./risk_engine.mjs";
import { getBuilding } from "./building_registry.mjs";

export function createRiskRoutes() {
  return [
    {
      method: "POST",
      pattern: /^\/v2\/buildings\/([^/]+)\/risk\/compute$/,
      handler: (_req, res, match) => {
        const buildingId = match[1];
        if (!getBuilding(buildingId)) {
          return json(res, 404, { error: "Building not found", details: [] });
        }
        const result = computeBuildingRisk(buildingId);
        json(res, 200, result);
      },
    },
    {
      method: "GET",
      pattern: /^\/v2\/buildings\/([^/]+)\/risk$/,
      handler: (_req, res, match) => {
        const buildingId = match[1];
        if (!getBuilding(buildingId)) {
          return json(res, 404, { error: "Building not found", details: [] });
        }
        const history = getRiskHistory(buildingId);
        if (history.length === 0) {
          return json(res, 404, { error: "No risk computed yet", details: [] });
        }
        // Return the latest computed risk
        json(res, 200, history[history.length - 1]);
      },
    },
    {
      method: "GET",
      pattern: /^\/v2\/risk\/portfolio$/,
      handler: (_req, res) => {
        json(res, 200, computePortfolioRisk());
      },
    },
  ];
}
