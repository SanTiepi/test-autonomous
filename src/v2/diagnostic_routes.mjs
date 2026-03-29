// Diagnostic Tracker HTTP routes

import { readBody, json } from "./http.mjs";
import {
  validateDiagnostic,
  createDiagnostic,
  getDiagnostic,
  listDiagnosticsByBuilding,
  updateDiagnostic,
  deleteDiagnostic,
  getDiagnosticSummary,
} from "./diagnostic_tracker.mjs";
import { getBuilding } from "./building_registry.mjs";

export function createDiagnosticRoutes() {
  return [
    {
      method: "POST",
      pattern: /^\/v2\/buildings\/([^/]+)\/diagnostics$/,
      handler: async (req, res, match) => {
        const buildingId = match[1];
        if (!getBuilding(buildingId)) {
          return json(res, 404, { error: "Building not found", details: [] });
        }
        let body;
        try {
          body = await readBody(req);
        } catch {
          return json(res, 400, { error: "Invalid JSON", details: [] });
        }
        const errors = validateDiagnostic(body);
        if (errors.length) return json(res, 400, { error: "Validation failed", details: errors });
        const diagnostic = createDiagnostic(buildingId, body);
        if (diagnostic.error) return json(res, 400, { error: diagnostic.error, details: [] });
        json(res, 201, diagnostic);
      },
    },
    {
      method: "GET",
      pattern: /^\/v2\/buildings\/([^/]+)\/diagnostics\/summary$/,
      handler: (_req, res, match) => {
        const buildingId = match[1];
        if (!getBuilding(buildingId)) {
          return json(res, 404, { error: "Building not found", details: [] });
        }
        json(res, 200, getDiagnosticSummary(buildingId));
      },
    },
    {
      method: "GET",
      pattern: /^\/v2\/buildings\/([^/]+)\/diagnostics$/,
      handler: (_req, res, match) => {
        const buildingId = match[1];
        if (!getBuilding(buildingId)) {
          return json(res, 404, { error: "Building not found", details: [] });
        }
        json(res, 200, listDiagnosticsByBuilding(buildingId));
      },
    },
    {
      method: "GET",
      pattern: /^\/v2\/diagnostics\/([^/]+)$/,
      handler: (_req, res, match) => {
        const diagnostic = getDiagnostic(match[1]);
        if (!diagnostic) return json(res, 404, { error: "Diagnostic not found", details: [] });
        json(res, 200, diagnostic);
      },
    },
    {
      method: "PUT",
      pattern: /^\/v2\/diagnostics\/([^/]+)$/,
      handler: async (req, res, match) => {
        const id = match[1];
        const existing = getDiagnostic(id);
        if (!existing) return json(res, 404, { error: "Diagnostic not found", details: [] });
        let body;
        try {
          body = await readBody(req);
        } catch {
          return json(res, 400, { error: "Invalid JSON", details: [] });
        }
        const updated = updateDiagnostic(id, body);
        if (!updated) return json(res, 404, { error: "Diagnostic not found", details: [] });
        json(res, 200, updated);
      },
    },
    {
      method: "DELETE",
      pattern: /^\/v2\/diagnostics\/([^/]+)$/,
      handler: (_req, res, match) => {
        if (!deleteDiagnostic(match[1])) {
          return json(res, 404, { error: "Diagnostic not found", details: [] });
        }
        res.writeHead(204);
        res.end();
      },
    },
  ];
}
