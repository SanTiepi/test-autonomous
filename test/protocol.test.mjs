import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateCurrent,
  validateState,
  validateAiEnvelope,
  makeCurrent,
  makeInitialState,
  makeCheckpointDecision,
} from '../src/protocol.mjs';

// ── validateCurrent ──

describe('validateCurrent', () => {
  it('accepts a minimal valid current', () => {
    const obj = {
      schema_version: 1,
      session_id: 'sess-1',
      turn_id: 1,
      target_actor: 'codex',
      kind: 'build',
    };
    const r = validateCurrent(obj);
    assert.equal(r.valid, true);
    assert.equal(r.errors.length, 0);
  });

  it('rejects non-object', () => {
    const r = validateCurrent(null);
    assert.equal(r.valid, false);
    assert.ok(r.errors[0].includes('object'));
  });

  it('rejects missing session_id', () => {
    const r = validateCurrent({ schema_version: 1, turn_id: 1, target_actor: 'codex', kind: 'build' });
    assert.equal(r.valid, false);
    assert.ok(r.errors.some(e => e.includes('session_id')));
  });

  it('rejects invalid target_actor', () => {
    const r = validateCurrent({ schema_version: 1, session_id: 's', turn_id: 1, target_actor: 'gpt', kind: 'build' });
    assert.equal(r.valid, false);
    assert.ok(r.errors.some(e => e.includes('target_actor')));
  });

  it('rejects invalid kind', () => {
    const r = validateCurrent({ schema_version: 1, session_id: 's', turn_id: 1, target_actor: 'codex', kind: 'deploy' });
    assert.equal(r.valid, false);
    assert.ok(r.errors.some(e => e.includes('kind')));
  });

  it('validates input sub-object', () => {
    const obj = {
      schema_version: 1, session_id: 's', turn_id: 1, target_actor: 'codex', kind: 'build',
      input: { from: 'orchestrator', instruction: 'do stuff', acceptance_criteria: ['pass'], artifacts_expected: [], context_refs: [] },
    };
    assert.equal(validateCurrent(obj).valid, true);
  });

  it('rejects bad input.from type', () => {
    const obj = {
      schema_version: 1, session_id: 's', turn_id: 1, target_actor: 'codex', kind: 'build',
      input: { from: 123, instruction: 'x' },
    };
    const r = validateCurrent(obj);
    assert.equal(r.valid, false);
    assert.ok(r.errors.some(e => e.includes('input.from')));
  });

  it('validates limits sub-object', () => {
    const obj = {
      schema_version: 1, session_id: 's', turn_id: 1, target_actor: 'claude', kind: 'review',
      limits: { timeout_ms: 5000, budget_remaining_usd: 2.5, remaining_turns: 10 },
    };
    assert.equal(validateCurrent(obj).valid, true);
  });

  it('validates timestamps', () => {
    const obj = {
      schema_version: 1, session_id: 's', turn_id: 1, target_actor: 'claude', kind: 'plan',
      timestamps: { created_at: new Date().toISOString() },
    };
    assert.equal(validateCurrent(obj).valid, true);
  });
});

// ── validateState ──

describe('validateState', () => {
  it('accepts a minimal valid state', () => {
    const r = validateState({ schema_version: 1, session_id: 'sess-1', lifecycle: 'idle' });
    assert.equal(r.valid, true);
  });

  it('rejects invalid lifecycle', () => {
    const r = validateState({ schema_version: 1, session_id: 's', lifecycle: 'crashed' });
    assert.equal(r.valid, false);
    assert.ok(r.errors.some(e => e.includes('lifecycle')));
  });

  it('validates goal sub-object', () => {
    const r = validateState({
      schema_version: 1, session_id: 's', lifecycle: 'running_codex',
      goal: { summary: 'build feature', success_criteria: ['tests pass'], constraints: [] },
    });
    assert.equal(r.valid, true);
  });

  it('rejects bad budget', () => {
    const r = validateState({
      schema_version: 1, session_id: 's', lifecycle: 'idle',
      budget: { limit_usd: 'five', spent_usd: 0 },
    });
    assert.equal(r.valid, false);
    assert.ok(r.errors.some(e => e.includes('budget.limit_usd')));
  });

  it('validates counters', () => {
    const r = validateState({
      schema_version: 1, session_id: 's', lifecycle: 'idle',
      counters: { next_turn_id: 1, completed_turns: 0, completed_ai_turns: 0, no_progress_streak: 0 },
    });
    assert.equal(r.valid, true);
  });

  it('validates timestamps', () => {
    const r = validateState({
      schema_version: 1, session_id: 's', lifecycle: 'idle',
      timestamps: { created_at: 'now', updated_at: 'now' },
    });
    assert.equal(r.valid, true);
  });
});

// ── validateAiEnvelope ──

