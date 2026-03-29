// history.mjs — Archive closed turns and reload recent context.

import { readJson, writeJsonAtomic } from './storage.mjs';
import { join } from 'node:path';
import { readdir, mkdir } from 'node:fs/promises';

// No-op logger fallback (logger.mjs may not exist yet)
let log;
try {
  const mod = await import('./logger.mjs').catch(() => null);
  log = mod?.log ?? mod?.default ?? (() => {});
} catch {
  log = () => {};
}

// ── helpers ──

function padTurn(turnId) {
  return String(turnId).padStart(4, '0');
}

function sessionDir(sessionId, config) {
  return join(config.paths.historyDir, sessionId);
}

function turnFilename(turnId, actor, status) {
  return `turn-${padTurn(turnId)}.${actor}.${status}.json`;
}

// ── exports ──

export async function archiveTurn(sessionId, turnId, actor, status, data, config) {
  const dir = sessionDir(sessionId, config);
  await mkdir(dir, { recursive: true });
  const filename = turnFilename(turnId, actor, status);
  const filepath = join(dir, filename);
  await writeJsonAtomic(filepath, {
    session_id: sessionId,
    turn_id: turnId,
    actor,
    status,
    archived_at: new Date().toISOString(),
    data,
  });
  return filepath;
}

export async function loadRecentTurns(sessionId, n, config) {
  const dir = sessionDir(sessionId, config);
  let entries;
  try {
    entries = await readdir(dir);
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }

  // Filter to turn files and sort by name (which sorts by turn_id due to zero-padding)
  const turnFiles = entries
    .filter(f => f.startsWith('turn-') && f.endsWith('.json'))
    .sort();

  // Take the last n
  const recent = turnFiles.slice(-n);

  const results = [];
  for (const file of recent) {
    const data = await readJson(join(dir, file));
    if (data) results.push(data);
  }

  return results.sort((a, b) => a.turn_id - b.turn_id);
}

export async function rebuildRollingSummary(sessionId, config) {
  const dir = sessionDir(sessionId, config);
  let entries;
  try {
    entries = await readdir(dir);
  } catch (err) {
    if (err.code === 'ENOENT') return '';
    throw err;
  }

  const turnFiles = entries
    .filter(f => f.startsWith('turn-') && f.endsWith('.json'))
    .sort();

  const parts = [];
  for (const file of turnFiles) {
    const record = await readJson(join(dir, file));
    if (!record) continue;
    const summary = record.data?.envelope?.summary ?? record.data?.summary ?? record.data?.details ?? '';
    const shortSummary = summary.slice(0, 80);
    parts.push(`T${record.turn_id}[${record.actor}/${record.status}]: ${shortSummary}`);
  }

  // Condense to <500 chars
  let result = parts.join('; ');
  if (result.length > 500) {
    result = result.slice(0, 497) + '...';
  }
  return result;
}
