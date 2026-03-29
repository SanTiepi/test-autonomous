#!/usr/bin/env node
// orchestra.mjs — CLI entry point for the AI orchestration system.
// Commands: start, resume, approve, stop, watch

import { loadConfig } from './src/config.mjs';
import { readJson, writeJsonAtomic, ensureRuntimeLayout, sessionStatePath, setActiveSession, getActiveSessionId, loadSessionState, saveSessionState } from './src/storage.mjs';
import { makeCurrent, makeInitialState } from './src/protocol.mjs';
import { startWatcher } from './src/watcher.mjs';
import { logEvent } from './src/logger.mjs';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';

const argv = process.argv.slice(2);
const command = argv[0];
const cmdArgs = argv.slice(1);

// ── Main ──

async function main() {
  const config = loadConfig(cmdArgs, process.env);

  switch (command) {
    case 'start': await cmdStart(config); break;
    case 'resume': await cmdResume(config); break;
    case 'approve': await cmdApprove(config); break;
    case 'stop': await cmdStop(config); break;
    case 'watch': await cmdWatch(config); break;
    case 'quick': await cmdQuick(config); break;
    default: printUsage(); process.exit(1);
  }
}

async function cmdStart(config) {
  if (!config.goal) {
    console.error('ERROR: --goal is required');
    process.exit(1);
  }

  const cleaned = await ensureRuntimeLayout(config);
  if (cleaned.length > 0) console.log(`Cleaned ${cleaned.length} orphan .tmp files`);

  // Rotate events log
  try {
    const { rename } = await import('node:fs/promises');
    const archiveName = config.paths.eventsLog.replace('.ndjson', `.${Date.now()}.ndjson`);
    await rename(config.paths.eventsLog, archiveName);
  } catch { /* no previous log */ }

  const sessionId = `sess_${Date.now()}_${randomUUID().slice(0, 8)}`;
  const state = makeInitialState({
    session_id: sessionId,
    goal: { summary: config.goal, success_criteria: config.successCriteria ?? [], constraints: config.constraints ?? [] },
    config,
  });

  // Build codebase summary
  try {
    const { readdir, stat, readFile } = await import('node:fs/promises');
    const { join, relative } = await import('node:path');
    const root = config.paths.root;
    const skipDirs = new Set(['.orchestra', 'node_modules', '.git', '.claude', 'coverage']);
    async function listFiles(dir, depth = 0) {
      if (depth > 2) return [];
      const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
      const results = [];
      for (const e of entries) {
        if (skipDirs.has(e.name)) continue;
        const full = join(dir, e.name);
        const rel = relative(root, full);
        if (e.isDirectory()) { results.push(rel + '/'); results.push(...await listFiles(full, depth + 1)); }
        else if (e.name.endsWith('.mjs') || e.name.endsWith('.json') || e.name.endsWith('.md')) {
          const s = await stat(full).catch(() => null);
          results.push(`${rel} (${s ? Math.round(s.size / 1024) + 'KB' : '?'})`);
        }
      }
      return results;
    }
    const tree = await listFiles(root);
    const pkgRaw = await readFile(join(root, 'package.json'), 'utf8').catch(() => '{}');
    const pkg = JSON.parse(pkgRaw);
    state.codebase_summary = `Node.js ES modules project "${pkg.name || 'unknown'}". Files: ${tree.join(', ')}. Scripts: ${Object.entries(pkg.scripts || {}).map(([k, v]) => k + '=' + v).join(', ')}. Claude has full repo access.`;
  } catch { /* ignore */ }

  const current = makeCurrent({
    session_id: sessionId, turn_id: 1, target_actor: 'codex', kind: 'plan',
    input: { from: 'human', instruction: config.goal, acceptance_criteria: config.successCriteria ?? [], artifacts_expected: [], context_refs: [] },
    context: { goal: config.goal, constraints: config.constraints ?? [], rolling_summary: '', recent_turns: [] },
    limits: { timeout_ms: config.aiTimeoutMs, budget_remaining_usd: config.budgetUsd, remaining_turns: config.maxTurns },
  });

  state.counters.next_turn_id = 2;
  state.lifecycle = 'booting';
  await writeJsonAtomic(config.paths.currentFile, current);
  await saveSessionState(config, state);
  await setActiveSession(config, sessionId);

  logEvent(config, { level: 'info', source: 'system', event: 'session_created', data: { sessionId, goal: config.goal } });
  console.log(`Session ${sessionId} created. Starting watcher...`);

  setupSigint(config);
  const finalState = await startWatcher(config);
  console.log(`Session ended: ${finalState.stop?.reason ?? 'unknown'} (${finalState.counters?.completed_ai_turns ?? 0} AI turns)`);
}

