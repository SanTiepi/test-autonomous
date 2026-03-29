// Developer tooling module — zero external deps, pure Node.js built-ins
import { readdir, readFile } from 'node:fs/promises';
import { join, resolve, relative, dirname } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { performance } from 'node:perf_hooks';

const execFileP = promisify(execFile);

// --- Internal helpers ---

async function walkDir(dirPath) {
  const files = [];
  let entries;
  try {
    entries = await readdir(dirPath, { withFileTypes: true });
  } catch (e) {
    if (e.code === 'ENOENT') return files;
    throw e;
  }
  for (const entry of entries) {
    const full = join(dirPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walkDir(full)));
    } else if (entry.isFile() && entry.name.endsWith('.mjs')) {
      files.push(full);
    }
  }
  return files;
}

function parseImports(content) {
  const imports = [];
  const fromRe = /\bfrom\s+["']([^"']+)["']/g;
  let m;
  while ((m = fromRe.exec(content)) !== null) imports.push(m[1]);
  // Bare side-effect imports: import "specifier"
  const bareRe = /^\s*import\s+["']([^"']+)["']\s*;?\s*$/gm;
  while ((m = bareRe.exec(content)) !== null) {
    if (!imports.includes(m[1])) imports.push(m[1]);
  }
  return imports;
}

function parseExports(content) {
  const symbols = new Set();
  let m;
  // export function / export async function
  for (m of content.matchAll(/export\s+(?:async\s+)?function\s+(\w+)/g)) symbols.add(m[1]);
  // export const / let / var
  for (m of content.matchAll(/export\s+(?:const|let|var)\s+(\w+)/g)) symbols.add(m[1]);
  // export class
  for (m of content.matchAll(/export\s+class\s+(\w+)/g)) symbols.add(m[1]);
  // export default
  if (/export\s+default\s/.test(content)) symbols.add('default');
  // export { name1, name2, ... }
  for (m of content.matchAll(/export\s*\{([^}]+)\}/g)) {
    for (const name of m[1].split(',')) {
      const parts = name.trim().split(/\s+as\s+/);
      const sym = parts[parts.length - 1].trim();
      if (sym) symbols.add(sym);
    }
  }
  return [...symbols];
}

