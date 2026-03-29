import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildCodexPrompt, buildClaudePrompt, buildProjectState } from '../src/prompt_builder.mjs';

function makeState(overrides = {}) {
  return {
    session_id: 'sess-001',
    budget: { spent_usd: 1.5, limit_usd: 5.0 },
    limits: { max_turns: 40, max_no_progress: 5 },
    counters: { completed_ai_turns: 10, no_progress_streak: 0 },
    goal: {
      summary: 'Build an API',
      success_criteria: ['All tests pass', 'Docs written'],
      constraints: ['No external deps', 'ES modules only'],
    },
    rolling_summary: { text: 'Progress so far: API scaffold done.' },
    ...overrides,
  };
}

function makeCurrent(overrides = {}) {
  return {
    turn_id: 11,
    input: {
      instruction: 'Implement the auth module',
      acceptance_criteria: ['JWT tokens work', 'Tests pass'],
      artifacts_expected: ['src/auth.mjs', 'test/auth.test.mjs'],
      from: 'claude',
    },
    ...overrides,
  };
}

function makeRecentTurns(count) {
  return Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    actor: i % 2 === 0 ? 'codex' : 'claude',
    status: 'completed',
    summary: `Did thing ${i + 1}`,
  }));
}

// ── buildProjectState tests ──

describe('buildProjectState', () => {
  it('computes budget remaining correctly', () => {
    const ps = buildProjectState(makeState());
    assert.equal(ps.budget.remaining_usd, 3.5);
    assert.equal(ps.budget.limit_usd, 5.0);
    assert.equal(ps.budget.spent_usd, 1.5);
  });

  it('computes turn counts correctly', () => {
    const ps = buildProjectState(makeState());
    assert.equal(ps.turns.completed, 10);
    assert.equal(ps.turns.remaining, 30);
    assert.equal(ps.turns.no_progress_streak, 0);
  });

  it('includes goal fields', () => {
    const ps = buildProjectState(makeState());
    assert.equal(ps.goal.summary, 'Build an API');
    assert.deepEqual(ps.goal.success_criteria, ['All tests pass', 'Docs written']);
    assert.deepEqual(ps.goal.constraints, ['No external deps', 'ES modules only']);
  });

  it('handles missing state fields with defaults', () => {
    const ps = buildProjectState({});
    assert.equal(ps.budget.remaining_usd, 0);
    assert.equal(ps.turns.completed, 0);
    assert.equal(ps.turns.remaining, 0);
    assert.equal(ps.goal.summary, '');
  });
});

// ── buildCodexPrompt tests ──

describe('buildCodexPrompt', () => {
  it('contains a parseable PROJECT_STATE JSON block', () => {
    const prompt = buildCodexPrompt({ current: makeCurrent(), state: makeState(), recentTurns: [] });
    const match = prompt.match(/PROJECT_STATE:\n([\s\S]*?)\n\nThis turn is/);
    assert.ok(match, 'PROJECT_STATE block should exist');
    const parsed = JSON.parse(match[1]);
    assert.equal(parsed.budget.remaining_usd, 3.5);
    assert.equal(parsed.turns.remaining, 30);
    assert.equal(parsed.goal.summary, 'Build an API');
  });

  it('includes last 2 recent turns as delta', () => {
    const prompt = buildCodexPrompt({ current: makeCurrent(), state: makeState(), recentTurns: makeRecentTurns(5) });
    assert.ok(prompt.includes('T4('), 'should include turn 4');
    assert.ok(prompt.includes('T5('), 'should include turn 5');
    assert.ok(!prompt.includes('T3('), 'should NOT include turn 3');
  });

  it('labels recent turns section as Delta', () => {
    const prompt = buildCodexPrompt({ current: makeCurrent(), state: makeState(), recentTurns: makeRecentTurns(3) });
    assert.ok(prompt.includes('Delta (last 2 turn'), 'should label section as Delta');
  });

  it('computes budget correctly from PROJECT_STATE', () => {
    const prompt = buildCodexPrompt({ current: makeCurrent(), state: makeState(), recentTurns: [] });
    assert.ok(prompt.includes('$3.50'), `budget missing in: ${prompt.slice(0, 500)}`);
  });

  it('computes turns left', () => {
    const prompt = buildCodexPrompt({ current: makeCurrent(), state: makeState(), recentTurns: [] });
    assert.ok(prompt.includes('30 turns left'));
  });

  it('includes goal and success criteria in PROJECT_STATE', () => {
    const prompt = buildCodexPrompt({ current: makeCurrent(), state: makeState(), recentTurns: [] });
    assert.ok(prompt.includes('Build an API'));
    assert.ok(prompt.includes('All tests pass'));
  });

  it('includes constraints in PROJECT_STATE', () => {
    const prompt = buildCodexPrompt({ current: makeCurrent(), state: makeState(), recentTurns: [] });
    assert.ok(prompt.includes('No external deps'));
  });

  it('includes rolling summary', () => {
    const prompt = buildCodexPrompt({ current: makeCurrent(), state: makeState(), recentTurns: [] });
    assert.ok(prompt.includes('API scaffold done'));
  });

  it('enforces role: plan and delegate', () => {
    const prompt = buildCodexPrompt({ current: makeCurrent(), state: makeState(), recentTurns: [] });
    assert.ok(prompt.includes('NEVER write code'));
    assert.ok(prompt.includes('assign tasks to Claude'));
  });

  it('mentions read-only tools', () => {
    const prompt = buildCodexPrompt({ current: makeCurrent(), state: makeState(), recentTurns: [] });
    assert.ok(prompt.includes('list_files') || prompt.includes('read_file') || prompt.includes('search_repo'));
  });

  it('requires JSON return format', () => {
    const prompt = buildCodexPrompt({ current: makeCurrent(), state: makeState(), recentTurns: [] });
    assert.ok(prompt.includes('JSON only'));
  });

  it('uses mandate structure: assume closed, this turn is, must deliver', () => {
    const prompt = buildCodexPrompt({ current: makeCurrent(), state: makeState(), recentTurns: [] });
    assert.ok(prompt.includes('Assume closed'));
    assert.ok(prompt.includes('This turn is'));
    assert.ok(prompt.includes('Must deliver'));
    assert.ok(prompt.includes('Hard rules'));
  });

  it('PROJECT_STATE includes lifecycle', () => {
    const state = makeState({ lifecycle: 'idle' });
    const prompt = buildCodexPrompt({ current: makeCurrent(), state, recentTurns: [] });
    const match = prompt.match(/PROJECT_STATE:\n([\s\S]*?)\n\nThis turn is/);
    const parsed = JSON.parse(match[1]);
    assert.equal(parsed.lifecycle, 'idle');
  });
});

