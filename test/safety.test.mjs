import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// We mock protocol.mjs by registering a loader — but since safety.mjs
// imports protocol.mjs which may not exist, we need a different approach.
// We'll use a dynamic import trick: re-export safety functions with a mocked protocol.

// Since protocol.mjs may not exist yet, we create a minimal mock and
// use Node's --import or module mocking. For simplicity with node:test,
// we'll test by importing safety.mjs directly (protocol.mjs exists or we create a shim).

// Strategy: We import the functions and mock makeCheckpointDecision via
// the module. Since node:test has mock support, let's use that.

import { mock } from 'node:test';
import { createHash } from 'node:crypto';

// We need protocol.mjs to exist for the import. Let's create a shim if needed.
import { writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const protocolPath = resolve(__dirname, '..', 'src', 'protocol.mjs');

// Create a minimal protocol shim if it doesn't exist
if (!existsSync(protocolPath)) {
  writeFileSync(protocolPath, `
export function validateState(obj) { return { valid: true, errors: [] }; }
export function validateCurrent(obj) { return { valid: true, errors: [] }; }
export function validateAiEnvelope(obj) { return { valid: true, errors: [] }; }
export function makeCurrent(opts) { return opts; }
export function makeInitialState(opts) { return opts; }
export function makeCheckpointDecision(state) { return { needed: false, reason: null }; }
`, 'utf8');
}

const { evaluateGuards, computeFingerprint, recoverRuntimeState } = await import('../src/safety.mjs');

function makeState(overrides = {}) {
  return {
    stop: { requested: false },
    counters: { completed_ai_turns: 0, no_progress_streak: 0 },
    limits: { max_turns: 40, max_no_progress: 5 },
    budget: { spent_usd: 0, limit_usd: 5.0 },
    loop_guard: { repeat_count: 0 },
    lifecycle: 'idle',
    checkpoint: {},
    ...overrides,
  };
}

describe('evaluateGuards', () => {
  it('returns stop when stop.requested is true', () => {
    const state = makeState({ stop: { requested: true } });
    const result = evaluateGuards(state, {});
    assert.equal(result.action, 'stop');
    assert.equal(result.reason, 'stop requested');
  });

  it('returns stop when max turns reached', () => {
    const state = makeState({
      counters: { completed_ai_turns: 40, no_progress_streak: 0 },
      limits: { max_turns: 40, max_no_progress: 5 },
    });
    const result = evaluateGuards(state, {});
    assert.equal(result.action, 'stop');
    assert.equal(result.reason, 'max turns reached');
  });

  it('returns stop when budget exhausted', () => {
    const state = makeState({
      budget: { spent_usd: 5.0, limit_usd: 5.0 },
    });
    const result = evaluateGuards(state, {});
    assert.equal(result.action, 'stop');
    assert.equal(result.reason, 'budget exhausted');
  });

  it('returns stop when deadline has passed', () => {
    const state = makeState({
      limits: { max_turns: 40, max_no_progress: 5, deadline_at: '2020-01-01T00:00:00Z' },
    });
    const result = evaluateGuards(state, {});
    assert.equal(result.action, 'stop');
    assert.equal(result.reason, 'deadline passed');
  });

  it('returns stop on no progress streak', () => {
    const state = makeState({
      counters: { completed_ai_turns: 5, no_progress_streak: 5 },
      limits: { max_turns: 40, max_no_progress: 5 },
    });
    const result = evaluateGuards(state, {});
    assert.equal(result.action, 'stop');
    assert.equal(result.reason, 'no progress');
  });

  it('returns stop on loop detected', () => {
    const state = makeState({
      loop_guard: { repeat_count: 3 },
    });
    const result = evaluateGuards(state, {});
    assert.equal(result.action, 'stop');
    assert.equal(result.reason, 'loop detected');
  });

  it('returns continue when all guards pass', () => {
    const state = makeState();
    const result = evaluateGuards(state, {});
    assert.equal(result.action, 'continue');
    assert.equal(result.reason, null);
  });

  it('checks guards in priority order (stop.requested wins over budget)', () => {
    const state = makeState({
      stop: { requested: true },
      budget: { spent_usd: 10, limit_usd: 5 },
    });
    const result = evaluateGuards(state, {});
    assert.equal(result.reason, 'stop requested');
  });
});

describe('computeFingerprint', () => {
  it('produces a consistent SHA-256 hex hash', () => {
    const envelope = { fingerprint_basis: 'hello world' };
    const expected = createHash('sha256').update('hello world').digest('hex');
    assert.equal(computeFingerprint(envelope), expected);
  });

  it('produces the same hash for the same input', () => {
    const a = computeFingerprint({ fingerprint_basis: 'test' });
    const b = computeFingerprint({ fingerprint_basis: 'test' });
    assert.equal(a, b);
  });

  it('produces different hashes for different inputs', () => {
    const a = computeFingerprint({ fingerprint_basis: 'aaa' });
    const b = computeFingerprint({ fingerprint_basis: 'bbb' });
    assert.notEqual(a, b);
  });

  it('handles missing fingerprint_basis gracefully', () => {
    const result = computeFingerprint({});
    assert.equal(typeof result, 'string');
    assert.equal(result.length, 64); // SHA-256 hex length
  });
});

describe('recoverRuntimeState', () => {
  it('recovers stale running_codex state', () => {
    const state = makeState({ lifecycle: 'running_codex' });
    const result = recoverRuntimeState(state, false);
    assert.equal(result.recovered, true);
    assert.equal(result.state.lifecycle, 'wait_human');
    assert.equal(result.state.checkpoint.required, true);
    assert.ok(result.state.checkpoint.reason.includes('recovery'));
  });

  it('recovers stale running_claude state', () => {
    const state = makeState({ lifecycle: 'running_claude' });
    const result = recoverRuntimeState(state, false);
    assert.equal(result.recovered, true);
    assert.equal(result.state.lifecycle, 'wait_human');
  });

  it('does not recover if process is alive', () => {
    const state = makeState({ lifecycle: 'running_codex' });
    const result = recoverRuntimeState(state, true);
    assert.equal(result.recovered, false);
    assert.equal(result.state.lifecycle, 'running_codex');
  });

  it('does not recover if lifecycle is not running', () => {
    const state = makeState({ lifecycle: 'idle' });
    const result = recoverRuntimeState(state, false);
    assert.equal(result.recovered, false);
    assert.equal(result.reason, null);
  });
});
