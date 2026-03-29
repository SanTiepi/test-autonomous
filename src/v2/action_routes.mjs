// Action Planner HTTP routes

import { readBody, json } from "./http.mjs";
import {
  generateActionsFromDiagnostics,
  listActionsByBuilding,
  getAction,
  updateActionStatus,
  deleteAction,
} from "./action_planner.mjs";
import { getBuilding } from "./building_registry.mjs";

export function createActionRoutes() {
  return [
    {
      method: "POST",
      pattern: /^\/v2\/buildings\/([^/]+)\/actions\/generate$/,
      handler: (_req, res, match) => {
        const buildingId = match[1];
        if (!getBuilding(buildingId)) {
          return json(res, 404, { error: "Building not found", details: [] });
        }
        const actions = generateActionsFromDiagnostics(buildingId);
        json(res, 201, actions);
      },
    },
    {
      method: "GET",
      pattern: /^\/v2\/buildings\/([^/]+)\/actions$/,
      handler: (_req, res, match) => {
        const buildingId = match[1];
        if (!getBuilding(buildingId)) {
          return json(res, 404, { error: "Building not found", details: [] });
        }
        json(res, 200, listActionsByBuilding(buildingId));
      },
    },
    {
      method: "GET",
      pattern: /^\/v2\/actions\/([^/]+)$/,
      handler: (_req, res, match) => {
        const action = getAction(match[1]);
        if (!action) return json(res, 404, { error: "Action not found", details: [] });
        json(res, 200, action);
      },
    },
    {
      method: "PATCH",
      pattern: /^\/v2\/actions\/([^/]+)\/status$/,
      handler: async (req, res, match) => {
        const id = match[1];
        const existing = getAction(id);
        if (!existing) return json(res, 404, { error: "Action not found", details: [] });
        let body;
        try {
          body = await readBody(req);
        } catch {
          return json(res, 400, { error: "Invalid JSON", details: [] });
        }
        if (!body.status) return json(res, 400, { error: "status is required", details: [] });
        const result = updateActionStatus(id, body.status);
        if (!result) return json(res, 404, { error: "Action not found", details: [] });
        if (result.error) return json(res, 400, { error: result.error, details: [] });
        json(res, 200, result);
      },
    },
    {
      method: "DELETE",
      pattern: /^\/v2\/actions\/([^/]+)$/,
      handler: (_req, res, match) => {
        if (!deleteAction(match[1])) {
          return json(res, 404, { error: "Action not found", details: [] });
        }
        res.writeHead(204);
        res.end();
      },
    },
  ];
}
