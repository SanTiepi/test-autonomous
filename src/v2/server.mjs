// SwissBuildingOS V2 — main server

import { createServer } from "node:http";
import { createRouter } from "./http.mjs";
import { createBuildingRoutes } from "./building_routes.mjs";
import { createEvidenceRoutes } from "./evidence_routes.mjs";
import { createDiagnosticRoutes } from "./diagnostic_routes.mjs";
import { createActionRoutes } from "./action_routes.mjs";
import { createDashboardRoutes } from "./dashboard_routes.mjs";
import { createRiskRoutes } from "./risk_routes.mjs";
import { createDossierRoutes } from "./dossier_routes.mjs";
import { createAlertRoutes } from "./alert_routes.mjs";

const routes = [
  ...createBuildingRoutes(),
  ...createEvidenceRoutes(),
  ...createDiagnosticRoutes(),
  ...createActionRoutes(),
  ...createDashboardRoutes(),
  ...createRiskRoutes(),
  ...createDossierRoutes(),
  ...createAlertRoutes(),
];

const router = createRouter(routes);
const server = createServer(router);

function matchRoute(method, url) {
  const path = url.split("?")[0];
  for (const r of routes) {
    if (r.method !== method) continue;
    const m = path.match(r.pattern);
    if (m) return { handler: r.handler, match: m };
  }
  return null;
}

export { server, routes, matchRoute };
