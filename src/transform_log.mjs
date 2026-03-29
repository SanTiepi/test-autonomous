// transform_log.mjs — Machine-queryable transformation log.
// Replaces git commit messages with structured deltas.
// Each entry: input state hash, transformation type, affected symbols, checks, rollback.

import { createHash } from 'node:crypto';
import { readFile, writeFile, appendFile } from 'node:fs/promises';
import { join } from 'node:path';

const LOG_FILE = '.orchestra/transform_log.ndjson';

function hashContent(content) {
  return createHash('sha256').update(content).digest('hex').slice(0, 12);
}

// ── Transform entry ──

export function createTransformEntry({
  type,           // 'feat' | 'fix' | 'refactor' | 'test' | 'docs'
  goal,           // what was requested
  files_before,   // {path: hash} before change
  files_after,    // {path: hash} after change
  symbols_added,  // ['functionName', ...]
  symbols_removed,// ['functionName', ...]
  symbols_modified,// ['functionName', ...]
  tests_before,   // {pass, fail, total}
  tests_after,    // {pass, fail, total}
  codex_plan,     // the plan Codex gave
  codex_review,   // the review verdict
  duration_ms,    // total cycle time
  tokens_used,    // API tokens consumed
}) {
  return {
    id: hashContent(JSON.stringify({ goal, files_after, ts: Date.now() })),
    ts: new Date().toISOString(),
    type,
    goal,
    delta: {
      files_before,
      files_after,
      symbols_added: symbols_added ?? [],
      symbols_removed: symbols_removed ?? [],
      symbols_modified: symbols_modified ?? [],
    },
    checks: {
      tests_before,
      tests_after,
      regression: (tests_after?.fail ?? 0) > (tests_before?.fail ?? 0),
    },
    meta: {
      codex_plan: codex_plan?.slice(0, 200),
      codex_review: codex_review?.slice(0, 100),
      duration_ms,
      tokens_used,
    },
  };
}

// ── Persistence ──

export async function appendTransform(root, entry) {
  const path = join(root, LOG_FILE);
  await appendFile(path, JSON.stringify(entry) + '\n');
  return entry;
}

export async function loadTransformLog(root, lastN = 50) {
  try {
    const raw = await readFile(join(root, LOG_FILE), 'utf8');
    const lines = raw.trim().split('\n').filter(Boolean);
    return lines.slice(-lastN).map(l => JSON.parse(l));
  } catch {
    return [];
  }
}

// ── Queries ──

export function queryByType(log, type) {
  return log.filter(e => e.type === type);
}

export function queryByFile(log, filePath) {
  return log.filter(e =>
    e.delta.files_after?.[filePath] || e.delta.files_before?.[filePath]
  );
}

export function queryRegressions(log) {
  return log.filter(e => e.checks.regression);
}

export function summarizeLog(log) {
  const types = {};
  let totalDuration = 0;
  let totalTokens = 0;
  let regressions = 0;
  for (const e of log) {
    types[e.type] = (types[e.type] || 0) + 1;
    totalDuration += e.meta.duration_ms || 0;
    totalTokens += e.meta.tokens_used || 0;
    if (e.checks.regression) regressions++;
  }
  return {
    total: log.length,
    by_type: types,
    total_duration_ms: totalDuration,
    total_tokens: totalTokens,
    regressions,
  };
}

// ── File hashing helper ──

export async function hashFiles(root, paths) {
  const hashes = {};
  for (const p of paths) {
    try {
      const content = await readFile(join(root, p), 'utf8');
      hashes[p] = hashContent(content);
    } catch {
      hashes[p] = null;
    }
  }
  return hashes;
}
