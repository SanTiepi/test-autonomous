import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { transpile } from "../src/mcl/transpile.mjs";
import { writeFileSync, unlinkSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { tmpdir } from "node:os";
import { join } from "node:path";

async function execMCL(mcl) {
  const js = transpile(mcl);
  const tmpFile = join(tmpdir(), `ben_${Date.now()}_${Math.random().toString(36).slice(2)}.mjs`);
  writeFileSync(tmpFile, js);
  try {
    return await import(pathToFileURL(tmpFile).href);
  } finally {
    unlinkSync(tmpFile);
  }
}

describe("Benoît implicit return", () => {
  it("block function returns last expression", async () => {
    const mod = await execMCL([
      "makeGreeter name ->",
      "  greeting: `Hello ${name}`",
      "  greeting",
    ].join("\n"));
    assert.equal(mod.makeGreeter("World"), "Hello World");
  });

  it("nested function returns inner function", async () => {
    const mod = await execMCL([
      "multiplier factor ->",
      "  _apply x -> x * factor",
      "  _apply",
    ].join("\n"));
    const double = mod.multiplier(2);
    assert.equal(typeof double, "function");
    assert.equal(double(5), 10);
  });

  it("factory returns closure", async () => {
    const mod = await execMCL([
      "counter start=0 ->",
      "  count: {value: start}",
      "  _increment -> count.value++",
      "  _get -> count.value",
      "  {increment: _increment, get: _get}",
    ].join("\n"));
    const c = mod.counter(10);
    assert.equal(c.get(), 10);
    c.increment();
    assert.equal(c.get(), 11);
  });

  it("no implicit return on declarations (last line is const)", async () => {
    const js = transpile([
      "setup ->",
      "  config: {port: 3000}",
    ].join("\n"));
    // Should NOT be "return const config = ..."
    assert.ok(!js.includes("return const"), "should not return a declaration");
    assert.ok(js.includes("const config = {port: 3000}"));
  });

  it("no implicit return on if statements", async () => {
    const js = transpile([
      "validate x ->",
      "  x > 0? console.log(x)",
    ].join("\n"));
    assert.ok(!js.includes("return if"), "should not return an if statement");
  });
});

describe("Benoît function composition (real execution)", () => {
  it("compose pipeline with closures", async () => {
    const mod = await execMCL([
      "pipe f,g ->",
      "  _composed x -> g(f(x))",
      "  _composed",
    ].join("\n"));
    const addThenDouble = mod.pipe(x => x + 1, x => x * 2);
    assert.equal(addThenDouble(3), 8);  // (3+1)*2
  });

  it("higher-order functions", async () => {
    const mod = await execMCL([
      "mapper fn ->",
      "  _apply arr -> arr.map(fn)",
      "  _apply",
    ].join("\n"));
    const doubleAll = mod.mapper(x => x * 2);
    assert.deepEqual(doubleAll([1, 2, 3]), [2, 4, 6]);
  });
});