// ── buildClaudePrompt tests ──

describe('buildClaudePrompt', () => {
  it('includes last 1 recent turn', () => {
    const prompt = buildClaudePrompt({ current: makeCurrent(), state: makeState(), recentTurns: makeRecentTurns(5) });
    assert.ok(prompt.includes('T5('), 'should include turn 5');
    assert.ok(!prompt.includes('T4('), 'should NOT include turn 4');
  });

  it('computes budget', () => {
    const prompt = buildClaudePrompt({ current: makeCurrent(), state: makeState(), recentTurns: [] });
    assert.ok(prompt.includes('$3.50'));
  });

  it('includes task instruction', () => {
    const prompt = buildClaudePrompt({ current: makeCurrent(), state: makeState(), recentTurns: [] });
    assert.ok(prompt.includes('Implement the auth module'));
  });

  it('includes acceptance criteria as deliverables', () => {
    const prompt = buildClaudePrompt({ current: makeCurrent(), state: makeState(), recentTurns: [] });
    assert.ok(prompt.includes('JWT tokens work'));
    assert.ok(prompt.includes('Tests pass'));
  });

  it('includes expected artifacts', () => {
    const prompt = buildClaudePrompt({ current: makeCurrent(), state: makeState(), recentTurns: [] });
    assert.ok(prompt.includes('src/auth.mjs'));
  });

  it('explicitly requests natural text, NOT JSON', () => {
    const prompt = buildClaudePrompt({ current: makeCurrent(), state: makeState(), recentTurns: [] });
    assert.ok(!prompt.includes('JSON only'), 'Claude should not be asked for JSON');
    assert.ok(prompt.includes('natural text only'), 'should explicitly request natural text');
    assert.ok(prompt.includes('do NOT return JSON'), 'should explicitly forbid JSON');
  });

  it('asks Claude to mention file paths for artifact tracking', () => {
    const prompt = buildClaudePrompt({ current: makeCurrent(), state: makeState(), recentTurns: [] });
    assert.ok(prompt.includes('Mention file paths explicitly'), 'should tell Claude to mention file paths');
  });

  it('uses mandate structure', () => {
    const prompt = buildClaudePrompt({ current: makeCurrent(), state: makeState(), recentTurns: [] });
    assert.ok(prompt.includes('Assume closed'));
    assert.ok(prompt.includes('This task is'));
    assert.ok(prompt.includes('Must deliver'));
    assert.ok(prompt.includes('Hard rules'));
  });

  it('includes constraints', () => {
    const prompt = buildClaudePrompt({ current: makeCurrent(), state: makeState(), recentTurns: [] });
    assert.ok(prompt.includes('No external deps'));
  });

  it('output is compatible with envelope synthesis (contains summary + file paths)', () => {
    // Verify the prompt instructs Claude to produce text the synthesizer can parse
    const prompt = buildClaudePrompt({ current: makeCurrent(), state: makeState(), recentTurns: [] });
    assert.ok(prompt.includes('summary of what you did'), 'should ask for summary');
    assert.ok(prompt.includes('what files you changed'), 'should ask for file list');
    assert.ok(prompt.includes('system will parse your output'), 'should note auto-parsing');
  });

  it('shows (none) when no recent turns provided', () => {
    const prompt = buildClaudePrompt({ current: makeCurrent(), state: makeState(), recentTurns: [] });
    assert.ok(prompt.includes('Previous: (none)'), 'should show (none) for empty recent turns');
  });
});

