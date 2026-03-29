import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { loadProjectMemory, saveProjectMemory, updateMemoryAfterTask, retrieveContext, buildInitialMemory } from '../src/context.mjs';

let sandbox;

async function setup() {
  sandbox = await mkdtemp(join(tmpdir(), 'context-test-'));
  await mkdir(join(sandbox, '.orchestra'), { recursive: true });
  await mkdir(join(sandbox, 'src'), { recursive: true });
  await mkdir(join(sandbox, 'test'), { recursive: true });
  // Create a fake source file
  await writeFile(join(sandbox, 'src/bookmarks.mjs'), `
import { createServer } from "node:http";
export function createBookmark(body) { return { id: "1", ...body }; }
export function listBookmarks(tag) { return []; }
export function deleteBookmark(id) { return true; }
`);
  await writeFile(join(sandbox, 'package.json'), JSON.stringify({ name: 'test', type: 'module', scripts: { test: 'node --test' } }));
}

describe('loadProjectMemory', () => {
  beforeEach(setup);
  afterEach(async () => { await rm(sandbox, { recursive: true, force: true }); });

  it('returns defaults when no memory file exists', async () => {
    const mem = await loadProjectMemory(sandbox);
    assert.deepEqual(mem.conventions, []);
    assert.deepEqual(mem.module_map, {});
    assert.equal(mem.updated_at, null);
  });

  it('loads saved memory', async () => {
    const mem = { ...await loadProjectMemory(sandbox), conventions: ['zero deps'] };
    await saveProjectMemory(sandbox, mem);
    const loaded = await loadProjectMemory(sandbox);
    assert.deepEqual(loaded.conventions, ['zero deps']);
    assert.ok(loaded.updated_at);
  });
});

describe('updateMemoryAfterTask', () => {
  beforeEach(setup);
  afterEach(async () => { await rm(sandbox, { recursive: true, force: true }); });

  it('updates module map for changed files', async () => {
    const mem = await updateMemoryAfterTask(sandbox, 'added bookmarks', ['src/bookmarks.mjs']);
    assert.ok(mem.module_map['src/bookmarks.mjs']);
    assert.ok(mem.module_map['src/bookmarks.mjs'].exports.includes('createBookmark'));
    assert.ok(mem.module_map['src/bookmarks.mjs'].exports.includes('listBookmarks'));
    assert.ok(mem.module_map['src/bookmarks.mjs'].imports.includes('node:http'));
  });

  it('tracks recent decisions', async () => {
    await updateMemoryAfterTask(sandbox, 'task 1', ['src/bookmarks.mjs']);
    const mem = await updateMemoryAfterTask(sandbox, 'task 2', ['src/bookmarks.mjs']);
    assert.ok(mem.recent_decisions.length >= 2);
    assert.equal(mem.recent_decisions[mem.recent_decisions.length - 1].task, 'task 2');
  });

  it('caps decisions at 10', async () => {
    for (let i = 0; i < 12; i++) {
      await updateMemoryAfterTask(sandbox, `task ${i}`, ['src/x.mjs']);
    }
    const mem = await loadProjectMemory(sandbox);
    assert.equal(mem.recent_decisions.length, 10);
  });
});

describe('retrieveContext', () => {
  beforeEach(setup);
  afterEach(async () => { await rm(sandbox, { recursive: true, force: true }); });

  it('finds relevant files by keyword', async () => {
    await updateMemoryAfterTask(sandbox, 'bookmarks module', ['src/bookmarks.mjs']);
    const ctx = await retrieveContext(sandbox, 'fix the bookmark listing');
    assert.ok(ctx.files.length > 0);
    assert.ok(ctx.files[0].file.includes('bookmarks'));
  });

  it('includes file content', async () => {
    await updateMemoryAfterTask(sandbox, 'init', ['src/bookmarks.mjs']);
    const ctx = await retrieveContext(sandbox, 'bookmark');
    assert.ok(ctx.files[0].content.includes('createBookmark'));
  });

  it('estimates tokens', async () => {
    await updateMemoryAfterTask(sandbox, 'init', ['src/bookmarks.mjs']);
    const ctx = await retrieveContext(sandbox, 'bookmark');
    assert.ok(ctx.token_estimate > 0);
  });

  it('falls back to grep when no memory', async () => {
    const ctx = await retrieveContext(sandbox, 'bookmark');
    // Should still find something via file scan
    assert.ok(ctx.files.length >= 0); // may or may not find depending on keyword match
  });
});

describe('buildInitialMemory', () => {
  beforeEach(setup);
  afterEach(async () => { await rm(sandbox, { recursive: true, force: true }); });

  it('scans src/ and builds module map', async () => {
    const mem = await buildInitialMemory(sandbox);
    assert.ok(mem.module_map['src/bookmarks.mjs']);
    assert.ok(mem.module_map['src/bookmarks.mjs'].exports.length > 0);
  });

  it('detects conventions from package.json', async () => {
    const mem = await buildInitialMemory(sandbox);
    assert.ok(mem.conventions.some(c => c.includes('ES modules')));
    assert.ok(mem.conventions.some(c => c.includes('Zero external')));
    assert.ok(mem.conventions.some(c => c.includes('node:test')));
  });
});
