import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtemp, writeFile, mkdir, rm } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import {
  analyzeRepo,
  runTargetedTests,
  httpTest,
  measureCoverage,
  parseCoverageOutput,
} from '../src/devtools.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// ---- analyzeRepo ----

describe('analyzeRepo', () => {
  let result;
  before(async () => { result = await analyzeRepo(ROOT); });

  it('returns file tree with src and test keys', () => {
    assert.ok(Array.isArray(result.fileTree.src));
    assert.ok(Array.isArray(result.fileTree.test));
  });

  it('lists known source files in src/', () => {
    assert.ok(result.fileTree.src.includes('index.mjs'));
    assert.ok(result.fileTree.src.includes('bookmarks.mjs'));
    assert.ok(result.fileTree.src.includes('devtools.mjs'));
  });

  it('lists files in subdirectories', () => {
    assert.ok(result.fileTree.src.some(f => f.startsWith('lang/')));
    assert.ok(result.fileTree.src.some(f => f.startsWith('mcl/')));
  });

  it('lists test files in test/', () => {
    assert.ok(result.fileTree.test.some(f => f.endsWith('.test.mjs')));
    assert.ok(result.fileTree.test.includes('devtools.test.mjs'));
  });

  it('builds dependency graph with node: built-in imports', () => {
    const deps = result.dependencyGraph['src/index.mjs'];
    assert.ok(deps, 'src/index.mjs should have dependencies');
    assert.ok(deps.includes('node:http'));
  });

  it('builds dependency graph with local relative imports', () => {
    const deps = result.dependencyGraph['src/index.mjs'];
    assert.ok(deps.some(d => d.includes('middleware')));
    assert.ok(deps.some(d => d.includes('bookmarks')));
    assert.ok(deps.some(d => d.includes('rate_limiter')));
  });

  it('tracks test file dependencies back to source', () => {
    // test/bookmarks.test.mjs imports ../src/index.mjs
    const deps = result.dependencyGraph['test/bookmarks.test.mjs'];
    assert.ok(deps, 'test/bookmarks.test.mjs should have dependencies');
    assert.ok(deps.some(d => d.includes('src/index.mjs')));
  });

  it('extracts exported symbols from index', () => {
    const syms = result.exportedSymbols['src/index.mjs'];
    assert.ok(syms);
    assert.ok(syms.includes('handleRequest'));
    assert.ok(syms.includes('matchRoute'));
    assert.ok(syms.includes('server'));
    assert.ok(syms.includes('json'));
    assert.ok(syms.includes('readBody'));
  });

  it('extracts exported symbols from other modules', () => {
    const syms = result.exportedSymbols['src/bookmarks.mjs'];
    assert.ok(syms);
    assert.ok(syms.includes('validateBookmark'));
    assert.ok(syms.includes('createBookmark'));
  });

  it('detects static routes', () => {
    assert.ok(result.routes.some(r => r.method === 'GET' && r.path === '/'));
    assert.ok(result.routes.some(r => r.method === 'GET' && r.path === '/health'));
  });

  it('detects dynamic routes', () => {
    assert.ok(result.routes.some(r => r.method === 'POST' && r.path.includes('/users')));
    assert.ok(result.routes.some(r => r.method === 'GET' && r.path.includes('/todos')));
    assert.ok(result.routes.some(r => r.method === 'DELETE' && r.path.includes('/todos')));
    assert.ok(result.routes.some(r => r.method === 'POST' && r.path.includes('/bookmarks')));
  });

  it('converts regex capture groups to :param', () => {
    const paramRoutes = result.routes.filter(r => r.path.includes(':param'));
    assert.ok(paramRoutes.length > 0, 'should have parameterized routes');
    // GET /users/:param should exist
    assert.ok(paramRoutes.some(r => r.method === 'GET' && r.path.includes('/users/:param')));
  });

  it('attributes each route to a source file', () => {
    for (const route of result.routes) {
      assert.ok(route.source, 'route must have source');
      assert.ok(route.source.endsWith('.mjs'));
    }
  });

  it('returns sorted file lists', () => {
    const srcFiles = result.fileTree.src;
    const sorted = [...srcFiles].sort();
    assert.deepEqual(srcFiles, sorted);
  });
});

// ---- runTargetedTests (isolated fixtures) ----

