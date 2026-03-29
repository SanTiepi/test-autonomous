// Evidence Engine HTTP routes

import { readBody, json } from "./http.mjs";
import {
  validateEvidence,
  createEvidence,
  getEvidence,
  listEvidenceByBuilding,
  updateEvidenceStatus,
  deleteEvidence,
} from "./evidence_engine.mjs";
import { getBuilding } from "./building_registry.mjs";

export function createEvidenceRoutes() {
  return [
    {
      method: "POST",
      pattern: /^\/v2\/buildings\/([^/]+)\/evidence$/,
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
        const errors = validateEvidence(body);
        if (errors.length) return json(res, 400, { error: "Validation failed", details: errors });
        const evidence = createEvidence(buildingId, body);
        if (evidence.error) return json(res, 400, { error: evidence.error, details: [] });
        json(res, 201, evidence);
      },
    },
    {
      method: "GET",
      pattern: /^\/v2\/buildings\/([^/]+)\/evidence$/,
      handler: (_req, res, match) => {
        const buildingId = match[1];
        if (!getBuilding(buildingId)) {
          return json(res, 404, { error: "Building not found", details: [] });
        }
        json(res, 200, listEvidenceByBuilding(buildingId));
      },
    },
    {
      method: "GET",
      pattern: /^\/v2\/evidence\/([^/]+)$/,
      handler: (_req, res, match) => {
        const evidence = getEvidence(match[1]);
        if (!evidence) return json(res, 404, { error: "Evidence not found", details: [] });
        json(res, 200, evidence);
      },
    },
    {
      method: "PATCH",
      pattern: /^\/v2\/evidence\/([^/]+)\/verify$/,
      handler: async (req, res, match) => {
        const id = match[1];
        const existing = getEvidence(id);
        if (!existing) return json(res, 404, { error: "Evidence not found", details: [] });
        let body;
        try {
          body = await readBody(req);
        } catch {
          return json(res, 400, { error: "Invalid JSON", details: [] });
        }
        if (!body.status) return json(res, 400, { error: "status is required", details: [] });
        const result = updateEvidenceStatus(id, body.status, body.notes);
        if (!result) return json(res, 404, { error: "Evidence not found", details: [] });
        if (result.error) return json(res, 400, { error: result.error, details: [] });
        json(res, 200, result);
      },
    },
    {
      method: "DELETE",
      pattern: /^\/v2\/evidence\/([^/]+)$/,
      handler: (_req, res, match) => {
        if (!deleteEvidence(match[1])) {
          return json(res, 404, { error: "Evidence not found", details: [] });
        }
        res.writeHead(204);
        res.end();
      },
    },
  ];
}
