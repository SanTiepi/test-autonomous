import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { transpile } from "../src/mcl/transpile.mjs";
import { readFileSync } from "node:fs";
import { estimateTokens, compare, noiseAnalysis } from "../src/mcl/tokenizer.mjs";

describe("MCL rate_limiter transpilation", () => {
  const mcl = readFileSync("src/mcl/examples/rate_limiter.mcl", "utf8");
  const jsOriginal = readFileSync("src/rate_limiter.mjs", "utf8");

  it("transpiles without error", () => {
    const js = transpile(mcl);
    assert.ok(js.length > 0);
    console.log("=== MCL rate_limiter → JS ===");
    console.log(js);
  });

  it("produces valid JS structure", () => {
    const js = transpile(mcl);
    assert.ok(js.includes("import { randomUUID }"), "should have import");
    assert.ok(js.includes("function createRateLimiter"), "should have main function");
    assert.ok(js.includes("const clients = new Map()"), "should have Map declaration");
  });

  it("MCL is significantly shorter than JS", () => {
    const result = compare(jsOriginal, mcl);
    console.log(`\n=== Token comparison ===`);
    console.log(`JS original: ${result.original_tokens} tokens`);
    console.log(`MCL source:  ${result.mcl_tokens} tokens`);
    console.log(`Savings:     ${result.savings_pct}%`);
    console.log(`Density:     ${result.density_ratio}x`);
    assert.ok(result.savings_pct > 25, `Expected >25% savings, got ${result.savings_pct}%`);
  });

  it("MCL has less noise than JS", () => {
    const jsNoise = noiseAnalysis(jsOriginal);
    const mclNoise = noiseAnalysis(mcl);
    console.log(`\n=== Noise analysis ===`);
    console.log(`JS:  ${jsNoise.noise_pct}% noise (${jsNoise.noise}/${jsNoise.total} tokens)`);
    console.log(`MCL: ${mclNoise.noise_pct}% noise (${mclNoise.noise}/${mclNoise.total} tokens)`);
    assert.ok(jsNoise.noise_pct > mclNoise.noise_pct,
      `JS noise (${jsNoise.noise_pct}%) should > MCL noise (${mclNoise.noise_pct}%)`);
  });

  it("MCL lines count is lower", () => {
    const jsLines = jsOriginal.split("\n").filter(l => l.trim()).length;
    const mclLines = mcl.split("\n").filter(l => l.trim()).length;
    console.log(`\n=== Line count ===`);
    console.log(`JS:  ${jsLines} non-empty lines`);
    console.log(`MCL: ${mclLines} non-empty lines`);
    assert.ok(mclLines < jsLines, `MCL (${mclLines}) should have fewer lines than JS (${jsLines})`);
  });
});
