import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createBuildingRoutes } from "../../src/v2/building_routes.mjs";
import { createRouter } from "../../src/v2/http.mjs";
import { clearBuildings } from "../../src/v2/building_registry.mjs";

// --- Test helpers ---

function startServer() {
  const router = createRouter(createBuildingRoutes());
  const server = createServer(router);
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      resolve({ server, port });
    });
  });
}

async function request(port, method, path, body) {
  const http = await import("node:http");
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: "127.0.0.1",
      port,
      path,
      method,
      headers: { "content-type": "application/json" },
    };
    const r = http.request(opts, (res) => {
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => {
        const raw = Buffer.concat(chunks).toString();
        resolve({
          status: res.statusCode,
          body: raw ? JSON.parse(raw) : null,
        });
      });
    });
    r.on("error", reject);
    if (body !== undefined) r.write(JSON.stringify(body));
    r.end();
  });
}

const VALID_BUILDING = {
  address: "Bahnhofstrasse 1, 8001 Zürich",
  type: "commercial",
  year: 1990,
  risk_level: "low",
};

describe("Building Registry V2", () => {
  let server, port;

  beforeEach(async () => {
    clearBuildings();
    const s = await startServer();
    server = s.server;
    port = s.port;
  });

  // Ensure server is closed after each test
  afterEach(() => {
    return new Promise((resolve) => server.close(resolve));
  });

  // --- CREATE ---

  describe("POST /v2/buildings", () => {
    it("creates a building with valid data", async () => {
      const res = await request(port, "POST", "/v2/buildings", VALID_BUILDING);
      assert.equal(res.status, 201);
      assert.equal(res.body.address, "Bahnhofstrasse 1, 8001 Zürich");
      assert.equal(res.body.type, "commercial");
      assert.equal(res.body.year, 1990);
      assert.equal(res.body.risk_level, "low");
      assert.ok(res.body.id);
      assert.ok(res.body.created_at);
      assert.ok(res.body.updated_at);
    });

    it("rejects missing address", async () => {
      const res = await request(port, "POST", "/v2/buildings", { ...VALID_BUILDING, address: "" });
      assert.equal(res.status, 400);
      assert.equal(res.body.error, "Validation failed");
      assert.ok(res.body.details.some((d) => d.includes("address")));
    });

    it("rejects missing type", async () => {
      const { type, ...noType } = VALID_BUILDING;
      const res = await request(port, "POST", "/v2/buildings", noType);
      assert.equal(res.status, 400);
      assert.ok(res.body.details.some((d) => d.includes("type")));
    });

    it("rejects invalid type value", async () => {
      const res = await request(port, "POST", "/v2/buildings", { ...VALID_BUILDING, type: "castle" });
      assert.equal(res.status, 400);
      assert.ok(res.body.details.some((d) => d.includes("type")));
    });

    it("rejects missing year", async () => {
      const { year, ...noYear } = VALID_BUILDING;
      const res = await request(port, "POST", "/v2/buildings", noYear);
      assert.equal(res.status, 400);
      assert.ok(res.body.details.some((d) => d.includes("year")));
    });

    it("rejects year out of range", async () => {
      const res = await request(port, "POST", "/v2/buildings", { ...VALID_BUILDING, year: 500 });
      assert.equal(res.status, 400);
      assert.ok(res.body.details.some((d) => d.includes("year")));
    });

    it("rejects future year", async () => {
      const res = await request(port, "POST", "/v2/buildings", { ...VALID_BUILDING, year: 2999 });
      assert.equal(res.status, 400);
      assert.ok(res.body.details.some((d) => d.includes("year")));
    });

    it("rejects non-integer year", async () => {
      const res = await request(port, "POST", "/v2/buildings", { ...VALID_BUILDING, year: 1990.5 });
      assert.equal(res.status, 400);
      assert.ok(res.body.details.some((d) => d.includes("year")));
    });

    it("rejects invalid risk_level", async () => {
      const res = await request(port, "POST", "/v2/buildings", { ...VALID_BUILDING, risk_level: "extreme" });
      assert.equal(res.status, 400);
      assert.ok(res.body.details.some((d) => d.includes("risk_level")));
    });

    it("rejects missing risk_level", async () => {
      const { risk_level, ...noRisk } = VALID_BUILDING;
      const res = await request(port, "POST", "/v2/buildings", noRisk);
      assert.equal(res.status, 400);
      assert.ok(res.body.details.some((d) => d.includes("risk_level")));
    });

    it("returns all validation errors at once", async () => {
      const res = await request(port, "POST", "/v2/buildings", {});
      assert.equal(res.status, 400);
      assert.equal(res.body.error, "Validation failed");
      assert.ok(res.body.details.length >= 4);
    });

    it("rejects invalid JSON body", async () => {
      const http = await import("node:http");
      const result = await new Promise((resolve, reject) => {
        const r = http.request(
          { hostname: "127.0.0.1", port, path: "/v2/buildings", method: "POST", headers: { "content-type": "application/json" } },
          (res) => {
            const chunks = [];
            res.on("data", (c) => chunks.push(c));
            res.on("end", () => resolve({ status: res.statusCode, body: JSON.parse(Buffer.concat(chunks).toString()) }));
          }
        );
        r.on("error", reject);
        r.write("not json");
        r.end();
      });
      assert.equal(result.status, 400);
      assert.equal(result.body.error, "Invalid JSON");
    });
  });

  // --- READ ---

  describe("GET /v2/buildings/:id", () => {
    it("returns a building by id", async () => {
      const created = await request(port, "POST", "/v2/buildings", VALID_BUILDING);
      const res = await request(port, "GET", `/v2/buildings/${created.body.id}`);
      assert.equal(res.status, 200);
      assert.equal(res.body.id, created.body.id);
      assert.equal(res.body.address, VALID_BUILDING.address);
    });

    it("returns 404 for unknown id", async () => {
      const res = await request(port, "GET", "/v2/buildings/999");
      assert.equal(res.status, 404);
      assert.equal(res.body.error, "Building not found");
    });
  });

  // --- LIST ---

  describe("GET /v2/buildings", () => {
    it("returns empty array when no buildings", async () => {
      const res = await request(port, "GET", "/v2/buildings");
      assert.equal(res.status, 200);
      assert.deepEqual(res.body, []);
    });

    it("returns all buildings", async () => {
      await request(port, "POST", "/v2/buildings", VALID_BUILDING);
      await request(port, "POST", "/v2/buildings", { ...VALID_BUILDING, address: "Rue du Marché 10, 1204 Genève" });
      const res = await request(port, "GET", "/v2/buildings");
      assert.equal(res.status, 200);
      assert.equal(res.body.length, 2);
    });
  });

  // --- UPDATE ---

  describe("PUT /v2/buildings/:id", () => {
    it("updates a building with valid data", async () => {
      const created = await request(port, "POST", "/v2/buildings", VALID_BUILDING);
      const updated = {
        address: "Paradeplatz 8, 8001 Zürich",
        type: "public",
        year: 2005,
        risk_level: "medium",
      };
      const res = await request(port, "PUT", `/v2/buildings/${created.body.id}`, updated);
      assert.equal(res.status, 200);
      assert.equal(res.body.address, "Paradeplatz 8, 8001 Zürich");
      assert.equal(res.body.type, "public");
      assert.equal(res.body.year, 2005);
      assert.equal(res.body.risk_level, "medium");
    });

    it("returns 404 for unknown id", async () => {
      const res = await request(port, "PUT", "/v2/buildings/999", VALID_BUILDING);
      assert.equal(res.status, 404);
      assert.equal(res.body.error, "Building not found");
    });

    it("rejects invalid data on update", async () => {
      const created = await request(port, "POST", "/v2/buildings", VALID_BUILDING);
      const res = await request(port, "PUT", `/v2/buildings/${created.body.id}`, { ...VALID_BUILDING, type: "unknown" });
      assert.equal(res.status, 400);
      assert.equal(res.body.error, "Validation failed");
    });
  });

  // --- DELETE ---

  describe("DELETE /v2/buildings/:id", () => {
    it("deletes a building", async () => {
      const created = await request(port, "POST", "/v2/buildings", VALID_BUILDING);
      const res = await request(port, "DELETE", `/v2/buildings/${created.body.id}`);
      assert.equal(res.status, 204);
      // Confirm gone
      const get = await request(port, "GET", `/v2/buildings/${created.body.id}`);
      assert.equal(get.status, 404);
    });

    it("returns 404 for unknown id", async () => {
      const res = await request(port, "DELETE", "/v2/buildings/999");
      assert.equal(res.status, 404);
      assert.equal(res.body.error, "Building not found");
    });
  });

  // --- 404 for unknown routes ---

  describe("Unknown routes", () => {
    it("returns 404 for unmatched path", async () => {
      const res = await request(port, "GET", "/v2/nonexistent");
      assert.equal(res.status, 404);
      assert.equal(res.body.error, "Not found");
    });
  });
});
