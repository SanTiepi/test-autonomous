import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { transpile } from "../src/mcl/transpile.mjs";

describe("MCL live transpilation", () => {
  it("transpiles use statement", () => {
    const js = transpile("use crypto.randomUUID");
    assert.equal(js, 'import { randomUUID } from "node:crypto";');
  });

  it("transpiles variable declaration", () => {
    const js = transpile("clients: Map");
    assert.equal(js, "export const clients = new Map();");
  });

  it("transpiles public function with inline body", () => {
    const js = transpile("add a,b -> a + b");
    assert.ok(js.includes("export function add"));
    assert.ok(js.includes("return a + b"));
  });

  it("transpiles private function", () => {
    const js = transpile("_helper x -> x * 2");
    assert.ok(js.includes("function _helper"));
    assert.ok(!js.includes("export"));
  });

  it("transpiles fallback chain", () => {
    const js = transpile("_getIp req -> req.socket | req.headers | \"unknown\"");
    assert.ok(js.includes("||"));
    assert.ok(!js.includes(" | "));
  });

  it("transpiles conditional", () => {
    const js = transpile("x > 10? -> doSomething()");
    assert.ok(js.includes("if (x > 10)"));
  });

  it("transpiles each loop", () => {
    const js = transpile("items each k,v -> console.log(k, v)");
    assert.ok(js.includes("for (const [k, v] of items)"));
  });

  it("transpiles function with default params", () => {
    const js = transpile("createLimiter maxReq=100 windowMs=60000 -> null");
    assert.ok(js.includes("maxReq = 100"));
    assert.ok(js.includes("windowMs = 60000"));
  });

  it("transpiles a multi-line module", () => {
    const mcl = [
      "use crypto.randomUUID",
      "",
      "counter: 0",
      "",
      "_increment x -> x + 1",
      "",
      "getNext -> _increment(counter)",
    ].join("\n");

    const js = transpile(mcl);
    console.log("=== Multi-line transpile output ===");
    console.log(js);

    assert.ok(js.includes('import { randomUUID } from "node:crypto"'));
    assert.ok(js.includes("const counter = 0"));
    assert.ok(js.includes("function _increment"));
    assert.ok(js.includes("export function getNext"));
  });
});
