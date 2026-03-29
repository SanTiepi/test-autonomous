import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { readJson, writeJsonAtomic, removeIfExists, ensureRuntimeLayout, sessionStatePath, setActiveSession, getActiveSessionId, loadSessionState, saveSessionState } from '../src/storage.mjs';

let sandbox;

async function makeSandbox() {
  sandbox = await mkdtemp(join(tmpdir(), 'storage-test-'));
  return sandbox;
}

async function cleanSandbox() {
  if (sandbox) await rm(sandbox, { recursive: true, force: true });
}

// ── readJson ──

describe('readJson', () => {
  beforeEach(makeSandbox);
  afterEach(cleanSandbox);

  it('reads and parses a valid JSON file', async () => {
    const p = join(sandbox, 'test.json');
    await writeFile(p, '{"a":1}', 'utf8');
    const result = await readJson(p);
    assert.deepEqual(result, { a: 1 });
  });

  it('returns null for missing file', async () => {
    const result = await readJson(join(sandbox, 'nope.json'));
    assert.equal(result, null);
  });

  it('throws on invalid JSON', async () => {
    const p = join(sandbox, 'bad.json');
    await writeFile(p, '{broken', 'utf8');
    await assert.rejects(() => readJson(p), { name: 'SyntaxError' });
  });
});

// ── writeJsonAtomic ──

describe('writeJsonAtomic', () => {
  beforeEach(makeSandbox);
  afterEach(cleanSandbox);

  it('writes valid JSON atomically', async () => {
    const p = join(sandbox, 'out.json');
    await writeJsonAtomic(p, { hello: 'world' });
    const raw = await readFile(p, 'utf8');
    assert.deepEqual(JSON.parse(raw), { hello: 'world' });
  });

  it('does not leave .tmp file on success', async () => {
    const p = join(sandbox, 'clean.json');
    await writeJsonAtomic(p, { x: 1 });
    await assert.rejects(
      () => readFile(p + '.tmp', 'utf8'),
      { code: 'ENOENT' }
    );
  });

  it('overwrites existing file', async () => {
    const p = join(sandbox, 'over.json');
    await writeJsonAtomic(p, { v: 1 });
    await writeJsonAtomic(p, { v: 2 });
    const data = await readJson(p);
    assert.equal(data.v, 2);
  });

  it('creates parent directories if needed', async () => {
    const p = join(sandbox, 'deep', 'nested', 'file.json');
    await writeJsonAtomic(p, { nested: true });
    const data = await readJson(p);
    assert.equal(data.nested, true);
  });
});

// ── removeIfExists ──

describe('removeIfExists', () => {
  beforeEach(makeSandbox);
  afterEach(cleanSandbox);

  it('removes an existing file', async () => {
    const p = join(sandbox, 'del.json');
    await writeFile(p, 'x', 'utf8');
    await removeIfExists(p);
    const result = await readJson(p);
    assert.equal(result, null);
  });

  it('does not throw for missing file', async () => {
    await assert.doesNotReject(() => removeIfExists(join(sandbox, 'ghost.json')));
  });
});

// ── ensureRuntimeLayout ──

describe('ensureRuntimeLayout', () => {
  beforeEach(makeSandbox);
  afterEach(cleanSandbox);

  function sandboxConfig() {
    return {
      paths: {
        stateFile: join(sandbox, '.orchestra', 'state.json'),
        historyDir: join(sandbox, '.orchestra', 'history'),
        logsDir: join(sandbox, '.orchestra', 'logs'),
      },
    };
  }

  it('creates all required directories', async () => {
    const config = sandboxConfig();
    await ensureRuntimeLayout(config);
    // Verify dirs exist by writing into them
    await writeFile(join(sandbox, '.orchestra', 'test'), 'ok', 'utf8');
    await writeFile(join(config.paths.historyDir, 'test'), 'ok', 'utf8');
    await writeFile(join(config.paths.logsDir, 'test'), 'ok', 'utf8');
  });

  it('cleans orphan .tmp files', async () => {
    const config = sandboxConfig();
    const orchDir = join(sandbox, '.orchestra');
    await mkdir(orchDir, { recursive: true });
    await writeFile(join(orchDir, 'state.json.tmp'), 'orphan', 'utf8');
    await writeFile(join(orchDir, 'other.tmp'), 'orphan2', 'utf8');

    const cleaned = await ensureRuntimeLayout(config);
    assert.equal(cleaned.length, 2);
    // Verify tmp files are gone
    assert.equal(await readJson(join(orchDir, 'state.json.tmp')), null);
  });

  it('returns empty array when no tmp files', async () => {
    const config = sandboxConfig();
    const cleaned = await ensureRuntimeLayout(config);
    assert.deepEqual(cleaned, []);
  });

  it('is idempotent', async () => {
    const config = sandboxConfig();
    await ensureRuntimeLayout(config);
    await ensureRuntimeLayout(config);
    // No error = pass
  });
});

