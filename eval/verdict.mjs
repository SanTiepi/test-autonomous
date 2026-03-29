// eval/verdict.mjs — Compare conditions and classify outcome

const VERDICTS = ['differentiated', 'useful_but_not_unique', 'not_worth_it_yet'];

export function verdict(conditionScores) {
  const orch = conditionScores.orchestra;
  const baselines = [conditionScores.claude_direct, conditionScores.codex_direct].filter(Boolean);

  if (!orch || baselines.length === 0) return 'not_worth_it_yet';

  const bestSuccess = Math.max(...baselines.map(b => b.success_rate));
  const bestInterventions = Math.min(...baselines.map(b => b.human_interventions));
  const bestRegression = Math.min(...baselines.map(b => b.regression_rate));

  // Count dimensions where orchestra is clearly better
  let advantages = 0;
  if (orch.success_rate - bestSuccess > 0.15) advantages++;
  if (orch.human_interventions < bestInterventions) advantages++;
  if (orch.regression_rate < bestRegression) advantages++;
  if (orch.success_rate >= 0.8 && bestSuccess < 0.5) advantages++;

  // Differentiated: clearly better on 2+ dimensions
  if (advantages >= 2) return 'differentiated';

  // Useful but not unique: at least as good overall
  if (orch.success_rate >= bestSuccess && orch.regression_rate <= bestRegression + 0.05) {
    return 'useful_but_not_unique';
  }

  return 'not_worth_it_yet';
}

export { VERDICTS };