async function cmdResume(config) {
  const sessionId = await getActiveSessionId(config);
  if (!sessionId) {
    console.error('ERROR: No active session. Run "start" first.');
    process.exit(1);
  }

  const state = await loadSessionState(config, sessionId);
  if (!state) {
    console.error(`ERROR: State not found for session ${sessionId}.`);
    process.exit(1);
  }
  if (state.lifecycle === 'stopped') {
    console.error('ERROR: Session is already stopped. Run "start" for a new session.');
    process.exit(1);
  }

  // Restore state.json for the watcher
  await writeJsonAtomic(config.paths.stateFile, state);

  console.log(`Resuming session ${sessionId} (lifecycle: ${state.lifecycle}, turns: ${state.counters?.completed_ai_turns ?? 0})`);
  setupSigint(config);
  const finalState = await startWatcher(config);
  console.log(`Session ended: ${finalState.stop?.reason ?? 'unknown'}`);
}

async function cmdApprove(config) {
  let decision = 'approve', instruction = '', target = 'codex', kind = 'plan';
  for (let i = 0; i < cmdArgs.length; i++) {
    switch (cmdArgs[i]) {
      case '--decision': decision = cmdArgs[++i]; break;
      case '--instruction': instruction = cmdArgs[++i]; break;
      case '--target': target = cmdArgs[++i]; break;
      case '--kind': kind = cmdArgs[++i]; break;
    }
  }
  await writeJsonAtomic(config.paths.approveFile, { decision, instruction, target, kind, timestamp: new Date().toISOString() });
  console.log(`Approval written: ${decision}${instruction ? ' — ' + instruction : ''}`);
}

async function cmdStop(config) {
  const sessionId = await getActiveSessionId(config);
  const state = sessionId ? await loadSessionState(config, sessionId) : await readJson(config.paths.stateFile);
  if (!state) { console.error('No active session.'); process.exit(1); }
  state.stop = { requested: true, reason: 'manual stop', code: 'human_stop' };
  state.timestamps.updated_at = new Date().toISOString();
  await saveSessionState(config, state);
  console.log(`Stop signal written for session ${state.session_id}`);
}

async function cmdWatch(config) {
  const logPath = config.paths.eventsLog;
  console.log(`Watching ${logPath} (Ctrl+C to stop)\n`);

  // Tail existing content
  try {
    const existing = await import('node:fs/promises').then(fs => fs.readFile(logPath, 'utf8')).catch(() => '');
    for (const line of existing.split('\n').slice(-20)) {
      if (line.trim()) printEvent(line);
    }
  } catch { /* no file yet */ }

  // Watch for new content
  const { watch } = await import('node:fs');
  let offset = 0;
  try {
    const { stat } = await import('node:fs/promises');
    offset = (await stat(logPath)).size;
  } catch { /* file doesn't exist yet */ }

  // Poll-based tail (reliable on Windows)
  setInterval(async () => {
    try {
      const { stat, open } = await import('node:fs/promises');
      const s = await stat(logPath);
      if (s.size <= offset) return;
      const fh = await open(logPath, 'r');
      const buf = Buffer.alloc(s.size - offset);
      await fh.read(buf, 0, buf.length, offset);
      await fh.close();
      offset = s.size;
      const text = buf.toString('utf8');
      for (const line of text.split('\n')) {
        if (line.trim()) printEvent(line);
      }
    } catch { /* ignore */ }
  }, 500);
}

