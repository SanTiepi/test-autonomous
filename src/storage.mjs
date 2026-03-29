// storage.mjs — Atomic read/write for JSON files. Sole disk-access point.

import { readFile, writeFile, rename, unlink, mkdir, readdir, stat } from 'node:fs/promises';
import { join, dirname, resolve } from 'node:path';

// ── helpers ──

async function exists(p) {
  try { await stat(p); return true; } catch { return false; }
}

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// ── exports ──

export async function readJson(path) {
  try {
    const raw = await readFile(path, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw err;
  }
}

export async function writeJsonAtomic(path, data) {
  const tmp = path + '.tmp';
  const json = JSON.stringify(data, null, 2) + '\n';
  const maxRetries = 3;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      await mkdir(dirname(path), { recursive: true });
      await writeFile(tmp, json, 'utf8');
      await rename(tmp, path);
      return;
    } catch (err) {
      if ((err.code === 'EACCES' || err.code === 'EPERM') && attempt < maxRetries - 1) {
        await sleep(200);
        continue;
      }
      // Clean up tmp on final failure
      try { await unlink(tmp); } catch { /* ignore */ }
      throw err;
    }
  }
}

export async function removeIfExists(path) {
  try {
    await unlink(path);
  } catch (err) {
    if (err.code === 'ENOENT') return;
    throw err;
  }
}

export async function ensureRuntimeLayout(config) {
  const dirs = [
    dirname(config.paths.stateFile),   // .orchestra/
    config.paths.historyDir,           // .orchestra/history/
    config.paths.logsDir,              // .orchestra/logs/
  ];

  for (const dir of dirs) {
    await mkdir(dir, { recursive: true });
  }

  // Clean up orphan .tmp files in .orchestra/
  const orchestraRoot = dirname(config.paths.stateFile);
  const cleaned = [];

  async function cleanTmp(dir) {
    let entries;
    try { entries = await readdir(dir, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        await cleanTmp(full);
      } else if (entry.name.endsWith('.tmp')) {
        await removeIfExists(full);
        cleaned.push(full);
      }
    }
  }

  await cleanTmp(orchestraRoot);
  return cleaned;
}

// ── session isolation ──

export function sessionStatePath(config, sessionId) {
  return resolve(dirname(config.paths.stateFile), `state_${sessionId}.json`);
}

export async function setActiveSession(config, sessionId) {
  await writeJsonAtomic(config.paths.activeSessionFile, {
    session_id: sessionId,
    updated_at: new Date().toISOString(),
  });
}

export async function getActiveSessionId(config) {
  const active = await readJson(config.paths.activeSessionFile);
  return active?.session_id ?? null;
}

export async function loadSessionState(config, sessionId) {
  const scoped = await readJson(sessionStatePath(config, sessionId));
  if (scoped) return scoped;
  // Fall back to legacy state.json if session_id matches
  const legacy = await readJson(config.paths.stateFile);
  if (legacy?.session_id === sessionId) return legacy;
  return null;
}

export async function saveSessionState(config, state) {
  await writeJsonAtomic(sessionStatePath(config, state.session_id), state);
  await writeJsonAtomic(config.paths.stateFile, state);
}
