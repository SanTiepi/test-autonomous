import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { estimateTokens, compare, noiseAnalysis } from "../src/mcl/tokenizer.mjs";

describe("MCL tokenizer", () => {
  it("estimates tokens for simple JS", () => {
    const tokens = estimateTokens("const x = 42;");
    assert.ok(tokens >= 4 && tokens <= 8);
  });

  it("estimates tokens for MCL equivalent", () => {
    const tokens = estimateTokens("x: 42");
    assert.ok(tokens >= 2 && tokens <= 4);
  });
});

describe("MCL compare", () => {
  it("shows MCL savings on function declaration", () => {
    const js = 'export function createRateLimiter({ maxRequests = 100, windowMs = 60000 } = {}) {';
    const mcl = 'createRateLimiter maxRequests=100 windowMs=60000 ->';
    const result = compare(js, mcl);
    assert.ok(result.savings_pct > 30, `Expected >30% savings, got ${result.savings_pct}%`);
    assert.ok(result.density_ratio > 1.3);
  });

  it("shows MCL savings on variable declaration", () => {
    const js = 'const clients = new Map();';
    const mcl = 'clients: Map';
    const result = compare(js, mcl);
    assert.ok(result.savings_pct > 40);
  });

  it("shows MCL savings on conditional", () => {
    const js = 'if (!entry || now >= entry.resetAt) { entry = { count: 0, resetAt: now + windowMs }; }';
    const mcl = 'entry expired? -> entry = {count:0 resetAt:now+windowMs}';
    const result = compare(js, mcl);
    assert.ok(result.savings_pct > 20);
  });

  it("shows MCL savings on full module", () => {
    const js = [
      'import { randomUUID } from "node:crypto";',
      'export function createRateLimiter({ maxRequests = 100, windowMs = 60000, maxClients = 10000 } = {}) {',
      '  const clients = new Map();',
      '  function getClientIp(req) {',
      '    return req.socket?.remoteAddress || req.headers?.["x-forwarded-for"] || "unknown";',
      '  }',
      '  function cleanup(now) {',
      '    for (const [ip, entry] of clients) {',
      '      if (now >= entry.resetAt) clients.delete(ip);',
      '    }',
      '  }',
      '  return function wrapWithRateLimit(handler) {',
      '    return async function rateLimitedHandler(req, res) {',
      '      const now = Date.now();',
      '      const ip = getClientIp(req);',
      '      if (Math.random() < 0.1) cleanup(now);',
      '      await handler(req, res);',
      '    };',
      '  };',
      '}',
    ].join("\n");

    const mcl = [
      'use crypto.randomUUID',
      'createRateLimiter maxRequests=100 windowMs=60000 maxClients=10000 ->',
      '  clients: Map',
      '  _clientIp req -> req.socket?.remoteAddress | req.headers.x-forwarded-for | "unknown"',
      '  _cleanup now -> clients each ip,entry -> entry.resetAt<=now? clients.del ip',
      '  -> wrap handler ->async req,res ->',
      '    now: Date.now',
      '    ip: _clientIp req',
      '    random<0.1? _cleanup now',
      '    handler req res',
    ].join("\n");

    const result = compare(js, mcl);
    assert.ok(result.savings_pct > 35, `Expected >35% savings on full module, got ${result.savings_pct}%`);
    console.log(`Full module: JS=${result.original_tokens}tok MCL=${result.mcl_tokens}tok savings=${result.savings_pct}% density=${result.density_ratio}x`);
  });
});

describe("noise analysis", () => {
  it("detects high noise in JS", () => {
    const js = 'export function foo(x) { const y = x + 1; return y; }';
    const result = noiseAnalysis(js);
    assert.ok(result.noise_pct > 30, `Expected >30% noise, got ${result.noise_pct}%`);
  });

  it("detects low noise in MCL", () => {
    const mcl = 'foo x -> y: x+1 -> y';
    const result = noiseAnalysis(mcl);
    assert.ok(result.noise_pct < 20, `Expected <20% noise in MCL, got ${result.noise_pct}%`);
  });

  it("JS has more noise than MCL for equivalent logic", () => {
    const js = 'const clients = new Map(); for (const [ip, entry] of clients) { if (now >= entry.resetAt) clients.delete(ip); }';
    const mcl = 'clients: Map clients each ip,entry -> entry.resetAt<=now? clients.del ip';
    const jsNoise = noiseAnalysis(js);
    const mclNoise = noiseAnalysis(mcl);
    assert.ok(jsNoise.noise_pct > mclNoise.noise_pct,
      `JS noise (${jsNoise.noise_pct}%) should > MCL noise (${mclNoise.noise_pct}%)`);
  });
});
