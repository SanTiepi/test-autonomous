// watcher.test.mjs — Unit tests for the watcher state machine.
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { startWatcher } from '../src/watcher.mjs';
import { writeJsonAtomic, readJson } from '../src/storage.mjs';
import { makeInitialState, makeCurrent } from '../src/protocol.mjs';

// ── helpers ──

function makeTestConfig(tmpDir) {
  return Object.freeze({
    pollIntervalMs: 50,
    aiTimeoutMs: 2000,
    maxTurns: 40,
    maxNoProgress: 5,
    checkpointEvery: 6,
    budgetUsd: 5.0,
    claudeCmd: 'echo',
    codexModel: 'test',
    codexApiBase: 'http://127.0.0.1:0',
    codexApiKey: 'test',
    paths: {
      root: tmpDir,
      currentFile: join(tmpDir, 'current.json'),
      stateFile: join(tmpDir, 'state.json'),
      historyDir: join(tmpDir, 'history'),
      logsDir: join(tmpDir, 'logs'),
      approveFile: join(tmpDir, 'approve.json'),
      eventsLog: join(tmpDir, 'logs', 'events.ndjson'),
    },
  });
}

async function setup() {
  const tmpDir = await mkdtemp(join(tmpdir(), 'watcher-test-'));
  await mkdir(join(tmpDir, 'logs'), { recursive: true });
  await mkdir(join(tmpDir, 'history'), { recursive: true });
  const config = makeTestConfig(tmpDir);
  return { tmpDir, config };
}

async function teardown(tmpDir) {
  await rm(tmpDir, { recursive: true, force: true });
}

function makeStoppedState(config, overrides = {}) {
  const state = makeInitialState({
    session_id: 'test-session',
    goal: { summary: 'test goal', success_criteria: ['pass'], constraints: [] },
    config,
  });
  return { ...state, ...overrides };
}

// ── tests ──

describe('watcher', () => {
  let tmpDir, config;

  beforeEach(async () => {
    ({ tmpDir, config } = await setup());
  });

  afterEach(async () => {
    await teardown(tmpDir);
  });

  it('immediate stop: stop.requested=true → watcher returns stopped', async () => {
    const state = makeStoppedState(config, {
      lifecycle: 'booting',
      stop: { requested: true, reason: 'user requested', code: 'user' },
    });
    await writeJsonAtomic(config.paths.stateFile, state);

    // Need a current.json so the watcher doesn't hang in idle waiting for it
    const current = makeCurrent({
      session_id: 'test-session',
      turn_id: 1,
      target_actor: 'codex',
      kind: 'plan',
    });
    await writeJsonAtomic(config.paths.currentFile, current);

    const finalState = await startWatcher(config);

    assert.equal(finalState.lifecycle, 'stopped');
    assert.equal(finalState.stop.requested, true);
  });

  it('recovery from stale running_codex → transitions to wait_human', async () => {
    const state = makeStoppedState(config, {
      lifecycle: 'running_codex',
      active_run: {
        actor: 'codex',
        pid: 99999,
        turn_id: 1,
        started_at: new Date().toISOString(),
        timeout_at: null,
        prompt_hash: null,
      },
    });
    await writeJsonAtomic(config.paths.stateFile, state);

    // Write an approval to stop so the test doesn't hang in wait_human
    await writeJsonAtomic(config.paths.approveFile, {
      decision: 'stop',
      reason: 'test done',
    });

    const finalState = await startWatcher(config);

    assert.equal(finalState.lifecycle, 'stopped');
    assert.equal(finalState.stop.reason, 'test done');
  });

  it('approval flow: wait_human + approve stop → watcher stops', async () => {
    const state = makeStoppedState(config, {
      lifecycle: 'wait_human',
      checkpoint: {
        required: true,
        reason: 'checkpoint requested',
        requested_at: new Date().toISOString(),
        approved_at: null,
      },
    });
    await writeJsonAtomic(config.paths.stateFile, state);

    await writeJsonAtomic(config.paths.approveFile, {
      decision: 'stop',
      reason: 'human says stop',
    });

    const finalState = await startWatcher(config);

    assert.equal(finalState.lifecycle, 'stopped');
    assert.equal(finalState.stop.requested, true);
    assert.equal(finalState.stop.reason, 'human says stop');
    assert.equal(finalState.stop.code, 'human_stop');
  });

  it('guard: max turns reached → watcher stops', async () => {
    const state = makeStoppedState(config, {
      lifecycle: 'booting',
      counters: {
        next_turn_id: 41,
        completed_turns: 40,
        completed_ai_turns: 40,
        no_progress_streak: 0,
      },
    });
    await writeJsonAtomic(config.paths.stateFile, state);

    const current = makeCurrent({
      session_id: 'test-session',
      turn_id: 41,
      target_actor: 'codex',
      kind: 'plan',
    });
    await writeJsonAtomic(config.paths.currentFile, current);

    const finalState = await startWatcher(config);

    assert.equal(finalState.lifecycle, 'stopped');
    assert.equal(finalState.stop.requested, true);
    assert.equal(finalState.stop.reason, 'max turns reached');
  });

  it('guard: budget exhausted → watcher stops', async () => {
    const state = makeStoppedState(config, {
      lifecycle: 'booting',
      budget: { limit_usd: 5.0, spent_usd: 5.0 },
    });
    await writeJsonAtomic(config.paths.stateFile, state);

    const current = makeCurrent({
      session_id: 'test-session',
      turn_id: 1,
      target_actor: 'codex',
      kind: 'plan',
    });
    await writeJsonAtomic(config.paths.currentFile, current);

    const finalState = await startWatcher(config);

    assert.equal(finalState.lifecycle, 'stopped');
    assert.equal(finalState.stop.requested, true);
    assert.equal(finalState.stop.reason, 'budget exhausted');
  });

  it('guard: no progress streak → watcher stops', async () => {
    const state = makeStoppedState(config, {
      lifecycle: 'booting',
      counters: {
        next_turn_id: 6,
        completed_turns: 5,
        completed_ai_turns: 5,
        no_progress_streak: 5,
      },
    });
    await writeJsonAtomic(config.paths.stateFile, state);

    const current = makeCurrent({
      session_id: 'test-session',
      turn_id: 6,
      target_actor: 'codex',
      kind: 'plan',
    });
    await writeJsonAtomic(config.paths.currentFile, current);

    const finalState = await startWatcher(config);

    assert.equal(finalState.lifecycle, 'stopped');
    assert.equal(finalState.stop.requested, true);
    assert.equal(finalState.stop.reason, 'no progress');
  });

  it('onTick callback is called', async () => {
    const state = makeStoppedState(config, {
      lifecycle: 'booting',
      stop: { requested: true, reason: 'test', code: 'test' },
    });
    await writeJsonAtomic(config.paths.stateFile, state);

    const current = makeCurrent({
      session_id: 'test-session',
      turn_id: 1,
      target_actor: 'codex',
      kind: 'plan',
    });
    await writeJsonAtomic(config.paths.currentFile, current);

    const ticks = [];
    const finalState = await startWatcher(config, {
      onTick: (s) => ticks.push(s.lifecycle),
    });

    assert.equal(finalState.lifecycle, 'stopped');
    assert.ok(ticks.length >= 1, 'onTick should be called at least once');
  });

  it('throws if no state.json exists', async () => {
    await assert.rejects(
      () => startWatcher(config),
      { message: /No state\.json found/ },
    );
  });
});
