// Alert HTTP routes

import { readBody, json } from "./http.mjs";
import {
  generateAlerts,
  generateAllAlerts,
  listAlertsByBuilding,
  listAllAlerts,
  acknowledgeAlert,
  resolveAlert,
} from "./alerts.mjs";
import { getBuilding } from "./building_registry.mjs";

export function createAlertRoutes() {
  return [
    {
      method: "POST",
      pattern: /^\/v2\/buildings\/([^/]+)\/alerts\/generate$/,
      handler: (_req, res, match) => {
        const buildingId = match[1];
        if (!getBuilding(buildingId)) {
          return json(res, 404, { error: "Building not found", details: [] });
        }
        const alerts = generateAlerts(buildingId);
        json(res, 201, alerts);
      },
    },
    {
      method: "POST",
      pattern: /^\/v2\/alerts\/generate-all$/,
      handler: (_req, res) => {
        const alerts = generateAllAlerts();
        json(res, 201, alerts);
      },
    },
    {
      method: "GET",
      pattern: /^\/v2\/buildings\/([^/]+)\/alerts$/,
      handler: (_req, res, match) => {
        const buildingId = match[1];
        if (!getBuilding(buildingId)) {
          return json(res, 404, { error: "Building not found", details: [] });
        }
        json(res, 200, listAlertsByBuilding(buildingId));
      },
    },
    {
      method: "GET",
      pattern: /^\/v2\/alerts$/,
      handler: (req, res) => {
        const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
        const status = url.searchParams.get("status") || undefined;
        json(res, 200, listAllAlerts(status));
      },
    },
    {
      method: "PATCH",
      pattern: /^\/v2\/alerts\/([^/]+)\/acknowledge$/,
      handler: (_req, res, match) => {
        const alert = acknowledgeAlert(match[1]);
        if (!alert) return json(res, 404, { error: "Alert not found", details: [] });
        json(res, 200, alert);
      },
    },
    {
      method: "PATCH",
      pattern: /^\/v2\/alerts\/([^/]+)\/resolve$/,
      handler: async (req, res, match) => {
        let body;
        try {
          body = await readBody(req);
        } catch {
          return json(res, 400, { error: "Invalid JSON", details: [] });
        }
        const alert = resolveAlert(match[1], body.notes);
        if (!alert) return json(res, 404, { error: "Alert not found", details: [] });
        json(res, 200, alert);
      },
    },
  ];
}
