import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { encode, encodeResponse, estimateTokens, benchmark } from "../src/lang/mil.mjs";

describe("MIL real-world benchmarks", () => {
  it("critic review: MIL vs JSON vs prose", () => {
    const mil = encode({
      op: "REVIEW",
      tgt: "src/rate_limiter.mjs",
      ctx: "54t_pass mid02_done 0dep_added fixed_window",
      arg: { focus: "architecture,perf", risk: "memory_leak_per_ip" },
      out: "VERDICT reason",
      pri: 5,
    });

    const json = JSON.stringify({
      role: "critic",
      action: "review",
      target: "src/rate_limiter.mjs",
      context: {
        tests_passing: 54,
        task: "MID-02",
        dependencies_added: 0,
        pattern: "fixed_window",
      },
      args: {
        focus: ["architecture", "performance"],
        risk: "potential memory leak from per-IP tracking",
      },
      expected_output: "verdict with reasoning",
      priority: 5,
    });

    const prose = [
      "You are a senior code reviewer. Please review the rate_limiter.mjs implementation.",
      "Context: we have 54 tests passing, MID-02 has been implemented with a fixed-window",
      "rate limiter, no new dependencies were added.",
      "Focus on architecture and performance.",
      "My main concern is a potential memory leak from per-IP tracking in the Map.",
      "Please respond with your verdict and reasoning. Priority: medium.",
    ].join(" ");

    const result = benchmark({ mil, json, prose });

    console.log("=== Real Critic Review Benchmark ===");
    console.log(`MIL:   ${result.mil} tokens (${mil.length} chars)`);
    console.log(`JSON:  ${result.json} tokens (${json.length} chars)`);
    console.log(`Prose: ${result.prose} tokens (${prose.length} chars)`);
    console.log(`Savings vs prose: ${result.savings_vs_prose}`);
    console.log(`Savings vs JSON:  ${result.savings_vs_json}`);

    assert.ok(result.mil < result.prose, `MIL (${result.mil}) should < prose (${result.prose})`);
    assert.ok(result.mil < result.json, `MIL (${result.mil}) should < JSON (${result.json})`);
  });

  it("scout search: MIL vs JSON vs prose", () => {
    const mil = encode({
      op: "SEARCH",
      tgt: "src/",
      ctx: "fresh_session no_prior_knowledge",
      arg: { depth: "shallow", pattern: "*.mjs" },
      out: "files_patterns_gaps",
      pri: 3,
    });

    const json = JSON.stringify({
      role: "scout",
      action: "search",
      target: "src/",
      context: "fresh session with no prior knowledge of codebase",
      args: { depth: "shallow", file_pattern: "*.mjs" },
      expected_output: "list of files, patterns observed, and gaps found",
      priority: 3,
    });

    const prose = [
      "You are a codebase scout. Please explore the src/ directory.",
      "This is a fresh session and I have no prior knowledge of this codebase.",
      "Do a shallow exploration, focusing on .mjs files.",
      "Report back with: files found, patterns observed, and any gaps.",
      "Priority: low.",
    ].join(" ");

    const result = benchmark({ mil, json, prose });

    console.log("\n=== Scout Search Benchmark ===");
    console.log(`MIL:   ${result.mil} tokens (${mil.length} chars)`);
    console.log(`JSON:  ${result.json} tokens (${json.length} chars)`);
    console.log(`Prose: ${result.prose} tokens (${prose.length} chars)`);
    console.log(`Savings vs prose: ${result.savings_vs_prose}`);
    console.log(`Savings vs JSON:  ${result.savings_vs_json}`);

    assert.ok(result.mil < result.prose);
    assert.ok(result.mil < result.json);
  });

  it("verify test: MIL vs JSON vs prose", () => {
    const mil = encode({
      op: "TEST",
      tgt: "tests/",
      arg: { include: "test,build,lint" },
      out: "pass_fail_summary",
      pri: 7,
    });

    const json = JSON.stringify({
      role: "verify",
      action: "test",
      target: "tests/",
      args: { include: ["test", "build", "lint"] },
      expected_output: "pass/fail summary",
      priority: 7,
    });

    const prose = [
      "You are a verification agent. Please run all tests in the tests/ directory,",
      "then run the build if configured, and finally run lint.",
      "Report back with pass/fail counts for each. Priority: high.",
    ].join(" ");

    const result = benchmark({ mil, json, prose });

    console.log("\n=== Verify Test Benchmark ===");
    console.log(`MIL:   ${result.mil} tokens (${mil.length} chars)`);
    console.log(`JSON:  ${result.json} tokens (${json.length} chars)`);
    console.log(`Prose: ${result.prose} tokens (${prose.length} chars)`);
    console.log(`Savings vs prose: ${result.savings_vs_prose}`);
    console.log(`Savings vs JSON:  ${result.savings_vs_json}`);

    assert.ok(result.mil < result.prose);
  });

  it("response benchmark: MIL vs JSON vs prose", () => {
    const mil = encodeResponse({
      status: "CHALLENGE",
      data: "memory_leak Map_grows_unbounded per_ip_no_cleanup",
      next: "OP REFACTOR TGT rate_limiter.mjs ARG pattern=lru_cache",
    });

    const json = JSON.stringify({
      verdict: "CHALLENGE",
      risk: "The Map storing per-IP request counts grows unboundedly with no cleanup mechanism",
      suggestion: "Refactor rate_limiter.mjs to use an LRU cache pattern instead of a plain Map",
    });

    const prose = [
      "CHALLENGE: The per-IP tracking Map in rate_limiter.mjs has a potential memory leak.",
      "The Map grows unboundedly because there is no cleanup mechanism for IPs that stop",
      "making requests. SUGGEST: Refactor to use an LRU cache pattern that automatically",
      "evicts entries after the window expires.",
    ].join(" ");

    const result = benchmark({ mil, json, prose });

    console.log("\n=== Response Benchmark ===");
    console.log(`MIL:   ${result.mil} tokens (${mil.length} chars)`);
    console.log(`JSON:  ${result.json} tokens (${json.length} chars)`);
    console.log(`Prose: ${result.prose} tokens (${prose.length} chars)`);
    console.log(`Savings vs prose: ${result.savings_vs_prose}`);
    console.log(`Savings vs JSON:  ${result.savings_vs_json}`);

    assert.ok(result.mil < result.prose);
    assert.ok(result.mil < result.json);
  });
});