describe('validateAiEnvelope', () => {
  const minimal = {
    status: 'completed',
    summary: 'did stuff',
    artifacts: ['file.js'],
    made_progress: true,
    fingerprint_basis: 'abc123',
  };

  it('accepts a minimal valid envelope', () => {
    assert.equal(validateAiEnvelope(minimal).valid, true);
  });

  it('rejects missing summary', () => {
    const r = validateAiEnvelope({ ...minimal, summary: undefined });
    assert.equal(r.valid, false);
    assert.ok(r.errors.some(e => e.includes('summary')));
  });

  it('rejects invalid status', () => {
    const r = validateAiEnvelope({ ...minimal, status: 'pending' });
    assert.equal(r.valid, false);
  });

  it('rejects non-boolean made_progress', () => {
    const r = validateAiEnvelope({ ...minimal, made_progress: 'yes' });
    assert.equal(r.valid, false);
  });

  it('validates next sub-object', () => {
    const r = validateAiEnvelope({
      ...minimal,
      next: { target: 'claude', kind: 'review', instruction: 'check it' },
    });
    assert.equal(r.valid, true);
  });

  it('rejects bad next.target', () => {
    const r = validateAiEnvelope({
      ...minimal,
      next: { target: 'llama', kind: 'review', instruction: 'check' },
    });
    assert.equal(r.valid, false);
  });

  it('validates meta_feedback', () => {
    const r = validateAiEnvelope({
      ...minimal,
      meta_feedback: { prompt_quality: 4, redundant_fields: [], missing_context: [], optimization_notes: '' },
    });
    assert.equal(r.valid, true);
  });

  it('rejects prompt_quality out of range', () => {
    const r = validateAiEnvelope({
      ...minimal,
      meta_feedback: { prompt_quality: 6 },
    });
    assert.equal(r.valid, false);
  });
});

// ── makeCurrent ──

describe('makeCurrent', () => {
  it('creates a valid current object', () => {
    const c = makeCurrent({ session_id: 's1', turn_id: 1, target_actor: 'codex', kind: 'build' });
    const r = validateCurrent(c);
    assert.equal(r.valid, true, `Errors: ${r.errors.join(', ')}`);
    assert.equal(c.schema_version, 1);
    assert.equal(c.session_id, 's1');
    assert.ok(c.timestamps.created_at);
    assert.equal(c.timestamps.dispatched_at, null);
  });

  it('uses provided input', () => {
    const input = { from: 'user', instruction: 'go', acceptance_criteria: ['done'], artifacts_expected: [], context_refs: [] };
    const c = makeCurrent({ session_id: 's', turn_id: 2, target_actor: 'claude', kind: 'plan', input });
    assert.equal(c.input.from, 'user');
  });
});

// ── makeInitialState ──

describe('makeInitialState', () => {
  it('creates a valid state with zeroed counters', () => {
    const config = {
      budgetUsd: 3.0,
      maxTurns: 20,
      maxNoProgress: 5,
      checkpointEvery: 6,
      aiTimeoutMs: 300000,
      paths: {
        currentFile: '/tmp/c.json',
        stateFile: '/tmp/s.json',
        historyDir: '/tmp/h',
        logsDir: '/tmp/l',
        approveFile: '/tmp/a.json',
      },
    };
    const s = makeInitialState({ session_id: 'test-1', goal: { summary: 'build it', success_criteria: ['pass'], constraints: [] }, config });
    const r = validateState(s);
    assert.equal(r.valid, true, `Errors: ${r.errors.join(', ')}`);
    assert.equal(s.lifecycle, 'booting');
    assert.equal(s.counters.next_turn_id, 1);
    assert.equal(s.counters.completed_turns, 0);
    assert.equal(s.budget.limit_usd, 3.0);
    assert.equal(s.budget.spent_usd, 0);
  });
});

// ── makeCheckpointDecision ──

describe('makeCheckpointDecision', () => {
  it('returns needed when at checkpoint boundary', () => {
    const state = { counters: { completed_ai_turns: 6 }, limits: { checkpoint_every: 6 } };
    const d = makeCheckpointDecision(state);
    assert.equal(d.needed, true);
    assert.ok(d.reason.includes('6'));
  });

  it('returns not needed between checkpoints', () => {
    const state = { counters: { completed_ai_turns: 4 }, limits: { checkpoint_every: 6 } };
    const d = makeCheckpointDecision(state);
    assert.equal(d.needed, false);
    assert.equal(d.reason, null);
  });

  it('returns not needed for zero turns', () => {
    const state = { counters: { completed_ai_turns: 0 }, limits: { checkpoint_every: 6 } };
    const d = makeCheckpointDecision(state);
    assert.equal(d.needed, false);
  });

  it('handles null state gracefully', () => {
    const d = makeCheckpointDecision(null);
    assert.equal(d.needed, false);
  });
});
