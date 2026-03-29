import assert from "node:assert/strict";

export const TASK_ASSERTIONS = {
  mil_bugfix_trim_register_op: async ({ mod }) => {
    const before = new Set(mod.getOps());
    const added = mod.registerOp("  trim_patch  ");
    assert.equal(added, !before.has("TRIM_PATCH"));
    assert.ok(mod.getOps().includes("TRIM_PATCH"));
    assert.throws(() => mod.registerOp("   "), /non-empty/i);
  },
  mil_refactor_split_lines: async ({ source }) => {
    assert.ok((source.match(/splitMilLines\s*\(/g) ?? []).length >= 3);
  },
  mil_bugfix_duplicate_fields: async ({ mod }) => {
    assert.throws(() => mod.decode("OP REVIEW\nTGT a\nTGT b"), /duplicate/i);
    assert.throws(() => mod.decode("OP REVIEW\nOP TEST"), /duplicate/i);
  },
  mil_feature_get_core_ops: async ({ mod }) => {
    assert.equal(typeof mod.getCoreOps, "function");
    const baseline = mod.getCoreOps();
    assert.ok(Array.isArray(baseline));
    mod.registerOp("runtime_only");
    assert.ok(!mod.getCoreOps().includes("RUNTIME_ONLY"));
  },
  mil_refactor_encode_field_order: async ({ mod, source }) => {
    assert.ok(/export function encode[\s\S]*FIELD_ORDER/.test(source));
    const value = mod.encode({
      op: "REVIEW",
      tgt: "x",
      root: "root",
      ctx: "ctx",
      arg: { focus: "perf" },
      out: "done",
      pri: 2,
    });
    assert.equal(value, "OP REVIEW\nTGT x\nROOT root\nCTX ctx\nARG focus=perf\nOUT done\nPRI 2");
  },
  mil_bugfix_response_cost_validation: async ({ mod }) => {
    assert.throws(() => mod.decodeResponse("STATUS DONE\nDATA ok\nCOST nope"));
    assert.throws(() => mod.decodeResponse("STATUS DONE\nDATA ok\nCOST -1"));
    const resp = mod.decodeResponse("STATUS DONE\nDATA ok\nCOST 0");
    assert.equal(resp.cost, 0);
  },
  mil_bugfix_duplicate_response_fields: async ({ mod }) => {
    assert.throws(() => mod.decodeResponse("STATUS DONE\nSTATUS FAIL\nDATA ok"), /duplicate/i);
    assert.throws(() => mod.decodeResponse("STATUS DONE\nDATA ok\nDATA again"), /duplicate/i);
  },
  mil_feature_decode_batch: async ({ mod }) => {
    assert.equal(typeof mod.decodeBatch, "function");
    const batch = mod.decodeBatch("OP REVIEW\nTGT a\n\nOP SEARCH\nTGT src/");
    assert.equal(batch.length, 2);
    assert.equal(batch[0].op, "REVIEW");
    assert.equal(batch[1].op, "SEARCH");
  },
  mil_feature_benchmark_numeric_ratios: async ({ mod }) => {
    const result = mod.benchmark({
      mil: "OP REVIEW",
      json: '{"op":"review"}',
      prose: "Please review this file.",
    });
    assert.equal(typeof result.mil_vs_prose_ratio, "number");
    assert.equal(typeof result.mil_vs_json_ratio, "number");
    assert.ok("savings_vs_prose" in result);
    assert.ok("savings_vs_json" in result);
  },
  mil_refactor_encode_response_order: async ({ mod, source }) => {
    assert.ok(/export function encodeResponse[\s\S]*RESP_ORDER/.test(source));
    const value = mod.encodeResponse({ status: "DONE", data: "ok", next: "OP TEST", cost: 4 });
    assert.equal(value, "STATUS DONE\nDATA ok\nNEXT OP TEST\nCOST 4");
  },
  compliance_bugfix_empty_check: async ({ mod }) => {
    const result = mod.checkCompliance("   \n   ");
    assert.equal(result.compliant, false);
    assert.equal(result.lines, 0);
    assert.equal(result.words, 0);
  },
  compliance_bugfix_empty_density: async ({ mod }) => {
    const empty = mod.semanticDensity("", 0);
    const spaces = mod.semanticDensity("   \n", 0);
    assert.deepEqual(empty, { density: 0, rating: "very_low" });
    assert.deepEqual(spaces, { density: 0, rating: "very_low" });
  },
  compliance_refactor_response_metrics_helper: async ({ source }) => {
    assert.ok((source.match(/measureResponse\s*\(/g) ?? []).length >= 3);
  },
  compliance_feature_normalize_mil_response: async ({ mod }) => {
    assert.equal(typeof mod.normalizeMilResponse, "function");
    const result = mod.checkCompliance("\uFEFFSTATUS APPROVE\r\nDATA ok");
    assert.equal(result.compliant, true);
  },
  compliance_feature_compliance_summary: async ({ mod }) => {
    assert.equal(typeof mod.complianceSummary, "function");
    const result = mod.complianceSummary([
      "STATUS APPROVE\nDATA ok",
      "bad prose",
      "STATUS FAIL\nDATA no",
    ]);
    assert.equal(result.total, 3);
    assert.equal(result.compliant, 2);
    assert.equal(result.non_compliant, 1);
    assert.equal(typeof result.rate, "number");
  },
  compliance_bugfix_nonfinite_rate: async ({ mod }) => {
    const format = "STATUS DONE\nDATA X";
    assert.ok(mod.autoTunePromptPrefix(Number.NaN, format).includes("CRITICAL"));
    assert.ok(mod.autoTunePromptPrefix(Number.POSITIVE_INFINITY, format).includes("Reply in MIL format"));
  },
  compliance_bugfix_freeze_response_formats: async ({ mod }) => {
    assert.ok(Object.isFrozen(mod.RESPONSE_FORMATS));
    const before = mod.RESPONSE_FORMATS.critic;
    try {
      mod.RESPONSE_FORMATS.critic = "BROKEN";
    } catch {}
    assert.equal(mod.RESPONSE_FORMATS.critic, before);
  },
  compliance_refactor_prose_density_helper: async ({ source }) => {
    assert.ok((source.match(/scoreProseDensity\s*\(/g) ?? []).length >= 2);
  },
  compliance_feature_describe_band: async ({ mod }) => {
    assert.equal(typeof mod.describeComplianceBand, "function");
    assert.equal(mod.describeComplianceBand(0.95), "high");
    assert.equal(mod.describeComplianceBand(0.6), "medium");
    assert.equal(mod.describeComplianceBand(0.2), "low");
  },
  compliance_refactor_prompt_builder_helper: async ({ mod, source }) => {
    assert.ok((source.match(/getResponseFormat\s*\(/g) ?? []).length >= 2);
    assert.throws(() => mod.buildAgentPrompt("unknown", "OP TEST"), /Unknown agent type/);
  },
};
