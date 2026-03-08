import { describe, it } from "node:test";
import assert from "node:assert/strict";

describe("API routes", () => {
  it("should have a root route", async () => {
    const { routes } = await import("../src/index.mjs");
    assert.ok(routes["GET /"]);
  });

  it("should have a health route", async () => {
    const { routes } = await import("../src/index.mjs");
    assert.ok(routes["GET /health"]);
  });
});