// ── session isolation ──

function sessionConfig() {
  return {
    paths: {
      stateFile: join(sandbox, '.orchestra', 'state.json'),
      activeSessionFile: join(sandbox, '.orchestra', 'active_session.json'),
      historyDir: join(sandbox, '.orchestra', 'history'),
      logsDir: join(sandbox, '.orchestra', 'logs'),
    },
  };
}

describe('sessionStatePath', () => {
  beforeEach(makeSandbox);
  afterEach(cleanSandbox);

  it('returns path with session_id embedded', () => {
    const config = sessionConfig();
    const p = sessionStatePath(config, 'sess_123');
    assert.ok(p.includes('state_sess_123.json'));
  });

  it('places file in same directory as stateFile', () => {
    const config = sessionConfig();
    const p = sessionStatePath(config, 'sess_abc');
    // Same parent directory as stateFile
    assert.ok(p.includes('.orchestra'));
  });
});

describe('setActiveSession / getActiveSessionId', () => {
  beforeEach(makeSandbox);
  afterEach(cleanSandbox);

  it('writes and reads active session id', async () => {
    const config = sessionConfig();
    await setActiveSession(config, 'sess_42');
    const id = await getActiveSessionId(config);
    assert.equal(id, 'sess_42');
  });

  it('returns null when no active session file exists', async () => {
    const config = sessionConfig();
    const id = await getActiveSessionId(config);
    assert.equal(id, null);
  });

  it('overwrites previous active session', async () => {
    const config = sessionConfig();
    await setActiveSession(config, 'sess_1');
    await setActiveSession(config, 'sess_2');
    const id = await getActiveSessionId(config);
    assert.equal(id, 'sess_2');
  });
});

describe('saveSessionState / loadSessionState', () => {
  beforeEach(makeSandbox);
  afterEach(cleanSandbox);

  it('saves to session-scoped file and loads it back', async () => {
    const config = sessionConfig();
    const state = { session_id: 'sess_A', lifecycle: 'running', data: 'hello' };
    await saveSessionState(config, state);
    const loaded = await loadSessionState(config, 'sess_A');
    assert.deepEqual(loaded, state);
  });

  it('does not overwrite another session state file', async () => {
    const config = sessionConfig();
    const stateA = { session_id: 'sess_A', lifecycle: 'running', data: 'alpha' };
    const stateB = { session_id: 'sess_B', lifecycle: 'running', data: 'beta' };
    await saveSessionState(config, stateA);
    await saveSessionState(config, stateB);

    // Both session files should exist independently
    const loadedA = await loadSessionState(config, 'sess_A');
    const loadedB = await loadSessionState(config, 'sess_B');
    assert.equal(loadedA.data, 'alpha');
    assert.equal(loadedB.data, 'beta');
  });

  it('returns null for unknown session', async () => {
    const config = sessionConfig();
    const loaded = await loadSessionState(config, 'sess_nonexistent');
    assert.equal(loaded, null);
  });

  it('falls back to legacy state.json if session_id matches', async () => {
    const config = sessionConfig();
    // Write directly to state.json (legacy format)
    const legacyState = { session_id: 'sess_legacy', lifecycle: 'running', data: 'old' };
    await writeJsonAtomic(config.paths.stateFile, legacyState);
    // No session-scoped file exists, but legacy state.json has matching session_id
    const loaded = await loadSessionState(config, 'sess_legacy');
    assert.deepEqual(loaded, legacyState);
  });

  it('does not return legacy state if session_id does not match', async () => {
    const config = sessionConfig();
    const legacyState = { session_id: 'sess_other', lifecycle: 'running' };
    await writeJsonAtomic(config.paths.stateFile, legacyState);
    const loaded = await loadSessionState(config, 'sess_different');
    assert.equal(loaded, null);
  });
});
