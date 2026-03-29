import { assertDecision } from "./contracts.mjs";

export function analyzeResults(results) {
  const byVariant = {};

  for (const result of results) {
    if (!byVariant[result.variant]) {
      byVariant[result.variant] = {
        totals: [],
        phase_a: [],
        phase_b: [],
      };
    }
    byVariant[result.variant].totals.push(result);
    if (result.phase === "a" || result.phase === "smoke") {
      byVariant[result.variant].phase_a.push(result);
    }
    if (result.phase === "b") {
      byVariant[result.variant].phase_b.push(result);
    }
  }

  const variantSummary = {};
  for (const [variant, value] of Object.entries(byVariant)) {
    variantSummary[variant] = {
      overall: summarizeBucket(value.totals),
      phase_a: summarizeBucket(value.phase_a),
      phase_b: summarizeChainBucket(value.phase_b),
      failure_modes: summarizeFailures(value.totals),
    };
  }

  const readyForDecision = isDecisionReady(variantSummary);
  const decision = decide(variantSummary);
  assertDecision(decision);

  return {
    generated_at: new Date().toISOString(),
    ready_for_decision: readyForDecision,
    variants: variantSummary,
    decision,
  };
}

function summarizeBucket(results) {
  if (results.length === 0) {
    return {
      total: 0,
      pass_count: 0,
      pass_rate: 0,
      median_iterations: 0,
      tokens_in: 0,
      tokens_out: 0,
      runtime_ms: 0,
    };
  }

  const passes = results.filter((item) => item.pass).length;
  const iterations = results.map((item) => item.iterations).sort((left, right) => left - right);
  return {
    total: results.length,
    pass_count: passes,
    pass_rate: passes / results.length,
    median_iterations: median(iterations),
    tokens_in: sum(results.map((item) => item.tokens_in)),
    tokens_out: sum(results.map((item) => item.tokens_out)),
    runtime_ms: sum(results.map((item) => item.runtime_ms)),
  };
}

function summarizeChainBucket(results) {
  const base = summarizeBucket(results);
  if (results.length === 0) {
    return { ...base, corruption_rate: 0 };
  }
  const corruptionCount = results.filter((item) => item.failure_class === "chain_corruption").length;
  return {
    ...base,
    corruption_rate: corruptionCount / results.length,
  };
}

function summarizeFailures(results) {
  return results.reduce((acc, item) => {
    const key = item.failure_class ?? "none";
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
}

function decide(summary) {
  const raw = summary.source_raw?.phase_a ?? summarizeBucket([]);
  const structured = summary.source_structured?.phase_a ?? summarizeBucket([]);
  const candidate = summary.candidate_ir?.phase_a ?? summarizeBucket([]);

  const rawChain = summary.source_raw?.phase_b?.corruption_rate ?? 0;
  const structuredChain = summary.source_structured?.phase_b?.corruption_rate ?? 0;
  const candidateChain = summary.candidate_ir?.phase_b?.corruption_rate ?? 0;

  if (rawChain > 0.3 && structuredChain > 0.3 && candidateChain > 0.3) {
    return "kill_opaque_ir";
  }

  const candidateBeatsRaw = candidate.pass_rate >= raw.pass_rate + 0.1
    || (candidate.pass_rate >= raw.pass_rate && raw.median_iterations > 0 && candidate.median_iterations <= raw.median_iterations * 0.7);

  if (!candidateBeatsRaw) {
    return "kill_opaque_ir";
  }

  const structuredAsGood = structured.pass_rate >= candidate.pass_rate
    && structured.median_iterations <= candidate.median_iterations;

  if (structuredAsGood) {
    return "continue_as_tooling";
  }

  return "continue_as_narrow_ir";
}

function isDecisionReady(summary) {
  const required = ["source_raw", "source_structured", "candidate_ir"];
  return required.every((variant) => {
    const bucket = summary[variant];
    return bucket && bucket.phase_a.total > 0 && bucket.phase_b.total > 0;
  });
}

function median(values) {
  if (values.length === 0) return 0;
  const middle = Math.floor(values.length / 2);
  if (values.length % 2 === 1) return values[middle];
  return (values[middle - 1] + values[middle]) / 2;
}

function sum(values) {
  return values.reduce((total, value) => total + value, 0);
}
