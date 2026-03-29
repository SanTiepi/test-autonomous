// Adaptive thresholds — computed from metrics history, not hardcoded
// Replaces: "3 failures → change strategy", "2 challenges → reassess", etc.

import { readFileSync, existsSync } from "node:fs";

/**
 * Load metrics history from jsonl file.
 * @param {string} path
 * @returns {object[]}
 */
export function loadMetrics(path = "docs/metrics.jsonl") {
  if (!existsSync(path)) return [];
  return readFileSync(path, "utf8")
    .trim()
    .split("\n")
    .filter(Boolean)
    .map(line => JSON.parse(line));
}

/**
 * Compute adaptive thresholds from metrics history.
 * @param {object[]} history — array of session metrics
 * @returns {object} thresholds
 */
export function computeThresholds(history) {
  if (history.length === 0) {
    // Cold start — use conservative defaults
    return {
      failure_streak_limit: 3,
      critic_reassess_after: 2,
      self_boost_repetitions: 2,
      min_compliance_rate: 0.5,
      agent_spawn_max: 5,
      source: "defaults",
    };
  }

  const recent = history.slice(-5); // last 5 sessions

  // Failure streak: adapt based on how many failures typically precede a fix
  const selfCorrections = avg(recent.map(s => s.autonomy?.self_corrections ?? 0));
  const stuckEpisodes = avg(recent.map(s => s.autonomy?.stuck_episodes ?? 0));
  const failureLimit = Math.max(2, Math.ceil((selfCorrections + 1) * 0.8));

  // Critic reassess: adapt based on historical false alarm rate
  const falseAlarms = avg(recent.map(s => s.critic?.false_alarms ?? 0));
  const invocations = avg(recent.map(s => s.critic?.invocations ?? 1));
  const falseAlarmRate = falseAlarms / Math.max(1, invocations);
  const criticReassess = falseAlarmRate > 0.3 ? 3 : falseAlarmRate > 0.1 ? 2 : 1;

  // Self-boost: adapt based on boost velocity trend
  const boostVelocity = avg(recent.map(s => s.self_boost?.boost_velocity ?? 0));
  const boostReps = boostVelocity > 1.0 ? 3 : boostVelocity > 0.5 ? 2 : 1;

  // Compliance: target based on trend
  const complianceRates = recent.map(s => s.protocol?.mil_compliance_rate ?? 0);
  const complianceTrend = complianceRates.length > 1
    ? complianceRates[complianceRates.length - 1] - complianceRates[0]
    : 0;
  const minCompliance = complianceTrend > 0 ? 0.8 : 0.5; // raise bar if improving

  // Agent spawns: adapt based on ROI
  const spawnRoi = avg(recent.map(s => s.agents?.spawn_roi ?? 0.8));
  const agentMax = spawnRoi > 0.8 ? 8 : spawnRoi > 0.5 ? 5 : 3;

  return {
    failure_streak_limit: failureLimit,
    critic_reassess_after: criticReassess,
    self_boost_repetitions: boostReps,
    min_compliance_rate: minCompliance,
    agent_spawn_max: agentMax,
    source: `computed_from_${recent.length}_sessions`,
  };
}

/**
 * Compute efficiency vector — replaces single score + letter grade.
 * @param {object} metrics — current session metrics
 * @returns {number[]} — [task_velocity, token_efficiency, protocol_compliance, self_correction_rate, evolution_rate]
 */
export function efficiencyVector(metrics) {
  const taskVelocity = Math.min(1, (metrics.tasks?.throughput ?? 0) / 5);

  const tokenEfficiency = metrics.protocol?.token_savings_pct ?? 0;

  const protocolCompliance = metrics.protocol?.mil_compliance_rate ?? 0;

  const totalDecisions = (metrics.autonomy?.decisions_without_human ?? 0) +
    (metrics.autonomy?.user_interruptions ?? 0);
  const selfCorrectionRate = totalDecisions > 0
    ? (metrics.autonomy?.self_corrections ?? 0) / totalDecisions
    : 0;

  const findings = metrics.evolution?.findings?.length ?? 0;
  const experiments = metrics.evolution?.experiment_results ?? 0;
  const evolutionRate = Math.min(1, (findings + experiments) / 10);

  return [
    round2(taskVelocity),
    round2(tokenEfficiency),
    round2(protocolCompliance),
    round2(selfCorrectionRate),
    round2(evolutionRate),
  ];
}

/**
 * Identify weakest dimension and suggest focus for next session.
 * @param {number[]} vector
 * @returns {{ weakest: string, value: number, suggestion: string }}
 */
export function nextFocus(vector) {
  const labels = [
    "task_velocity",
    "token_efficiency",
    "protocol_compliance",
    "self_correction_rate",
    "evolution_rate",
  ];

  let minIdx = 0;
  for (let i = 1; i < vector.length; i++) {
    if (vector[i] < vector[minIdx]) minIdx = i;
  }

  const suggestions = {
    task_velocity: "increase throughput — try parallel workers or simpler task decomposition",
    token_efficiency: "reduce token waste — use v0.2b protocol, minimize prose in prompts",
    protocol_compliance: "improve MIL compliance — reinforce format constraint in all agent prompts",
    self_correction_rate: "catch errors earlier — add more pre-commit validation or tighter critic",
    evolution_rate: "run more experiments — spawn experimenter agent, test new hypotheses",
  };

  return {
    weakest: labels[minIdx],
    value: vector[minIdx],
    suggestion: suggestions[labels[minIdx]],
  };
}

// --- helpers ---
function avg(arr) { return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0; }
function round2(n) { return Math.round(n * 100) / 100; }
