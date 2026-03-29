#!/usr/bin/env node
// eval/run_lean.mjs — Lean evaluation: 6 tickets × 2 conditions (orchestra vs codex_direct)
// Usage: CODEX_API_KEY=... node eval/run_lean.mjs

import { readFile, readdir, writeFile, mkdir, copyFile, cp } from 'node:fs/promises';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { performance } from 'node:perf_hooks';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const TICKETS_DIR = join(__dirname, 'tickets');

// 6 strategic tickets (1 per category)
const LEAN_TICKETS = [
  'feat-duplicate-detection.json',   // feature
  'bug-tag-filter-case.json',         // bugfix
  'refactor-extract-validation.json', // refactor
  'review-import-response.json',      // review-correction
  'resume-add-updated-at.json',       // resume-after-pause
  'feat-pagination.json',             // multi-file feature
];

const CONDITIONS = ['orchestra', 'codex_direct'];

async function loadTicket(name) {
  return JSON.parse(await readFile(join(TICKETS_DIR, name), 'utf8'));
}

// Run a command and capture output
function exec(cmd, args, options = {}) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: process.platform === 'win32',
      env: { ...process.env, ...(options.env || {}) },
      cwd: options.cwd || ROOT,
      timeout: options.timeout || 300_000,
    });
    let stdout = '', stderr = '';
    child.stdout.on('data', d => stdout += d);
    child.stderr.on('data', d => stderr += d);
    if (options.stdin) { child.stdin.write(options.stdin); child.stdin.end(); }
    child.on('close', code => resolve({ code, stdout, stderr }));
    child.on('error', err => resolve({ code: 1, stdout, stderr: stderr + '\n' + err.message }));
  });
}

// Run tests and check if they pass
async function runTests() {
  const r = await exec('node', ['--test', 'test/bookmarks.test.mjs'], { timeout: 30000 });
  const pass = r.code === 0;
  const match = r.stderr.match(/pass (\d+)/);
  return { pass, count: match ? parseInt(match[1]) : 0, output: r.stderr.slice(-500) };
}

// Orchestra adapter: uses the full watcher system
async function runOrchestra(ticket) {
  const t0 = performance.now();
  const apiKey = process.env.CODEX_API_KEY;
  if (!apiKey) return { success: false, error: 'CODEX_API_KEY not set' };

  // Run orchestra start with the ticket as goal
  const goal = `${ticket.brief}. Acceptance criteria: ${ticket.acceptance_criteria.join('; ')}`;
  const r = await exec('node', [
    'orchestra.mjs', 'start',
    '--goal', goal,
    '--success', ticket.acceptance_criteria.join(','),
    '--constraint', 'Only modify src/bookmarks.mjs and test/bookmarks.test.mjs,Keep scope narrow',
    '--budget', '0.5',
    '--max-turns', '4',
  ], { env: { CODEX_API_KEY: apiKey }, timeout: 300_000 });

  const duration = performance.now() - t0;
  const tests = await runTests();
  return {
    success: tests.pass,
    tests_passed: tests.pass,
    time_ms: Math.round(duration),
    human_interventions: 0,
    regressions: [],
    error: tests.pass ? null : `Tests: ${tests.output.slice(-200)}`,
  };
}

