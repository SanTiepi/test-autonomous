import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { computeThresholds, efficiencyVector, nextFocus } from "../src/lang/adaptive.mjs";

describe("computeThresholds", () => {
  it("returns conservative defaults with no history", () => {
    const t = computeThresholds([]);
    assert.equal(t.failure_streak_limit, 3);
    assert.equal(t.critic_reassess_after, 2);
    assert.equal(t.source, "defaults");
  });

  it("adapts from real metrics history", () => {
    const history = [
      { autonomy: { self_corrections: 3, stuck_episodes: 0 }, critic: { invocations: 4, false_alarms: 0 }, self_boost: { boost_velocity: 0.67 }, protocol: { mil_compliance_rate: 0.33 }, agents: { spawn_roi: 0.875 } },
      { autonomy: { self_corrections: 2, stuck_episodes: 1 }, critic: { invocations: 5, false_alarms: 1 }, self_boost: { boost_velocity: 1.2 }, protocol: { mil_compliance_rate: 0.9 }, agents: { spawn_roi: 0.8 } },
    ];
    const t = computeThresholds(history);
    assert.equal(t.source, "computed_from_2_sessions");
    assert.ok(t.failure_streak_limit >= 2);
    assert.ok(t.agent_spawn_max >= 3);
  });

  it("raises compliance bar when trend is positive", () => {
    const history = [
      { protocol: { mil_compliance_rate: 0.2 } },
      { protocol: { mil_compliance_rate: 0.8 } },
    ];
    const t = computeThresholds(history);
    assert.equal(t.min_compliance_rate, 0.8);
  });

  it("lowers compliance bar when trend is flat", () => {
    const history = [
      { protocol: { mil_compliance_rate: 0.3 } },
      { protocol: { mil_compliance_rate: 0.3 } },
    ];
    const t = computeThresholds(history);
    assert.equal(t.min_compliance_rate, 0.5);
  });
});

describe("efficiencyVector", () => {
  it("computes 5D vector from metrics", () => {
    const metrics = {
      tasks: { throughput: 3 },
      protocol: { token_savings_pct: 0.55, mil_compliance_rate: 1.0 },
      autonomy: { decisions_without_human: 12, user_interruptions: 4, self_corrections: 3 },
      evolution: { findings: ["a", "b", "c"], experiment_results: 2 },
    };
    const v = efficiencyVector(metrics);
    assert.equal(v.length, 5);
    assert.equal(v[0], 0.6); // task_velocity: 3/5
    assert.equal(v[1], 0.55); // token_efficiency
    assert.equal(v[2], 1.0); // compliance
    assert.ok(v[3] > 0); // self_correction
    assert.ok(v[4] > 0); // evolution
  });

  it("handles empty metrics", () => {
    const v = efficiencyVector({});
    assert.equal(v.length, 5);
    assert.deepEqual(v, [0, 0, 0, 0, 0]);
  });
});

describe("nextFocus", () => {
  it("identifies weakest dimension", () => {
    const v = [0.85, 0.72, 1.0, 0.90, 0.30];
    const focus = nextFocus(v);
    assert.equal(focus.weakest, "evolution_rate");
    assert.equal(focus.value, 0.30);
    assert.ok(focus.suggestion.includes("experiment"));
  });

  it("suggests token efficiency when lowest", () => {
    const v = [0.90, 0.20, 0.80, 0.85, 0.70];
    const focus = nextFocus(v);
    assert.equal(focus.weakest, "token_efficiency");
    assert.ok(focus.suggestion.includes("v0.2b"));
  });
});
