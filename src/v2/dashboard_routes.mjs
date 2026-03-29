// Portfolio Dashboard HTTP routes

import { json } from "./http.mjs";
import {
  getPortfolioSummary,
  getRiskBreakdown,
  getCompletionStats,
  getBacklogStats,
} from "./portfolio_dashboard.mjs";

export function createDashboardRoutes() {
  return [
    {
      method: "GET",
      pattern: /^\/v2\/dashboard\/summary$/,
      handler: (_req, res) => {
        json(res, 200, getPortfolioSummary());
      },
    },
    {
      method: "GET",
      pattern: /^\/v2\/dashboard\/risk-breakdown$/,
      handler: (_req, res) => {
        json(res, 200, getRiskBreakdown());
      },
    },
    {
      method: "GET",
      pattern: /^\/v2\/dashboard\/completion$/,
      handler: (_req, res) => {
        json(res, 200, getCompletionStats());
      },
    },
    {
      method: "GET",
      pattern: /^\/v2\/dashboard\/backlog$/,
      handler: (_req, res) => {
        json(res, 200, getBacklogStats());
      },
    },
  ];
}
