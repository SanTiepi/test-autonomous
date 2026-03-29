// prompt_builder.mjs — Structured handoff prompts optimized for LLM execution.
// Design principle: short mandate + explicit constraints + concrete deliverables.
// ~100-150 lines max per prompt. Beyond 350 lines, quality drops.
// Codex receives structured project-state JSON + delta-only recent turns.
// Claude receives natural-text instructions compatible with envelope synthesis.

/**
 * Build a structured project-state object for Codex consumption.
 * Contains only machine-readable state — no prose.
 */
function buildProjectState(state) {
  const budget = state.budget ?? {};
  return {
    budget: {
      remaining_usd: +((budget.limit_usd ?? 0) - (budget.spent_usd ?? 0)).toFixed(2),
      limit_usd: budget.limit_usd ?? 0,
      spent_usd: budget.spent_usd ?? 0,
    },
    turns: {
      completed: state.counters?.completed_ai_turns ?? 0,
      remaining: (state.limits?.max_turns ?? 0) - (state.counters?.completed_ai_turns ?? 0),
      no_progress_streak: state.counters?.no_progress_streak ?? 0,
    },
    goal: {
      summary: state.goal?.summary ?? '',
      success_criteria: state.goal?.success_criteria ?? [],
      constraints: state.goal?.constraints ?? [],
    },
    codebase: state.codebase_summary ?? 'Node.js ES modules. Claude has full repo access.',
    lifecycle: state.lifecycle ?? 'unknown',
  };
}

/**
 * Build the handoff prompt for Codex (lead architect).
 * Format: structured project-state JSON + delta-only recent context.
 */
export function buildCodexPrompt({ current, state, recentTurns }) {
  const projectState = buildProjectState(state);
  const last2 = (recentTurns ?? []).slice(-2);

  const deltaBlock = last2.length
    ? last2.map(t => `  T${t.id}(${t.actor}): ${t.status} — ${t.summary}`).join('\n')
    : '  (none)';

  const lastInstruction = current.input?.instruction || 'BOOTSTRAP';

  return `Assume closed: ${state.rolling_summary?.text?.slice(0, 200) || '(nothing yet)'}

PROJECT_STATE:
${JSON.stringify(projectState, null, 2)}

This turn is: planning/reviewing turn ${current.turn_id} ($${projectState.budget.remaining_usd.toFixed(2)} left, ${projectState.turns.remaining} turns left)

This is NOT: writing code, running tests, or claiming completion without Claude confirming.

Delta (last ${last2.length} turn${last2.length !== 1 ? 's' : ''}):
${deltaBlock}
Last result: ${lastInstruction}

Must deliver:
- One concrete, atomic task for Claude (the builder)
- Testable acceptance_criteria
- Expected file paths

Hard rules:
- You NEVER write code. You assign tasks to Claude via next.target="claude".
- 1 turn = 1 atomic task. Not a plan, not a list.
- acceptance_criteria = the ONLY contract Claude must satisfy.
- Set next.target="stop" ONLY after Claude confirmed all SUCCESS criteria met with green tests.
- Do NOT claim completion without Claude having executed and reported.

You may inspect code using read-only tools (list_files, search_repo, read_file) when needed.

Return: JSON only.
{"status":"completed|blocked|error","summary":"str","artifacts":[],"made_progress":bool,"fingerprint_basis":"task+artifacts","next":{"target":"claude|stop|human","kind":"build|review|plan|stop","instruction":"one task","acceptance_criteria":["testable"],"artifacts_expected":["paths"]},"meta_feedback":{}}`;
}

/**
 * Build the handoff prompt for Claude Code (autonomous builder).
 * Format: mandate style — context, mission, deliverables, rules, validation.
 * Output: natural text (NOT JSON). The watcher/dispatcher synthesizes an envelope
 * from Claude's prose via keyword detection (file paths, progress markers, status words).
 */
export function buildClaudePrompt({ current, state, recentTurns }) {
  const budget = state.budget ?? {};
  const remaining = (budget.limit_usd ?? 0) - (budget.spent_usd ?? 0);
  const turnsLeft = (state.limits?.max_turns ?? 0) - (state.counters?.completed_ai_turns ?? 0);
  const last1 = (recentTurns ?? []).slice(-1);

  const lastBlock = last1.length
    ? `T${last1[0].id}(${last1[0].actor}): ${last1[0].status} — ${last1[0].summary}`
    : '(none)';

  const criteria = (current.input?.acceptance_criteria ?? []);
  const artifacts = (current.input?.artifacts_expected ?? []);
  const constraints = (state.goal?.constraints ?? []);

  return `Turn ${current.turn_id} starts now. $${remaining.toFixed(2)} left, ${turnsLeft} turns left.

Assume closed: ${state.rolling_summary?.text?.slice(0, 200) || '(start)'}
Previous: ${lastBlock}

This task is: ${current.input?.instruction ?? '(none)'}

This is NOT: expanding scope, adding unrequested features, touching files outside the task.

Must deliver:
${criteria.map(c => `- ${c}`).join('\n') || '- (complete the task)'}

Expected artifacts:
${artifacts.map(a => `- ${a}`).join('\n') || '- (as needed)'}

Hard rules:
- Execute exactly what the task says. Nothing more.
- Run tests after code changes.
- If blocked, say so. Do not guess.
${constraints.map(c => `- ${c}`).join('\n')}

Validation:
- All acceptance criteria met
- Tests pass
- No regressions

Output format: natural text only — do NOT return JSON. Write a brief summary of what you did and what files you changed. Mention file paths explicitly so the system can track artifacts. The system will parse your output automatically.`;
}

// Exported for testing
export { buildProjectState };
