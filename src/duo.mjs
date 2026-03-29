// duo.mjs — Duo mode: Codex + Claude, both with full repo access.
// Codex via API (fast planning/review) or CLI (full execution).
// Claude executes in-IDE. Both agents symmetric.

import https from 'node:https';
import http from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve, join, relative } from 'node:path';
import { execSync, spawn } from 'node:child_process';
import { getToolDefinitions, executeToolCall } from './codex_tools.mjs';

// ── Codex API call with tool loop ──

function tryParseJson(s) { try { return JSON.parse(s); } catch { return null; } }

async function callCodex(prompt, config, options = {}) {
  const apiKey = config.codexApiKey || process.env.CODEX_API_KEY;
  if (!apiKey) throw new Error('CODEX_API_KEY required');

  const baseUrl = config.codexApiBase || 'https://api.openai.com';
  const url = new URL('/v1/responses', baseUrl);
  const isHttps = url.protocol === 'https:';
  const transport = isHttps ? https : http;
  const tools = options.tools !== false ? getToolDefinitions() : undefined;
  const maxToolCalls = config.codexMaxToolCalls ?? 8;
  let totalToolCalls = 0;

  function buildBody(input, prevId) {
    const payload = {
      model: config.codexModel || 'gpt-5.4-mini',
      input,
      text: { format: { type: options.json ? 'json_object' : 'text' } },
    };
    if (tools) payload.tools = tools;
    if (prevId) payload.previous_response_id = prevId;
    return JSON.stringify(payload);
  }

  function doRequest(bodyStr) {
    return new Promise(resolve => {
      const req = transport.request({
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: url.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'Content-Length': Buffer.byteLength(bodyStr),
        },
      }, res => {
        let data = '';
        res.on('data', c => data += c);
        res.on('end', () => resolve({ status: res.statusCode, body: data }));
      });
      req.on('error', e => resolve({ status: 0, body: e.message }));
      req.write(bodyStr);
      req.end();
    });
  }

  let result = await doRequest(buildBody(prompt, null));
  if (result.status !== 200) return { text: null, error: result.body, usage: null };

  // Tool loop
  while (true) {
    const resp = tryParseJson(result.body);
    if (!resp) return { text: null, error: 'Unparseable response', usage: null };

    const calls = (resp.output ?? []).filter(i => i.type === 'function_call');
    const msg = (resp.output ?? []).find(i => i.type === 'message');
    const text = msg?.content?.find(c => c.type === 'output_text')?.text;

    if (calls.length === 0 || !tools || totalToolCalls >= maxToolCalls) {
      return { text, error: text ? null : 'No text in response', usage: resp.usage, raw: resp };
    }

    // Execute tool calls
    const results = [];
    for (const fc of calls) {
      let output;
      if (totalToolCalls >= maxToolCalls) {
        output = 'Tool limit reached. Produce your final answer now.';
      } else {
        totalToolCalls++;
        const args = typeof fc.arguments === 'string' ? tryParseJson(fc.arguments) ?? {} : fc.arguments ?? {};
        try { output = await executeToolCall(fc.name, args, config); }
        catch (e) { output = `Error: ${e.message}`; }
      }
      results.push({ type: 'function_call_output', call_id: fc.call_id, output: String(output) });
    }

    // Force no-tools on final call if cap reached
    const followUp = totalToolCalls >= maxToolCalls
      ? JSON.stringify({ model: config.codexModel || 'gpt-5.4-mini', input: results, previous_response_id: resp.id, text: { format: { type: options.json ? 'json_object' : 'text' } } })
      : buildBody(results, resp.id);

    result = await doRequest(followUp);
    if (result.status !== 200) return { text: null, error: result.body, usage: null };
  }
}

// ── Context-aware planning ─��

async function planWithContext(goal, config) {
  const { retrieveContext, updateMemoryAfterTask } = await import('./context.mjs');
  const root = config.paths?.root || process.cwd();

  // Retrieve targeted context
  const ctx = await retrieveContext(root, goal);
  const filesSummary = ctx.files.map(f => `${f.file} (${f.lines}L): ${f.content.slice(0, 200)}`).join('\n');
  const constraintsSummary = ctx.constraints.join('; ');

  const prompt = formatPlanRequest(goal, `FILES:\n${filesSummary}\nCONSTRAINTS: ${constraintsSummary}`);
  const result = await callCodex(prompt, config);
  return { plan: parsePlan(result.text ?? ''), raw: result.text, context: ctx };
}

async function reviewWithContext(report, config) {
  const result = await callCodex(formatReviewRequest(report), config);
  return { review: parseReview(result.text ?? ''), raw: result.text };
}

async function completeTask(root, summary, filesChanged) {
  const { updateMemoryAfterTask } = await import('./context.mjs');
  return updateMemoryAfterTask(root, summary, filesChanged);
}

// ── Duo protocol formats ──

function formatPlanRequest(goal, context) {
  return `PLAN this task. You have read-only tools to inspect the codebase.

GOAL: ${goal}
${context ? `CONTEXT: ${context}` : ''}

Return compact format:
FIX/FEAT/REFACTOR: <one line>
FILES: <comma-separated paths>
DO: <what Claude should do, 1-3 lines max>
TEST: <what to verify>
DONT: <what NOT to do>
CLASS: trivial|medium|complex`;
}