// ── Codex→Claude round-trip format tests ──

describe('round-trip: Codex prompt → Claude prompt format compatibility', () => {
  it('Codex prompt contains structured PROJECT_STATE that Claude prompt does not', () => {
    const state = makeState();
    const codexPrompt = buildCodexPrompt({ current: makeCurrent(), state, recentTurns: [] });
    const claudePrompt = buildClaudePrompt({ current: makeCurrent(), state, recentTurns: [] });

    // Codex gets machine-readable PROJECT_STATE
    assert.ok(codexPrompt.includes('PROJECT_STATE:'), 'Codex should receive PROJECT_STATE');
    const match = codexPrompt.match(/PROJECT_STATE:\n([\s\S]*?)\n\nThis turn is/);
    assert.ok(match, 'PROJECT_STATE should be parseable JSON block');
    const ps = JSON.parse(match[1]);
    assert.equal(typeof ps.budget, 'object');
    assert.equal(typeof ps.turns, 'object');
    assert.equal(typeof ps.goal, 'object');

    // Claude does NOT get PROJECT_STATE — gets human-readable mandate instead
    assert.ok(!claudePrompt.includes('PROJECT_STATE:'), 'Claude should not receive PROJECT_STATE');
  });

  it('Codex envelope fields feed correctly into Claude prompt construction', () => {
    // Simulate Codex response envelope
    const codexEnvelope = {
      status: 'completed',
      summary: 'planned auth module architecture',
      artifacts: [],
      made_progress: true,
      fingerprint_basis: 'auth planning',
      next: {
        target: 'claude',
        kind: 'build',
        instruction: 'Implement JWT auth in src/auth.mjs with login/verify endpoints',
        acceptance_criteria: ['JWT tokens issued on login', 'verify rejects expired tokens', 'Tests in test/auth.test.mjs pass'],
        artifacts_expected: ['src/auth.mjs', 'test/auth.test.mjs'],
      },
    };

    // Build Claude prompt using Codex envelope data (as the watcher would)
    const claudeCurrent = makeCurrent({
      turn_id: 12,
      input: {
        from: 'codex',
        instruction: codexEnvelope.next.instruction,
        acceptance_criteria: codexEnvelope.next.acceptance_criteria,
        artifacts_expected: codexEnvelope.next.artifacts_expected,
      },
    });
    const recentTurns = [{ id: 11, actor: 'codex', status: 'completed', summary: codexEnvelope.summary }];
    const claudePrompt = buildClaudePrompt({ current: claudeCurrent, state: makeState(), recentTurns });

    // Verify Codex envelope data flows into Claude prompt
    assert.ok(claudePrompt.includes('Implement JWT auth'), 'instruction from Codex should appear');
    assert.ok(claudePrompt.includes('JWT tokens issued on login'), 'acceptance criteria from Codex should appear');
    assert.ok(claudePrompt.includes('src/auth.mjs'), 'expected artifacts from Codex should appear');
    assert.ok(claudePrompt.includes('T11(codex): completed'), 'previous Codex turn should appear as context');
    assert.ok(claudePrompt.includes('natural text only'), 'should still request natural text output');
  });

  it('Codex prompt delta shows (none) with empty recent turns', () => {
    const prompt = buildCodexPrompt({ current: makeCurrent(), state: makeState(), recentTurns: [] });
    assert.ok(prompt.includes('Delta (last 0 turns):'), 'should show 0 turns');
    assert.ok(prompt.includes('(none)'), 'should show (none) placeholder');
  });

  it('both prompts use the same budget/turns data from state', () => {
    const state = makeState();
    const codexPrompt = buildCodexPrompt({ current: makeCurrent(), state, recentTurns: [] });
    const claudePrompt = buildClaudePrompt({ current: makeCurrent(), state, recentTurns: [] });

    // Both should show $3.50 remaining and 30 turns left
    assert.ok(codexPrompt.includes('$3.50'), 'Codex should show budget');
    assert.ok(claudePrompt.includes('$3.50'), 'Claude should show budget');
    assert.ok(codexPrompt.includes('30 turns left'), 'Codex should show turns');
    assert.ok(claudePrompt.includes('30 turns left'), 'Claude should show turns');
  });
});
