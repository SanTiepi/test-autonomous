import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { transpile } from "../src/mcl/transpile.mjs";
import { readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { tmpdir } from "node:os";
import { join } from "node:path";

describe("MCL end-to-end: transpile → execute", () => {
  it("math module: transpile MCL, import JS, run functions", async () => {
    const mcl = readFileSync("src/mcl/examples/math.mcl", "utf8");
    const js = transpile(mcl);

    console.log("=== Transpiled math.mcl ===");
    console.log(js);

    // Write transpiled JS to temp file
    const tmpFile = join(tmpdir(), `mcl_math_${Date.now()}.mjs`);
    writeFileSync(tmpFile, js);

    try {
      // Dynamic import of transpiled code
      const mod = await import(pathToFileURL(tmpFile).href);

      // Test exported functions
      assert.equal(mod.add(2, 3), 5, "add(2, 3) should be 5");
      assert.equal(mod.add(-1, 1), 0, "add(-1, 1) should be 0");
      assert.equal(mod.multiply(4, 5), 20, "multiply(4, 5) should be 20");
      assert.equal(mod.square(7), 49, "square(7) should be 49");
      assert.equal(mod.identity("hello"), "hello", "identity should pass through");
      assert.equal(mod.compose(x => x + 1, x => x * 2, 3), 7, "compose(+1, *2, 3) = 7");

      // _double should NOT be exported (private)
      assert.equal(mod._double, undefined, "_double should not be exported");

      console.log("\n=== All MCL math functions executed correctly! ===");
    } finally {
      unlinkSync(tmpFile);
    }
  });

  it("inline module: transpile and execute binding + conditional", async () => {
    const mcl = [
      "threshold: 10",
      "isAbove x,limit -> x > limit",
      "clamp x,min,max -> Math.max(min, Math.min(max, x))",
    ].join("\n");

    const js = transpile(mcl);
    const tmpFile = join(tmpdir(), `mcl_inline_${Date.now()}.mjs`);
    writeFileSync(tmpFile, js);

    try {
      const mod = await import(pathToFileURL(tmpFile).href);
      assert.equal(mod.threshold, 10);
      assert.equal(mod.isAbove(15, 10), true);
      assert.equal(mod.isAbove(5, 10), false);
      assert.equal(mod.clamp(50, 0, 100), 50);
      assert.equal(mod.clamp(-5, 0, 100), 0);
      assert.equal(mod.clamp(200, 0, 100), 100);
      console.log("=== Inline module executed correctly! ===");
    } finally {
      unlinkSync(tmpFile);
    }
  });

  it("fallback chain executes correctly", async () => {
    const mcl = [
      'fallback a,b,c -> a | b | c',
    ].join("\n");

    const js = transpile(mcl);
    const tmpFile = join(tmpdir(), `mcl_fallback_${Date.now()}.mjs`);
    writeFileSync(tmpFile, js);

    try {
      const mod = await import(pathToFileURL(tmpFile).href);
      assert.equal(mod.fallback(null, "backup", "last"), "backup");
      assert.equal(mod.fallback("first", "backup", "last"), "first");
      assert.equal(mod.fallback(null, null, "last"), "last");
      assert.equal(mod.fallback(0, "backup", "last"), "backup"); // 0 is falsy
      console.log("=== Fallback chain executed correctly! ===");
    } finally {
      unlinkSync(tmpFile);
    }
  });
});