function formatReviewRequest(report) {
  return `REVIEW this work. You have read-only tools to verify.

${report}

Reply:
VERDICT: approve|challenge|reject
REASON: <one line>
${'{'}FIX: <if challenge/reject, what to fix>${'}'}`;
}

function parsePlan(text) {
  const lines = text.split('\n').filter(l => l.trim());
  const plan = {};
  for (const line of lines) {
    const match = line.match(/^(FIX|FEAT|REFACTOR|FILES|DO|TEST|DONT|CLASS):\s*(.+)/i);
    if (match) plan[match[1].toLowerCase()] = match[2].trim();
  }
  // Fallback: if Codex returns prose, extract what we can
  if (!plan.do && text.length > 20) plan.do = text.slice(0, 200);
  if (!plan.files) plan.files = '';
  if (!plan.class) plan.class = 'medium';
  return plan;
}

function parseReview(text) {
  const lines = text.split('\n').filter(l => l.trim());
  const review = { verdict: 'approve', reason: '', fix: '' };
  for (const line of lines) {
    const match = line.match(/^(VERDICT|REASON|FIX):\s*(.+)/i);
    if (match) review[match[1].toLowerCase()] = match[2].trim();
  }
  // Fallback
  const lower = text.toLowerCase();
  if (lower.includes('challenge')) review.verdict = 'challenge';
  if (lower.includes('reject')) review.verdict = 'reject';
  return review;
}

function formatClaudeReport(summary, files, testCount) {
  return `DONE: ${summary}
CHANGED: ${files.join(', ')}
TESTS: ${testCount} pass
RISK: none`;
}

// ── Git rollback ──

function stashBefore(root) {
  try {
    execSync('git stash push -m "duo-rollback" --include-untracked', { cwd: root, stdio: 'pipe' });
    return true;
  } catch { return false; }
}

function stashPop(root) {
  try { execSync('git stash pop', { cwd: root, stdio: 'pipe' }); } catch { /* no stash */ }
}

function stashDrop(root) {
  try { execSync('git stash drop', { cwd: root, stdio: 'pipe' }); } catch { /* no stash */ }
}

// ── Codex CLI Executor ──
// Uses `codex exec --full-auto --json` for tasks that need full repo access.
// Codex can read, write, run commands — symmetric with Claude.

function invokeCodexCli(prompt, options = {}) {
  const cwd = options.cwd || process.cwd();
  const timeout = options.timeout || 300_000;

  return new Promise((resolve) => {
    const args = ['exec', '--full-auto', '--json'];
    if (options.model) args.push('-m', options.model);
    if (options.sandbox) args.push('-s', options.sandbox);
    else args.push('-s', 'workspace-write');

    const child = spawn('codex', args, {
      cwd,
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: process.platform === 'win32',
      timeout,
    });

    child.stdin.write(prompt);
    child.stdin.end();

    let stdout = '';
    let stderr = '';
    child.stdout.on('data', d => stdout += d);
    child.stderr.on('data', d => stderr += d);

    child.on('close', (code) => {
      // Parse JSONL output — extract agent messages
      const messages = [];
      let usage = null;
      for (const line of stdout.split('\n').filter(Boolean)) {
        try {
          const event = JSON.parse(line);
          if (event.type === 'item.completed' && event.item?.type === 'agent_message') {
            messages.push(event.item.text);
          }
          if (event.type === 'item.completed' && event.item?.type === 'command_execution') {
            messages.push(`[exec] ${event.item.command} → exit ${event.item.exit_code}`);
          }
          if (event.type === 'turn.completed' && event.usage) {
            usage = event.usage;
          }
        } catch { /* skip non-JSON */ }
      }

      resolve({
        success: code === 0,
        messages,
        summary: messages.filter(m => !m.startsWith('[exec]')).pop() || '',
        commands: messages.filter(m => m.startsWith('[exec]')),
        usage,
        exitCode: code,
        raw: stdout,
        stderr,
      });
    });

    child.on('error', (err) => {
      resolve({ success: false, messages: [], summary: err.message, commands: [], usage: null, exitCode: 1, raw: '', stderr: err.message });
    });
  });
}

// ── Symmetric Execution ──
// Either agent can execute. Choose based on task type.

async function executeWithBestAgent(task, config) {
  const taskClass = task.class || 'medium';

  // Trivial: Codex API one-shot (fastest)
  if (taskClass === 'trivial') {
    const result = await callCodex(`Execute this directly:\n${task.do}\nReturn what you did.`, config, { json: false });
    return { agent: 'codex_api', result: result.text, success: !!result.text };
  }

  // Medium/Complex with Codex CLI: full repo access, can write+test
  // Use when Claude is busy or for parallel execution
  if (task.useCodex) {
    const result = await invokeCodexCli(
      `${task.do}\n\nAcceptance criteria: ${task.test || 'tests pass'}\nFiles: ${task.files || 'as needed'}`,
      { cwd: config.paths?.root || process.cwd() }
    );
    return { agent: 'codex_cli', result: result.summary, success: result.success, commands: result.commands };
  }

  // Default: Claude executes in-IDE (current session)
  return { agent: 'claude_ide', result: null, success: null }; // caller handles execution
}

export {
  callCodex,
  formatPlanRequest,
  formatReviewRequest,
  parsePlan,
  parseReview,
  formatClaudeReport,
  stashBefore,
  stashPop,
  stashDrop,
  planWithContext,
  reviewWithContext,
  completeTask,
  invokeCodexCli,
  executeWithBestAgent,
};