async function cmdQuick(config) {
  if (!config.goal) {
    console.error('Usage: node orchestra.mjs quick --goal "fix the bug in X"');
    process.exit(1);
  }

  const { invokeCodex } = await import('./src/dispatcher.mjs');
  const { readFile, writeFile } = await import('node:fs/promises');
  const { join } = await import('node:path');
  const { performance } = await import('node:perf_hooks');
  const t0 = performance.now();

  console.log(`Quick mode: "${config.goal}"`);

  // Read key source files for context
  const root = config.paths.root;
  let context = '';
  try {
    const srcFiles = ['src/bookmarks.mjs', 'src/index.mjs'].map(f => join(root, f));
    for (const f of srcFiles) {
      try {
        const content = await readFile(f, 'utf8');
        if (content.length < 5000) context += `\n--- ${f} ---\n${content}\n`;
        else context += `\n--- ${f} (first 3000 chars) ---\n${content.slice(0, 3000)}\n`;
      } catch { /* skip */ }
    }
  } catch { /* ignore */ }

  const prompt = `You are a senior developer. Complete this task in one shot.

TASK: ${config.goal}
${config.successCriteria ? 'CRITERIA: ' + config.successCriteria.join('; ') : ''}
${config.constraints ? 'CONSTRAINTS: ' + config.constraints.join('; ') : ''}

CODEBASE:
${context.slice(0, 8000)}

Return a JSON object with file patches to apply:
{"patches": [{"file": "relative/path.mjs", "content": "full file content"}], "summary": "what you did", "tests_to_run": "node --test test/bookmarks.test.mjs"}
Return ONLY the JSON object.`;

  const result = await invokeCodex(prompt, config);
  const duration = Math.round(performance.now() - t0);

  if (!result.envelope && result.raw) {
    // Try to parse the raw response for patches
    const resp = JSON.parse(result.raw);
    const text = resp?.output?.[0]?.content?.[0]?.text;
    if (text) {
      try {
        const patch = JSON.parse(text);
        if (patch.patches && Array.isArray(patch.patches)) {
          for (const p of patch.patches) {
            const fullPath = join(root, p.file);
            await writeFile(fullPath, p.content);
            console.log(`  Patched: ${p.file}`);
          }
          console.log(`  Summary: ${patch.summary}`);
          if (patch.tests_to_run) {
            console.log(`  Run: ${patch.tests_to_run}`);
          }
          console.log(`  Done in ${duration}ms`);
          return;
        }
      } catch { /* not valid patch JSON */ }
    }
  }

  if (result.envelope) {
    console.log(`  Result: ${result.envelope.summary}`);
    console.log(`  Done in ${duration}ms`);
  } else {
    console.log(`  Failed: could not parse response (${result.raw?.length ?? 0} bytes)`);
    console.log(`  Done in ${duration}ms`);
  }
}

function printEvent(line) {
  try {
    const e = JSON.parse(line);
    const time = e.ts?.slice(11, 19) ?? '??:??:??';
    const src = (e.source ?? '???').toUpperCase().padEnd(10);
    const lvl = e.level === 'error' ? 'ERR' : e.level === 'warn' ? 'WRN' : '   ';
    const summary = e.data?.summary ?? e.data?.reason ?? e.data?.to ?? e.data?.error ?? e.event;
    console.log(`${time} ${lvl} [${src}] ${e.event}: ${summary}`);
  } catch {
    console.log(line);
  }
}

function setupSigint(config) {
  process.on('SIGINT', async () => {
    console.log('\nSIGINT — shutting down...');
    const state = await readJson(config.paths.stateFile);
    if (state && state.lifecycle !== 'stopped') {
      state.stop = { requested: true, reason: 'aborted_by_human', code: 'sigint' };
      state.lifecycle = 'stopped';
      state.timestamps.updated_at = new Date().toISOString();
      await saveSessionState(config, state);
    }
    process.exit(0);
  });
}

function printUsage() {
  console.log(`
Orchestra — AI Orchestration System

Usage:
  node orchestra.mjs start   --goal "..." [--success "a,b"] [--constraint "x,y"] [--budget 5] [--max-turns 40]
  node orchestra.mjs resume
  node orchestra.mjs approve --decision approve|revise|stop [--instruction "..."] [--target codex|claude]
  node orchestra.mjs stop
  node orchestra.mjs watch
`);
}

main().catch(err => { console.error('Fatal:', err.message); process.exit(1); });