describe('runTargetedTests', () => {
  let tmpDir;

  before(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'devtools-rt-'));
    await mkdir(join(tmpDir, 'src'));
    await mkdir(join(tmpDir, 'test'));

    await writeFile(
      join(tmpDir, 'src', 'math.mjs'),
      'export function add(a, b) { return a + b; }\n',
    );
    await writeFile(
      join(tmpDir, 'src', 'unused.mjs'),
      'export const X = 42;\n',
    );
    await writeFile(
      join(tmpDir, 'test', 'math.test.mjs'),
      [
        'import { describe, it } from "node:test";',
        'import assert from "node:assert/strict";',
        'import { add } from "../src/math.mjs";',
        'describe("add", () => {',
        '  it("sums two numbers", () => assert.equal(add(1, 2), 3));',
        '});',
      ].join('\n'),
    );
    await writeFile(
      join(tmpDir, 'test', 'standalone.test.mjs'),
      [
        'import { describe, it } from "node:test";',
        'import assert from "node:assert/strict";',
        'describe("standalone", () => {',
        '  it("passes", () => assert.ok(true));',
        '});',
      ].join('\n'),
    );
  });

  after(async () => { await rm(tmpDir, { recursive: true, force: true }); });

  it('targets only tests importing the changed file', async () => {
    const result = await runTargetedTests(['src/math.mjs'], tmpDir);
    assert.equal(result.targetedFiles.length, 1);
    assert.ok(result.targetedFiles[0].includes('math.test.mjs'));
  });

  it('runs targeted tests and reports pass', async () => {
    const result = await runTargetedTests(['src/math.mjs'], tmpDir);
    assert.equal(result.results.passed, true);
    assert.equal(result.results.exitCode, 0);
    // node:test may write to stdout or stderr depending on version
    const output = result.results.stdout + result.results.stderr;
    assert.ok(output.length > 0);
  });

  it('returns empty when no test imports the file', async () => {
    const result = await runTargetedTests(['src/unused.mjs'], tmpDir);
    assert.deepEqual(result.targetedFiles, []);
    assert.equal(result.results.passed, true);
  });

  it('returns empty for nonexistent changed files', async () => {
    const result = await runTargetedTests(['src/nope.mjs'], tmpDir);
    assert.deepEqual(result.targetedFiles, []);
  });

  it('handles multiple changed files', async () => {
    const result = await runTargetedTests(['src/math.mjs', 'src/unused.mjs'], tmpDir);
    // Only math.test.mjs imports math.mjs; nothing imports unused.mjs
    assert.equal(result.targetedFiles.length, 1);
  });
});

// ---- httpTest ----

describe('httpTest', () => {
  let server;
  let port;

  before(async () => {
    server = createServer((req, res) => {
      if (req.method === 'GET' && req.url === '/ping') {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ pong: true }));
      } else if (req.method === 'POST' && req.url === '/echo') {
        const chunks = [];
        req.on('data', c => chunks.push(c));
        req.on('end', () => {
          res.writeHead(200, { 'content-type': 'application/json' });
          res.end(Buffer.concat(chunks).toString());
        });
      } else if (req.method === 'GET' && req.url === '/text') {
        res.writeHead(200, { 'content-type': 'text/plain' });
        res.end('hello plain');
      } else {
        res.writeHead(404, { 'content-type': 'text/plain' });
        res.end('not found');
      }
    });
    await new Promise(r => server.listen(0, r));
    port = server.address().port;
  });

  after(async () => { await new Promise(r => server.close(r)); });

  it('performs GET and returns status, headers, body, duration', async () => {
    const r = await httpTest(port, 'GET', '/ping');
    assert.equal(r.status, 200);
    assert.deepEqual(r.body, { pong: true });
    assert.equal(r.headers['content-type'], 'application/json');
    assert.equal(typeof r.duration, 'number');
    assert.ok(r.duration >= 0);
  });

  it('performs POST with JSON body', async () => {
    const r = await httpTest(port, 'POST', '/echo', { hello: 'world' });
    assert.equal(r.status, 200);
    assert.deepEqual(r.body, { hello: 'world' });
  });

  it('returns 404 for unknown routes', async () => {
    const r = await httpTest(port, 'GET', '/nope');
    assert.equal(r.status, 404);
  });

  it('returns plain text body when response is not JSON', async () => {
    const r = await httpTest(port, 'GET', '/text');
    assert.equal(r.body, 'hello plain');
  });

  it('sends no body for GET requests', async () => {
    const r = await httpTest(port, 'GET', '/ping', null);
    assert.equal(r.status, 200);
  });

  it('includes duration as a non-negative number', async () => {
    const r = await httpTest(port, 'GET', '/ping');
    assert.equal(typeof r.duration, 'number');
    assert.ok(r.duration >= 0);
  });
});

