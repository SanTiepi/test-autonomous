import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createTransformEntry, appendTransform, loadTransformLog, queryByType, queryByFile, queryRegressions, summarizeLog, hashFiles } from '../src/transform_log.mjs';

let sandbox;

async function setup() {
  sandbox = await mkdtemp(join(tmpdir(), 'tlog-test-'));
  await mkdir(join(sandbox, '.orchestra'), { recursive: true });
}

describe('createTransformEntry', () => {
  it('creates a structured entry with all fields', () => {
    const entry = createTransformEntry({
      type: 'feat', goal: 'add stats endpoint',
      files_before: { 'src/a.mjs': 'abc123' }, files_after: { 'src/a.mjs': 'def456' },
      symbols_added: ['getStats'], symbols_removed: [], symbols_modified: [],
      tests_before: { pass: 40, fail: 0, total: 40 }, tests_after: { pass: 42, fail: 0, total: 42 },
      codex_plan: 'add getStats function', codex_review: 'approve',
      duration_ms: 50000, tokens_used: 1200,
    });
    assert.equal(entry.type, 'feat');
    assert.ok(entry.id);
    assert.ok(entry.ts);
    assert.deepEqual(entry.delta.symbols_added, ['getStats']);
    assert.equal(entry.checks.regression, false);
    assert.equal(entry.meta.duration_ms, 50000);
  });

  it('detects regression', () => {
    const entry = createTransformEntry({
      type: 'fix', goal: 'fix bug',
      tests_before: { pass: 40, fail: 0 }, tests_after: { pass: 39, fail: 1 },
    });
    assert.equal(entry.checks.regression, true);
  });
});

describe('appendTransform + loadTransformLog', () => {
  beforeEach(setup);
  afterEach(async () => { await rm(sandbox, { recursive: true, force: true }); });

  it('appends and loads entries', async () => {
    const e1 = createTransformEntry({ type: 'feat', goal: 'a' });
    const e2 = createTransformEntry({ type: 'fix', goal: 'b' });
    await appendTransform(sandbox, e1);
    await appendTransform(sandbox, e2);
    const log = await loadTransformLog(sandbox);
    assert.equal(log.length, 2);
    assert.equal(log[0].goal, 'a');
    assert.equal(log[1].goal, 'b');
  });

  it('returns empty array when no log exists', async () => {
    const log = await loadTransformLog(sandbox);
    assert.deepEqual(log, []);
  });
});

describe('queries', () => {
  const log = [
    createTransformEntry({ type: 'feat', goal: 'a', files_after: { 'src/x.mjs': 'h1' } }),
    createTransformEntry({ type: 'fix', goal: 'b', files_after: { 'src/y.mjs': 'h2' }, tests_before: { fail: 0 }, tests_after: { fail: 1 } }),
    createTransformEntry({ type: 'feat', goal: 'c', files_after: { 'src/x.mjs': 'h3' } }),
  ];

  it('queryByType filters correctly', () => {
    assert.equal(queryByType(log, 'feat').length, 2);
    assert.equal(queryByType(log, 'fix').length, 1);
  });

  it('queryByFile finds entries touching a file', () => {
    assert.equal(queryByFile(log, 'src/x.mjs').length, 2);
    assert.equal(queryByFile(log, 'src/y.mjs').length, 1);
  });

  it('queryRegressions finds regressions', () => {
    assert.equal(queryRegressions(log).length, 1);
  });

  it('summarizeLog produces stats', () => {
    const s = summarizeLog(log);
    assert.equal(s.total, 3);
    assert.equal(s.by_type.feat, 2);
    assert.equal(s.by_type.fix, 1);
    assert.equal(s.regressions, 1);
  });
});

describe('hashFiles', () => {
  beforeEach(setup);
  afterEach(async () => { await rm(sandbox, { recursive: true, force: true }); });

  it('hashes existing files', async () => {
    await writeFile(join(sandbox, 'test.txt'), 'hello');
    const h = await hashFiles(sandbox, ['test.txt']);
    assert.ok(h['test.txt']);
    assert.equal(h['test.txt'].length, 12);
  });

  it('returns null for missing files', async () => {
    const h = await hashFiles(sandbox, ['missing.txt']);
    assert.equal(h['missing.txt'], null);
  });
});
