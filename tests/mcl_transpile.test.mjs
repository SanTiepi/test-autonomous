import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { transpile } from "../src/mcl/transpile.mjs";

describe("MCL transpiler v0.1", () => {
  // 1. use X.Y -> import { Y } from "node:X";
  describe("use statement", () => {
    it("transforms use X.Y to import", () => {
      const result = transpile("use crypto.randomUUID");
      assert.equal(result, 'import { randomUUID } from "node:crypto";');
    });

    it("transforms use with different module", () => {
      const result = transpile("use fs.readFile");
      assert.equal(result, 'import { readFile } from "node:fs";');
    });
  });

  // 2. name args -> body (exported function)
  describe("exported function", () => {
    it("transforms inline function with single arg", () => {
      const result = transpile("greet name -> `Hello ${name}`");
      assert.equal(result, "export function greet(name) { return `Hello ${name}`; }");
    });

    it("transforms function with default params", () => {
      const result = transpile("createServer port=3000 host=localhost ->").split("\n")[0];
      assert.equal(result, "export function createServer(port = 3000, host = localhost) {");
    });

    it("transforms function with multiple args", () => {
      const result = transpile("add a b -> a + b");
      assert.equal(result, "export function add(a, b) { return a + b; }");
    });
  });

  // 3. _name args -> body (private function, no export)
  describe("private function", () => {
    it("transforms private inline function", () => {
      const result = transpile("_helper x -> x * 2");
      assert.equal(result, "function _helper(x) { return x * 2; }");
    });

    it("transforms private block function", () => {
      const result = transpile("_cleanup now ->\n  console.log(now)");
      assert.equal(result, "function _cleanup(now) {\n  return console.log(now)\n}");
    });
  });

  // 4. name: Type (Map, Set, Array)
  describe("type instantiation", () => {
    it("transforms Map declaration", () => {
      assert.equal(transpile("clients: Map"), "export const clients = new Map();");
    });

    it("transforms Set declaration", () => {
      assert.equal(transpile("seen: Set"), "export const seen = new Set();");
    });

    it("transforms Array declaration", () => {
      assert.equal(transpile("items: Array"), "export const items = new Array();");
    });
  });

  // 5. name: value (literal binding)
  describe("literal binding", () => {
    it("transforms string binding", () => {
      assert.equal(transpile('name: "world"'), 'export const name = "world";');
    });

    it("transforms number binding", () => {
      assert.equal(transpile("count: 42"), "export const count = 42;");
    });

    it("transforms expression binding", () => {
      assert.equal(transpile("now: Date.now()"), "export const now = Date.now();");
    });
  });

  // 6. condition? -> action
  describe("conditional", () => {
    it("transforms inline conditional", () => {
      const result = transpile("count > 10? -> console.log(count)");
      assert.equal(result, "if (count > 10) { console.log(count) }");
    });

    it("transforms simple condition", () => {
      const result = transpile("expired? -> reset()");
      assert.equal(result, "if (expired) { reset() }");
    });

    it("transforms block conditional", () => {
      const result = transpile("ready? ->\n  doStuff()\n  finish()");
      assert.equal(result, "if (ready) {\n  doStuff()\n  finish()\n}");
    });
  });

  // 7. collection each k,v -> body
  describe("each loop", () => {
    it("transforms inline each loop", () => {
      const result = transpile("clients each ip,entry -> console.log(ip)");
      assert.equal(result, "for (const [ip, entry] of clients) { console.log(ip) }");
    });

    it("transforms block each loop", () => {
      const result = transpile("map each k,v ->\n  console.log(k, v)");
      assert.equal(result, "for (const [k, v] of map) {\n  console.log(k, v)\n}");
    });
  });

  // 8. a | b | c -> a || b || c (fallback chain)
  describe("fallback chain", () => {
    it("transforms pipe to logical OR", () => {
      const result = transpile('x: a | b | "default"');
      assert.equal(result, 'export const x = a || b || "default";');
    });

    it("transforms pipe in function body", () => {
      const result = transpile('_getIp req -> req.ip | req.headers.host | "unknown"');
      assert.equal(result, 'function _getIp(req) { return req.ip || req.headers.host || "unknown"; }');
    });
  });

  // Indentation / scope
  describe("indentation and scope", () => {
    it("preserves indentation in blocks", () => {
      const mcl = [
        "createApp port=3000 ->",
        "  clients: Map",
        '  name: "app"',
      ].join("\n");
      const js = transpile(mcl);
      const lines = js.split("\n");
      assert.equal(lines[0], "export function createApp(port = 3000) {");
      assert.equal(lines[1], "  const clients = new Map();");
      assert.equal(lines[2], '  const name = "app";');
      assert.equal(lines[3], "}");
    });

    it("handles blank lines", () => {
      const mcl = "use fs.readFile\n\ncount: 42";
      const js = transpile(mcl);
      const lines = js.split("\n");
      assert.equal(lines.length, 3);
      assert.equal(lines[1], "");
    });
  });

  // Combined / integration
  describe("integration", () => {
    it("transpiles a multi-line MCL snippet", () => {
      const mcl = [
        "use crypto.randomUUID",
        "",
        "createLimiter max=100 ->",
        "  clients: Map",
        "  _cleanup now -> console.log(now)",
      ].join("\n");
      const js = transpile(mcl);
      const lines = js.split("\n");
      assert.equal(lines[0], 'import { randomUUID } from "node:crypto";');
      assert.equal(lines[1], "");
      assert.equal(lines[2], "export function createLimiter(max = 100) {");
      assert.equal(lines[3], "  const clients = new Map();");
      // private inline function inside block
      assert.ok(lines[4].includes("function _cleanup(now)"));
      assert.equal(lines[5], "}");
    });
  });
});
