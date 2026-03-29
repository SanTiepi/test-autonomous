import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { archiveTurn, loadRecentTurns, rebuildRollingSummary } from '../src/history.mjs';

let sandbox;

function sandboxConfig() {
  return {
    paths: {
      historyDir: join(sandbox, '.orchestra', 'history'),
    },
  };
}

async function makeSandbox() {
  sandbox = await mkdtemp(join(tmpdir(), 'history-test-'));
}

async function cleanSandbox() {
  if (sandbox) await rm(sandbox, { recursive: true, force: true });
}

// ── archiveTurn ──

describe('archiveTurn', () => {
  beforeEach(makeSandbox);
  afterEach(cleanSandbox);

  it('writes a turn archive file', async () => {
    const config = sandboxConfig();
    const path = await archiveTurn('sess-1', 1, 'codex', 'completed', { summary: 'built module' }, config);
    assert.ok(path.includes('turn-0001.codex.completed.json'));
  });

  it('stores correct data in the archive', async () => {
    const config = sandboxConfig();
    await archiveTurn('sess-1', 3, 'claude', 'error', { summary: 'failed' }, config);
    const turns = await loadRecentTurns('sess-1', 10, config);
    assert.equal(turns.length, 1);
    assert.equal(turns[0].turn_id, 3);
    assert.equal(turns[0].actor, 'claude');
    assert.equal(turns[0].status, 'error');
    assert.equal(turns[0].data.summary, 'failed');
  });
});

// ── loadRecentTurns ──

describe('loadRecentTurns', () => {
  beforeEach(makeSandbox);
  afterEach(cleanSandbox);

  it('returns empty array for missing session', async () => {
    const config = sandboxConfig();
    const turns = await loadRecentTurns('nonexistent', 5, config);
    assert.deepEqual(turns, []);
  });

  it('returns last n turns sorted by turn_id', async () => {
    const config = sandboxConfig();
    for (let i = 1; i <= 5; i++) {
      await archiveTurn('sess-2', i, 'codex', 'completed', { summary: `turn ${i}` }, config);
    }
    const turns = await loadRecentTurns('sess-2', 3, config);
    assert.equal(turns.length, 3);
    assert.equal(turns[0].turn_id, 3);
    assert.equal(turns[1].turn_id, 4);
    assert.equal(turns[2].turn_id, 5);
  });

  it('returns all if fewer than n', async () => {
    const config = sandboxConfig();
    await archiveTurn('sess-3', 1, 'claude', 'completed', { summary: 'only one' }, config);
    const turns = await loadRecentTurns('sess-3', 10, config);
    assert.equal(turns.length, 1);
  });
});

// ── rebuildRollingSummary ──

describe('rebuildRollingSummary', () => {
  beforeEach(makeSandbox);
  afterEach(cleanSandbox);

  it('returns empty string for missing session', async () => {
    const config = sandboxConfig();
    const summary = await rebuildRollingSummary('ghost', config);
    assert.equal(summary, '');
  });

  it('builds summary from archived turns', async () => {
    const config = sandboxConfig();
    await archiveTurn('sess-4', 1, 'codex', 'completed', { summary: 'initialized project' }, config);
    await archiveTurn('sess-4', 2, 'claude', 'completed', { summary: 'reviewed code' }, config);
    const summary = await rebuildRollingSummary('sess-4', config);
    assert.ok(summary.includes('T1[codex/completed]'));
    assert.ok(summary.includes('T2[claude/completed]'));
    assert.ok(summary.includes('initialized project'));
  });

  it('truncates to 500 chars', async () => {
    const config = sandboxConfig();
    // Create many turns with long summaries
    for (let i = 1; i <= 20; i++) {
      await archiveTurn('sess-5', i, 'codex', 'completed', { summary: 'A'.repeat(50) + ` turn ${i}` }, config);
    }
    const summary = await rebuildRollingSummary('sess-5', config);
    assert.ok(summary.length <= 500);
  });
});
