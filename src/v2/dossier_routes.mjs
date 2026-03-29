// Dossier HTTP routes

import { json } from "./http.mjs";
import { generateDossier, exportDossierAsJson } from "./dossier.mjs";

export function createDossierRoutes() {
  return [
    {
      method: "GET",
      pattern: /^\/v2\/buildings\/([^/]+)\/dossier\/export$/,
      handler: (_req, res, match) => {
        const buildingId = match[1];
        const jsonStr = exportDossierAsJson(buildingId);
        if (!jsonStr) return json(res, 404, { error: "Building not found", details: [] });
        res.writeHead(200, {
          "content-type": "application/json",
          "content-disposition": `attachment; filename="dossier-${buildingId}.json"`,
        });
        res.end(jsonStr);
      },
    },
    {
      method: "GET",
      pattern: /^\/v2\/buildings\/([^/]+)\/dossier$/,
      handler: (_req, res, match) => {
        const buildingId = match[1];
        const dossier = generateDossier(buildingId);
        if (!dossier) return json(res, 404, { error: "Building not found", details: [] });
        json(res, 200, dossier);
      },
    },
  ];
}