// ---- parseCoverageOutput ----

describe('parseCoverageOutput', () => {
  const SAMPLE = [
    '# start of coverage report',
    '# ----------------------------------',
    '# file           | line % | branch % | funcs % | uncovered lines',
    '# ----------------------------------',
    '# src/a.mjs      |  85.71 |   66.67  | 100.00  | 12-15',
    '# src/b.mjs      | 100.00 |  100.00  | 100.00  |',
    '# ----------------------------------',
    '# all files      |  92.00 |   80.00  | 100.00  |',
    '# ----------------------------------',
    '# end of coverage report',
  ].join('\n');

  it('parses individual file entries', () => {
    const { files } = parseCoverageOutput(SAMPLE);
    assert.equal(files.length, 2);
    assert.equal(files[0].file, 'src/a.mjs');
    assert.equal(files[0].lines, 85.71);
    assert.equal(files[0].branches, 66.67);
    assert.equal(files[0].functions, 100);
    assert.equal(files[0].uncoveredLines, '12-15');
  });

  it('parses fully-covered files', () => {
    const { files } = parseCoverageOutput(SAMPLE);
    assert.equal(files[1].file, 'src/b.mjs');
    assert.equal(files[1].lines, 100);
    assert.equal(files[1].uncoveredLines, '');
  });

  it('parses summary row', () => {
    const { summary } = parseCoverageOutput(SAMPLE);
    assert.ok(summary);
    assert.equal(summary.lines, 92);
    assert.equal(summary.branches, 80);
    assert.equal(summary.functions, 100);
  });

  it('returns empty for output with no coverage report', () => {
    const { files, summary } = parseCoverageOutput('no report here');
    assert.deepEqual(files, []);
    assert.equal(summary, null);
  });

  it('handles info-prefix format (ℹ)', () => {
    const alt = SAMPLE.replace(/^# /gm, 'ℹ ');
    const { files, summary } = parseCoverageOutput(alt);
    assert.equal(files.length, 2);
    assert.ok(summary);
  });
});

// ---- measureCoverage ----

describe('measureCoverage', () => {
  let tmpDir;

  before(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'devtools-cov-'));
    await mkdir(join(tmpDir, 'src'));
    await mkdir(join(tmpDir, 'test'));
    await writeFile(
      join(tmpDir, 'src', 'util.mjs'),
      'export const double = n => n * 2;\nexport const unused = () => {};\n',
    );
    await writeFile(
      join(tmpDir, 'test', 'util.test.mjs'),
      [
        'import { describe, it } from "node:test";',
        'import assert from "node:assert/strict";',
        'import { double } from "../src/util.mjs";',
        'describe("double", () => {',
        '  it("doubles a number", () => assert.equal(double(3), 6));',
        '});',
      ].join('\n'),
    );
  });

  after(async () => { await rm(tmpDir, { recursive: true, force: true }); });

  it('runs coverage and returns raw output', async () => {
    const result = await measureCoverage(tmpDir);
    assert.ok(result.raw.length > 0, 'should produce raw output');
  });

  it('returns structured file/summary arrays', async () => {
    const result = await measureCoverage(tmpDir);
    assert.ok(Array.isArray(result.files));
    // summary may be null if Node version doesn't produce parseable output
    assert.ok(result.summary === null || typeof result.summary === 'object');
  });

  it('returns empty when no test files exist', async () => {
    const emptyDir = await mkdtemp(join(tmpdir(), 'devtools-empty-'));
    await mkdir(join(emptyDir, 'test'));
    const result = await measureCoverage(emptyDir);
    assert.deepEqual(result.files, []);
    assert.equal(result.summary, null);
    assert.equal(result.raw, '');
    await rm(emptyDir, { recursive: true, force: true });
  });
});
