// eval/scorer.mjs — Compute evaluation metrics from runner results

export function score(results) {
  if (!Array.isArray(results) || results.length === 0) {
    return { success_rate: 0, time_to_green: 0, human_interventions: 0, regression_rate: 0 };
  }

  const total = results.length;

  // success_rate: fraction of tickets that passed
  const successes = results.filter(r => r.success).length;
  const success_rate = successes / total;

  // time_to_green: average ms for successful runs (0 if none)
  const successTimes = results.filter(r => r.success).map(r => r.time_ms);
  const time_to_green = successTimes.length > 0
    ? Math.round(successTimes.reduce((a, b) => a + b, 0) / successTimes.length)
    : 0;

  // human_interventions: total across all runs
  const human_interventions = results.reduce((sum, r) => sum + (r.human_interventions || 0), 0);

  // regression_rate: fraction of runs with regressions
  const withRegressions = results.filter(r => r.regressions && r.regressions.length > 0).length;
  const regression_rate = withRegressions / total;

  return { success_rate, time_to_green, human_interventions, regression_rate };
}

export function scoreByCondition(results) {
  const grouped = {};
  for (const r of results) {
    if (!grouped[r.condition]) grouped[r.condition] = [];
    grouped[r.condition].push(r);
  }
  const scores = {};
  for (const [condition, group] of Object.entries(grouped)) {
    scores[condition] = score(group);
  }
  return scores;
}
