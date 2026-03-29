// Building Registry HTTP routes

import { readBody, json } from "./http.mjs";
import {
  validateBuilding,
  createBuilding,
  getBuilding,
  listBuildings,
  updateBuilding,
  deleteBuilding,
} from "./building_registry.mjs";

export function createBuildingRoutes() {
  return [
    {
      method: "POST",
      pattern: /^\/v2\/buildings$/,
      handler: async (req, res) => {
        let body;
        try {
          body = await readBody(req);
        } catch {
          return json(res, 400, { error: "Invalid JSON", details: [] });
        }
        const errors = validateBuilding(body);
        if (errors.length) return json(res, 400, { error: "Validation failed", details: errors });
        const building = createBuilding(body);
        json(res, 201, building);
      },
    },
    {
      method: "GET",
      pattern: /^\/v2\/buildings$/,
      handler: (_req, res) => {
        json(res, 200, listBuildings());
      },
    },
    {
      method: "GET",
      pattern: /^\/v2\/buildings\/([^/]+)$/,
      handler: (_req, res, match) => {
        const building = getBuilding(match[1]);
        if (!building) return json(res, 404, { error: "Building not found", details: [] });
        json(res, 200, building);
      },
    },
    {
      method: "PUT",
      pattern: /^\/v2\/buildings\/([^/]+)$/,
      handler: async (req, res, match) => {
        if (!getBuilding(match[1])) {
          return json(res, 404, { error: "Building not found", details: [] });
        }
        let body;
        try {
          body = await readBody(req);
        } catch {
          return json(res, 400, { error: "Invalid JSON", details: [] });
        }
        const errors = validateBuilding(body);
        if (errors.length) return json(res, 400, { error: "Validation failed", details: errors });
        const updated = updateBuilding(match[1], body);
        json(res, 200, updated);
      },
    },
    {
      method: "DELETE",
      pattern: /^\/v2\/buildings\/([^/]+)$/,
      handler: (_req, res, match) => {
        if (!deleteBuilding(match[1])) {
          return json(res, 404, { error: "Building not found", details: [] });
        }
        res.writeHead(204);
        res.end();
      },
    },
  ];
}