function regexToPath(raw) {
  let p = raw;
  // Remove nested non-capturing groups like (?:\?(.*))? first
  p = p.replace(/\(\?:[^()]*\([^()]*\)[^()]*\)\??/g, '');
  // Remove simple non-capturing groups
  p = p.replace(/\(\?:[^()]*\)\??/g, '');
  // Unescape forward slashes
  p = p.replace(/\\\//g, '/');
  // Replace capture groups with :param
  p = p.replace(/\([^()]*\)/g, ':param');
  // Strip remaining regex metacharacters
  p = p.replace(/[\\^$*+?{}[\]|]/g, '');
  return p || '/';
}

function parseRoutes(content, sourceKey) {
  const routes = [];
  // Static routes: "GET /path"
  for (const m of content.matchAll(/"(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS)\s+(\/[^"]*)"/g)) {
    routes.push({ method: m[1], path: m[2], source: sourceKey });
  }
  // Dynamic routes: { method: "METHOD", ... pattern: /^...$/ }
  for (const m of content.matchAll(/method:\s*"(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS)"[\s\S]{0,500}?pattern:\s*\/\^(.*?)\$\//g)) {
    routes.push({ method: m[1], path: regexToPath(m[2]), source: sourceKey });
  }
  return routes;
}

// --- Public API ---

/**
 * Scan src/ and test/ to produce file tree, dependency graph, exported symbols, and route list.
 */
export async function analyzeRepo(rootDir = process.cwd()) {
  const scanDirs = ['src', 'test'];
  const fileTree = {};
  const dependencyGraph = {};
  const exportedSymbols = {};
  const routes = [];

  for (const dir of scanDirs) {
    const absDir = join(rootDir, dir);
    const allFiles = await walkDir(absDir);
    fileTree[dir] = allFiles.map(f => relative(absDir, f).replace(/\\/g, '/')).sort();

    for (const absFile of allFiles) {
      const key = relative(rootDir, absFile).replace(/\\/g, '/');
      const content = await readFile(absFile, 'utf-8');

      // Dependency graph: resolve relative imports to project-relative paths
      dependencyGraph[key] = parseImports(content).map(spec => {
        if (spec.startsWith('.')) {
          return relative(rootDir, resolve(dirname(absFile), spec)).replace(/\\/g, '/');
        }
        return spec; // node: built-ins and bare specifiers kept as-is
      });

      // Exported symbols
      exportedSymbols[key] = parseExports(content);

      // Route detection
      routes.push(...parseRoutes(content, key));
    }
  }

  return { fileTree, dependencyGraph, exportedSymbols, routes };
}

/**
 * Given changed files, find test files that import them and run only those tests.
 */
export async function runTargetedTests(changedFiles, rootDir = process.cwd()) {
  const changed = changedFiles.map(f => resolve(rootDir, f).replace(/\\/g, '/'));
  const testDir = join(rootDir, 'test');
  const testFiles = (await walkDir(testDir)).filter(f => f.endsWith('.test.mjs'));

  const affected = [];
  for (const tf of testFiles) {
    const content = await readFile(tf, 'utf-8');
    const resolved = parseImports(content)
      .filter(s => s.startsWith('.'))
      .map(s => resolve(dirname(tf), s).replace(/\\/g, '/'));
    if (resolved.some(r => changed.includes(r))) {
      affected.push(relative(rootDir, tf).replace(/\\/g, '/'));
    }
  }

  if (!affected.length) {
    return { targetedFiles: [], results: { exitCode: 0, stdout: '', stderr: '', passed: true } };
  }

  try {
    const { stdout, stderr } = await execFileP(process.execPath, ['--test', ...affected], {
      cwd: rootDir,
      timeout: 120_000,
    });
    return { targetedFiles: affected, results: { exitCode: 0, stdout, stderr, passed: true } };
  } catch (e) {
    return {
      targetedFiles: affected,
      results: {
        exitCode: typeof e.code === 'number' ? e.code : 1,
        stdout: e.stdout || '',
        stderr: e.stderr || '',
        passed: false,
      },
    };
  }
}

/**
 * Make a real HTTP request and return { status, headers, body, duration }.
 */
export async function httpTest(port, method, path, body = null) {
  const url = `http://localhost:${port}${path}`;
  const opts = { method, headers: {} };
  if (body != null) {
    opts.body = JSON.stringify(body);
    opts.headers['content-type'] = 'application/json';
  }

  const t0 = performance.now();
  const res = await fetch(url, opts);
  const duration = Math.round((performance.now() - t0) * 100) / 100;

  const text = await res.text();
  let parsed;
  try { parsed = JSON.parse(text); } catch { parsed = text; }

  return {
    status: res.status,
    headers: Object.fromEntries(res.headers.entries()),
    body: parsed,
    duration,
  };
}

/**
 * Parse Node.js --experimental-test-coverage output into structured data.
 */
export function parseCoverageOutput(output) {
  const files = [];
  let summary = null;
  let inReport = false;

  for (const line of output.split('\n')) {
    if (line.includes('start of coverage report')) { inReport = true; continue; }
    if (line.includes('end of coverage report')) break;
    if (!inReport || line.includes('---') || line.includes('line %')) continue;

    const cleaned = line.replace(/^[#ℹ\s]+/, '');
    const parts = cleaned.split('|').map(s => s.trim());
    if (parts.length >= 4 && parts[0]) {
      const entry = {
        file: parts[0],
        lines: parseFloat(parts[1]) || 0,
        branches: parseFloat(parts[2]) || 0,
        functions: parseFloat(parts[3]) || 0,
        uncoveredLines: (parts[4] || '').trim(),
      };
      if (parts[0] === 'all files') {
        summary = { lines: entry.lines, branches: entry.branches, functions: entry.functions };
      } else {
        files.push(entry);
      }
    }
  }

  return { files, summary };
}

/**
 * Run tests with --experimental-test-coverage and return parsed coverage data.
 */
export async function measureCoverage(rootDir = process.cwd()) {
  const testDir = join(rootDir, 'test');
  const testFiles = (await walkDir(testDir))
    .filter(f => f.endsWith('.test.mjs'))
    .map(f => relative(rootDir, f).replace(/\\/g, '/'));

  if (!testFiles.length) return { files: [], summary: null, raw: '' };

  try {
    const { stdout, stderr } = await execFileP(
      process.execPath,
      ['--test', '--experimental-test-coverage', ...testFiles],
      { cwd: rootDir, timeout: 120_000 },
    );
    const raw = stdout + '\n' + stderr;
    return { ...parseCoverageOutput(raw), raw };
  } catch (e) {
    const raw = (e.stdout || '') + '\n' + (e.stderr || '');
    return { ...parseCoverageOutput(raw), raw };
  }
}