// Codex direct adapter: single API call, apply result
async function runCodexDirect(ticket) {
  const t0 = performance.now();
  const apiKey = process.env.CODEX_API_KEY;
  if (!apiKey) return { success: false, error: 'CODEX_API_KEY not set' };

  const https = await import('node:https');
  const http = await import('node:http');

  // Read current source files for context
  const bookmarksSrc = await readFile(join(ROOT, 'src/bookmarks.mjs'), 'utf8');
  const bookmarksTest = await readFile(join(ROOT, 'test/bookmarks.test.mjs'), 'utf8');

  const prompt = `You are a senior developer. Complete this ticket:

TICKET: ${ticket.brief}
ACCEPTANCE CRITERIA: ${ticket.acceptance_criteria.join('\n')}

CURRENT src/bookmarks.mjs:
\`\`\`javascript
${bookmarksSrc.slice(0, 6000)}
\`\`\`

CURRENT test/bookmarks.test.mjs (first 3000 chars):
\`\`\`javascript
${bookmarksTest.slice(0, 3000)}
\`\`\`

Return a JSON object with exactly two fields:
{"bookmarks_patch": "the complete new content of src/bookmarks.mjs", "test_patch": "the complete new content of test/bookmarks.test.mjs"}
Return ONLY the JSON object, no explanation.`;

  const body = JSON.stringify({
    model: process.env.CODEX_MODEL || 'gpt-5.4-mini',
    input: prompt,
    text: { format: { type: 'json_object' } },
  });

  const result = await new Promise(resolve => {
    const req = https.default.request({
      hostname: 'api.openai.com', path: '/v1/responses', method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}`, 'Content-Length': Buffer.byteLength(body) },
    }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', e => resolve({ status: 0, body: e.message }));
    req.write(body); req.end();
  });

  const duration = performance.now() - t0;

  if (result.status !== 200) {
    return { success: false, time_ms: Math.round(duration), error: `API ${result.status}: ${result.body.slice(0, 200)}` };
  }

  // Parse response
  try {
    const resp = JSON.parse(result.body);
    const text = resp.output?.[0]?.content?.[0]?.text;
    if (!text) throw new Error('No text in response');
    const patch = JSON.parse(text);

    // Apply patches (backup first)
    const srcPath = join(ROOT, 'src/bookmarks.mjs');
    const testPath = join(ROOT, 'test/bookmarks.test.mjs');
    const srcBackup = await readFile(srcPath, 'utf8');
    const testBackup = await readFile(testPath, 'utf8');

    if (patch.bookmarks_patch) await writeFile(srcPath, patch.bookmarks_patch);
    if (patch.test_patch) await writeFile(testPath, patch.test_patch);

    const tests = await runTests();

    // Restore backups regardless
    await writeFile(srcPath, srcBackup);
    await writeFile(testPath, testBackup);

    return {
      success: tests.pass,
      tests_passed: tests.pass,
      time_ms: Math.round(duration),
      human_interventions: 0,
      regressions: [],
      error: tests.pass ? null : 'Tests failed after applying patch',
    };
  } catch (err) {
    return { success: false, time_ms: Math.round(duration), error: err.message };
  }
}

// --- Main ---

async function main() {
  console.log('=== PROJ-01 Lean Evaluation ===');
  console.log(`Tickets: ${LEAN_TICKETS.length}, Conditions: ${CONDITIONS.join(', ')}\n`);

  const results = [];
  const outputDir = join(ROOT, '.orchestra', 'eval', `lean_${Date.now()}`);
  await mkdir(outputDir, { recursive: true });

  for (const ticketFile of LEAN_TICKETS) {
    const ticket = await loadTicket(ticketFile);
    console.log(`\n--- Ticket: ${ticket.id} (${ticket.category}) ---`);

    for (const condition of CONDITIONS) {
      process.stdout.write(`  ${condition}: `);
      let outcome;

      // Backup files before each run
      const srcBackup = await readFile(join(ROOT, 'src/bookmarks.mjs'), 'utf8');
      const testBackup = await readFile(join(ROOT, 'test/bookmarks.test.mjs'), 'utf8');

      try {
        if (condition === 'orchestra') {
          outcome = await runOrchestra(ticket);
        } else {
          outcome = await runCodexDirect(ticket);
        }
      } catch (err) {
        outcome = { success: false, error: err.message, time_ms: 0 };
      }

      // Restore files after each run
      await writeFile(join(ROOT, 'src/bookmarks.mjs'), srcBackup);
      await writeFile(join(ROOT, 'test/bookmarks.test.mjs'), testBackup);

      const status = outcome.success ? 'PASS' : 'FAIL';
      console.log(`${status} (${outcome.time_ms}ms)${outcome.error ? ' — ' + outcome.error?.slice(0, 80) : ''}`);

      results.push({
        ticket_id: ticket.id,
        category: ticket.category,
        condition,
        ...outcome,
      });
    }
  }

  // Score
  console.log('\n=== RESULTS ===\n');
  for (const cond of CONDITIONS) {
    const condResults = results.filter(r => r.condition === cond);
    const passed = condResults.filter(r => r.success).length;
    const total = condResults.length;
    const avgTime = Math.round(condResults.reduce((s, r) => s + (r.time_ms || 0), 0) / total);
    console.log(`${cond.padEnd(20)} ${passed}/${total} pass  avg ${avgTime}ms`);
  }

  // Verdict
  const orchResults = results.filter(r => r.condition === 'orchestra');
  const codexResults = results.filter(r => r.condition === 'codex_direct');
  const orchPass = orchResults.filter(r => r.success).length;
  const codexPass = codexResults.filter(r => r.success).length;
  const orchAvg = Math.round(orchResults.reduce((s, r) => s + (r.time_ms || 0), 0) / orchResults.length);
  const codexAvg = Math.round(codexResults.reduce((s, r) => s + (r.time_ms || 0), 0) / codexResults.length);

  console.log('\n=== VERDICT ===\n');
  const successDelta = orchPass - codexPass;
  const timeDelta = codexAvg > 0 ? ((codexAvg - orchAvg) / codexAvg * 100).toFixed(0) : 0;

  let verdict;
  if (successDelta >= 1 || orchPass >= codexPass && orchAvg < codexAvg * 0.75) {
    verdict = 'differentiated';
    console.log(`DIFFERENTIATED: Orchestra wins (+${successDelta} tickets or ${timeDelta}% faster)`);
  } else if (orchPass >= codexPass) {
    verdict = 'useful_but_not_unique';
    console.log(`USEFUL BUT NOT UNIQUE: Similar success, marginal gains`);
  } else {
    verdict = 'not_worth_it_yet';
    console.log(`NOT WORTH IT YET: Codex direct wins on ${codexPass - orchPass} more tickets`);
  }

  const summary = { verdict, orchestra: { pass: orchPass, total: orchResults.length, avg_ms: orchAvg }, codex_direct: { pass: codexPass, total: codexResults.length, avg_ms: codexAvg }, results };
  await writeFile(join(outputDir, 'results.json'), JSON.stringify(summary, null, 2));
  console.log(`\nResults saved to ${outputDir}/results.json`);
}

main().catch(err => { console.error('Fatal:', err.message); process.exit(1); });
