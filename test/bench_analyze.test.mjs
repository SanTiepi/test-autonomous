import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { analyzeResults } from "../bench/lib/analyze.mjs";

describe("benchmark analysis", () => {
  it("continues as narrow IR when candidate clearly beats raw and structured trails", () => {
    const summary = analyzeResults([
      ...makeSeries("source_raw", 10, 5, "a"),
      ...makeSeries("source_structured", 10, 6, "a"),
      ...makeSeries("candidate_ir", 10, 8, "a"),
      ...makeSeries("source_raw", 4, 4, "b"),
      ...makeSeries("source_structured", 4, 4, "b"),
      ...makeSeries("candidate_ir", 4, 4, "b"),
    ]);

    assert.equal(summary.decision, "continue_as_narrow_ir");
    assert.equal(summary.ready_for_decision, true);
  });

  it("continues as tooling when structured matches candidate", () => {
    const summary = analyzeResults([
      ...makeSeries("source_raw", 10, 5, "a"),
      ...makeSeries("source_structured", 10, 8, "a"),
      ...makeSeries("candidate_ir", 10, 8, "a"),
      ...makeSeries("source_raw", 4, 4, "b"),
      ...makeSeries("source_structured", 4, 4, "b"),
      ...makeSeries("candidate_ir", 4, 4, "b"),
    ]);

    assert.equal(summary.decision, "continue_as_tooling");
    assert.equal(summary.ready_for_decision, true);
  });

  it("kills opaque IR when all variants corrupt chains", () => {
    const summary = analyzeResults([
      ...makeSeries("source_raw", 10, 7, "a"),
      ...makeSeries("source_structured", 10, 7, "a"),
      ...makeSeries("candidate_ir", 10, 8, "a"),
      ...makeFailureSeries("source_raw", 4, "chain_corruption"),
      ...makeFailureSeries("source_structured", 4, "chain_corruption"),
      ...makeFailureSeries("candidate_ir", 4, "chain_corruption"),
    ]);

    assert.equal(summary.decision, "kill_opaque_ir");
    assert.equal(summary.ready_for_decision, true);
  });

  it("marks partial datasets as not decision-ready", () => {
    const summary = analyzeResults([
      ...makeSeries("source_raw", 2, 2, "smoke"),
      ...makeSeries("source_structured", 2, 2, "smoke"),
    ]);

    assert.equal(summary.ready_for_decision, false);
  });
});

function makeSeries(variant, total, passing, phase) {
  const results = [];
  for (let index = 0; index < total; index += 1) {
    results.push({
      task_id: `${variant}-${phase}-${index}`,
      variant,
      model: "fake",
      pass: index < passing,
      iterations: 1,
      tokens_in: 10,
      tokens_out: 5,
      runtime_ms: 1,
      failure_class: index < passing ? null : "tests_red",
      chain_index: phase === "b" ? index + 1 : null,
      phase,
    });
  }
  return results;
}

function makeFailureSeries(variant, total, failureClass) {
  const results = [];
  for (let index = 0; index < total; index += 1) {
    results.push({
      task_id: `${variant}-b-${index}`,
      variant,
      model: "fake",
      pass: false,
      iterations: 1,
      tokens_in: 10,
      tokens_out: 5,
      runtime_ms: 1,
      failure_class: failureClass,
      chain_index: index + 2,
      phase: "b",
    });
  }
  return results;
}
