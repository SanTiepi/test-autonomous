// codex_tools.test.mjs — Tests for Codex read-only file access tools.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolve, dirname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import { getToolDefinitions, executeToolCall } from '../src/codex_tools.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');

function makeConfig(overrides = {}) {
  return {
    codexReadFileMaxBytes: 8192,
    codexSearchMaxResults: 10,
    paths: { root: REPO_ROOT },
    ...overrides,
  };
}

// ── getToolDefinitions ──

describe('getToolDefinitions', () => {
  it('returns 3 tool definitions', () => {
    const defs = getToolDefinitions();
    assert.equal(defs.length, 3);
    const names = defs.map(d => d.name);
    assert.ok(names.includes('list_files'));
    assert.ok(names.includes('search_repo'));
    assert.ok(names.includes('read_file'));
  });

  it('each definition has type, name, description, parameters', () => {
    for (const def of getToolDefinitions()) {
      assert.equal(def.type, 'function');
      assert.ok(typeof def.name === 'string');
      assert.ok(typeof def.description === 'string');
      assert.ok(typeof def.parameters === 'object');
    }
  });
});

// ── list_files ──

describe('list_files', () => {
  it('returns repo-relative paths', async () => {
    const config = makeConfig();
    const result = await executeToolCall('list_files', { path: '.' }, config);
    const lines = result.split('\n').filter(Boolean);
    assert.ok(lines.length > 0, 'should return some files');
    // Paths should not start with repo root (they are relative)
    for (const line of lines) {
      assert.ok(!line.startsWith(REPO_ROOT), `path should be relative: ${line}`);
      // Should not start with / or drive letter
      assert.ok(!line.startsWith('/'), `path should not be absolute: ${line}`);
    }
  });

  it('respects limit', async () => {
    const config = makeConfig();
    const result = await executeToolCall('list_files', { path: '.', limit: 3 }, config);
    const lines = result.split('\n').filter(Boolean);
    assert.ok(lines.length <= 3, `expected at most 3 entries, got ${lines.length}`);
  });

  it('rejects paths outside repo', async () => {
    const config = makeConfig();
    await assert.rejects(
      () => executeToolCall('list_files', { path: '../../..' }, config),
      /Path outside repo/
    );
  });

  it('filters by glob pattern', async () => {
    const config = makeConfig();
    const result = await executeToolCall('list_files', { path: 'src', glob: '*.mjs' }, config);
    const lines = result.split('\n').filter(Boolean);
    for (const line of lines) {
      if (!line.endsWith('/')) {
        assert.ok(line.endsWith('.mjs'), `should match glob: ${line}`);
      }
    }
  });
});

// ── search_repo ──

describe('search_repo', () => {
  it('finds matching lines', async () => {
    const config = makeConfig();
    // Search for a known string in our own source
    const result = await executeToolCall('search_repo', { query: 'invokeCodex', path: 'src' }, config);
    assert.ok(result.includes('invokeCodex'), `expected match, got: ${result.slice(0, 200)}`);
    // Format: file:line: content
    assert.ok(result.includes(':'), 'should have file:line format');
  });

  it('respects limit', async () => {
    const config = makeConfig({ codexSearchMaxResults: 2 });
    const result = await executeToolCall('search_repo', { query: 'import', path: 'src', limit: 2 }, config);
    const lines = result.split('\n').filter(Boolean);
    assert.ok(lines.length <= 2, `expected at most 2 results, got ${lines.length}`);
  });

  it('returns (no matches) when nothing found', async () => {
    const config = makeConfig();
    const result = await executeToolCall('search_repo', { query: 'zzz_definitely_not_here_xyzzy', path: 'src' }, config);
    assert.equal(result, '(no matches)');
  });
});

// ── read_file ──

describe('read_file', () => {
  it('returns content with line slicing', async () => {
    const config = makeConfig();
    const result = await executeToolCall('read_file', { path: 'package.json', startLine: 1, endLine: 3 }, config);
    assert.ok(typeof result === 'string');
    const lines = result.split('\n');
    assert.ok(lines.length <= 3, `expected at most 3 lines, got ${lines.length}`);
  });

  it('rejects paths outside repo', async () => {
    const config = makeConfig();
    await assert.rejects(
      () => executeToolCall('read_file', { path: '../../../etc/passwd' }, config),
      /Path outside repo/
    );
  });

  it('respects maxBytes', async () => {
    const config = makeConfig({ codexReadFileMaxBytes: 50 });
    const result = await executeToolCall('read_file', { path: 'package.json' }, config);
    assert.ok(result.length <= 50, `expected at most 50 bytes, got ${result.length}`);
  });

  it('defaults to 100 lines when no endLine', async () => {
    const config = makeConfig({ codexReadFileMaxBytes: 999999 });
    // Read a file that exists — the default window should be ~100 lines
    const result = await executeToolCall('read_file', { path: 'src/dispatcher.mjs' }, config);
    const lines = result.split('\n');
    assert.ok(lines.length <= 101, `expected at most ~101 lines, got ${lines.length}`);
  });

  it('args.maxBytes overrides config', async () => {
    const config = makeConfig({ codexReadFileMaxBytes: 99999 });
    const result = await executeToolCall('read_file', { path: 'package.json', maxBytes: 30 }, config);
    assert.ok(result.length <= 30, `expected at most 30 bytes, got ${result.length}`);
  });
});

// ── unknown tool ──

describe('unknown tool', () => {
  it('returns error message for unknown tool', async () => {
    const config = makeConfig();
    const result = await executeToolCall('delete_all', {}, config);
    assert.ok(result.includes('Unknown tool'));
  });
});
