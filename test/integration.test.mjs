// integration.test.mjs — Full integration tests for the watcher with fake AIs.
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, mkdir, readdir } from 'node:fs/promises';
import { join, resolve, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

import { startWatcher } from '../src/watcher.mjs';
import { writeJsonAtomic, readJson, saveSessionState, setActiveSession, getActiveSessionId, loadSessionState } from '../src/storage.mjs';
import { makeInitialState, makeCurrent } from '../src/protocol.mjs';
import { startFakeCodex } from './helpers/fake-codex-server.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FAKE_CLI = resolve(__dirname, 'helpers', 'fake-claude-cli.mjs');

// ── helpers ──

function makeTestConfig(tmpDir, codexUrl) {
  return Object.freeze({
    pollIntervalMs: 50,
    aiTimeoutMs: 10_000,
    maxTurns: 40,
    maxNoProgress: 5,
    checkpointEvery: 100, // high to avoid checkpoint interrupts
    budgetUsd: 50.0,
    claudeCmd: 'node',
    claudeArgs: [FAKE_CLI],
    codexModel: 'test',
    codexApiBase: codexUrl,
    codexApiKey: 'test-key',
    spawnEnv: { FAKE_CLAUDE_MODE: 'success' },
    paths: {
      root: tmpDir,
      currentFile: join(tmpDir, 'current.json'),
      stateFile: join(tmpDir, 'state.json'),
      historyDir: join(tmpDir, 'history'),
      logsDir: join(tmpDir, 'logs'),
      approveFile: join(tmpDir, 'approve.json'),
      eventsLog: join(tmpDir, 'logs', 'events.ndjson'),
      activeSessionFile: join(tmpDir, 'active_session.json'),
    },
  });
}

async function setupTmpDir() {
  const tmpDir = await mkdtemp(join(tmpdir(), 'integration-test-'));
  await mkdir(join(tmpDir, 'logs'), { recursive: true });
  await mkdir(join(tmpDir, 'history'), { recursive: true });
  return tmpDir;
}

function makeTestState(config, overrides = {}) {
  const state = makeInitialState({
    session_id: 'int-test-session',
    goal: {
      summary: 'build auth module',
      success_criteria: ['tests pass'],
      constraints: ['no external deps'],
    },
    config,
  });
  return { ...state, ...overrides };
}

// ── tests ──

describe('integration: full watcher cycle with fake AIs', () => {
  let tmpDir, codexHandle;

  beforeEach(async () => {
    tmpDir = await setupTmpDir();
    codexHandle = await startFakeCodex(0);
  });

  afterEach(async () => {
    if (codexHandle) await codexHandle.close();
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('full 2-turn cycle: codex → claude → codex(done) → stopped', async () => {
    const config = makeTestConfig(tmpDir, codexHandle.url);

    // Start with default codex mode (success: target=claude)
    // After first codex request, switch to 'done' mode so second codex call stops
    let codexCalls = 0;
    const origSetMode = codexHandle.setMode.bind(codexHandle);

    // Use onTick to detect when we should switch codex to done mode
    // The flow: codex(success)->claude(success)->codex(??)
    // We need to switch to done after the first codex+claude cycle completes
    // Track via state transitions
    const tickStates = [];

    const state = makeTestState(config);
    await writeJsonAtomic(config.paths.stateFile, state);

    const current = makeCurrent({
      session_id: 'int-test-session',
      turn_id: 1,
      target_actor: 'codex',
      kind: 'plan',
      input: {
        from: 'orchestrator',
        instruction: 'plan the auth module',
        acceptance_criteria: ['architecture defined'],
        artifacts_expected: ['design.md'],
        context_refs: [],
      },
    });
    await writeJsonAtomic(config.paths.currentFile, current);

    // Switch codex mode to done after the first codex request
    // We'll poll the request count
    const checkInterval = setInterval(() => {
      if (codexHandle.getRequestCount() >= 1) {
        codexHandle.setMode('done');
        clearInterval(checkInterval);
      }
    }, 20);

    const finalState = await startWatcher(config, {
      onTick: (s) => tickStates.push(s.lifecycle),
    });

    clearInterval(checkInterval);

    assert.equal(finalState.lifecycle, 'stopped');
    assert.equal(finalState.stop.requested, true);
    assert.equal(finalState.stop.reason, 'goal achieved');
    assert.equal(finalState.stop.code, 'success');

    // Should have completed at least 2 AI turns (codex + claude, then codex done)
    assert.ok(finalState.counters.completed_ai_turns >= 2,
      `Expected >= 2 AI turns, got ${finalState.counters.completed_ai_turns}`);

    // Check history directory has archive files
    const sessionDir = join(tmpDir, 'history', 'int-test-session');
    const archives = await readdir(sessionDir);
    const turnFiles = archives.filter(f => f.startsWith('turn-'));
    assert.ok(turnFiles.length >= 2,
      `Expected >= 2 archived turns, got ${turnFiles.length}`);
  });

  it('codex returns stop immediately → system stops after 1 turn', async () => {
    codexHandle.setMode('stop_immediate');
    const config = makeTestConfig(tmpDir, codexHandle.url);

    const state = makeTestState(config);
    await writeJsonAtomic(config.paths.stateFile, state);

    const current = makeCurrent({
      session_id: 'int-test-session',
      turn_id: 1,
      target_actor: 'codex',
      kind: 'plan',
      input: {
        from: 'orchestrator',
        instruction: 'plan the feature',
        acceptance_criteria: [],
        artifacts_expected: [],
        context_refs: [],
      },
    });
    await writeJsonAtomic(config.paths.currentFile, current);

    const finalState = await startWatcher(config);

    assert.equal(finalState.lifecycle, 'stopped');
    assert.equal(finalState.stop.requested, true);
    assert.equal(finalState.stop.reason, 'goal achieved');
    assert.equal(finalState.counters.completed_ai_turns, 1);
  });

  it('Codex→Claude(natural text)→Codex round-trip with envelope synthesis', async () => {
    // Use natural_text mode: Claude returns prose, dispatcher synthesizes an envelope
    const baseConfig = makeTestConfig(tmpDir, codexHandle.url);
    const config = { ...baseConfig, spawnEnv: { FAKE_CLAUDE_MODE: 'natural_text' } };

    const state = makeTestState(config);
    await writeJsonAtomic(config.paths.stateFile, state);

    const current = makeCurrent({
      session_id: 'int-test-session',
      turn_id: 1,
      target_actor: 'codex',
      kind: 'plan',
      input: {
        from: 'orchestrator',
        instruction: 'plan the auth module',
        acceptance_criteria: ['architecture defined'],
        artifacts_expected: ['design.md'],
        context_refs: [],
      },
    });
    await writeJsonAtomic(config.paths.currentFile, current);

    // Switch codex to done after first request (after codex→claude cycle)
    const checkInterval = setInterval(() => {
      if (codexHandle.getRequestCount() >= 1) {
        codexHandle.setMode('done');
        clearInterval(checkInterval);
      }
    }, 20);

    const finalState = await startWatcher(config, {
      onTick: () => {},
    });

    clearInterval(checkInterval);

    assert.equal(finalState.lifecycle, 'stopped');
    assert.ok(finalState.counters.completed_ai_turns >= 2,
      `Expected >= 2 AI turns with natural text synthesis, got ${finalState.counters.completed_ai_turns}`);

    // Verify history was written (proves envelope synthesis succeeded)
    const sessionDir = join(tmpDir, 'history', 'int-test-session');
    const archives = await readdir(sessionDir);
    const turnFiles = archives.filter(f => f.startsWith('turn-'));
    assert.ok(turnFiles.length >= 2,
      `Expected >= 2 archived turns with synthesis, got ${turnFiles.length}`);
  });

  it('mid-loop stop: writing stop.requested=true to state.json stops the watcher', async () => {
    const config = makeTestConfig(tmpDir, codexHandle.url);

    const state = makeTestState(config);
    await writeJsonAtomic(config.paths.stateFile, state);

    const current = makeCurrent({
      session_id: 'int-test-session',
      turn_id: 1,
      target_actor: 'codex',
      kind: 'plan',
      input: {
        from: 'orchestrator',
        instruction: 'plan feature',
        acceptance_criteria: [],
        artifacts_expected: [],
        context_refs: [],
      },
    });
    await writeJsonAtomic(config.paths.currentFile, current);

    // After first AI turn completes, inject stop into state
    let injected = false;
    const finalState = await startWatcher(config, {
      onTick: async (s) => {
        if (s.counters.completed_ai_turns >= 1 && !injected) {
          injected = true;
          s.stop = { requested: true, reason: 'simulated SIGINT', code: 'user_stop' };
        }
      },
    });

    assert.equal(finalState.lifecycle, 'stopped');
    assert.ok(finalState.counters.completed_ai_turns >= 1,
      'Should have completed at least 1 AI turn before stopping');
  });

  it('session isolation: new session does not overwrite previous session state', async () => {
    const config = makeTestConfig(tmpDir, codexHandle.url);

    // Create first session state and save it
    const stateA = makeTestState(config, { session_id: 'sess_A' });
    stateA.lifecycle = 'stopped';
    stateA.stop = { requested: true, reason: 'done', code: 'success' };
    await saveSessionState(config, stateA);
    await setActiveSession(config, 'sess_A');

    // Create second session state and save it
    const stateB = makeTestState(config, { session_id: 'sess_B' });
    stateB.lifecycle = 'running';
    await saveSessionState(config, stateB);
    await setActiveSession(config, 'sess_B');

    // Active session should now be B
    const activeId = await getActiveSessionId(config);
    assert.equal(activeId, 'sess_B');

    // Session A state should still be intact
    const loadedA = await loadSessionState(config, 'sess_A');
    assert.equal(loadedA.session_id, 'sess_A');
    assert.equal(loadedA.lifecycle, 'stopped');

    // Session B state should be loadable
    const loadedB = await loadSessionState(config, 'sess_B');
    assert.equal(loadedB.session_id, 'sess_B');
    assert.equal(loadedB.lifecycle, 'running');
  });
});
