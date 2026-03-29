// dispatcher.mjs — Invokes Claude CLI and Codex API, maps responses to AiEnvelope.
// ZERO external dependencies. Uses node:child_process and node:http/https.

import { spawn } from 'node:child_process';
import http from 'node:http';
import https from 'node:https';
import { validateAiEnvelope } from './protocol.mjs';
import { logEvent } from './logger.mjs';
import { getToolDefinitions, executeToolCall } from './codex_tools.mjs';

// ── Error classification ──

const NON_RETRYABLE_CODES = new Set([
  'insufficient_quota', 'invalid_api_key', 'invalid_authentication',
  'model_not_found', 'billing_not_active', 'project_not_found',
  'unsupported_model',
]);

/**
 * Classify an API error into a normalized structure.
 * @param {number} statusCode - HTTP status code (0 for network errors)
 * @param {string} body - Raw response body
 * @param {string|null} networkError - Network error message if any
 * @returns {{provider: string, http_status: number, error_code: string|null, retryable: boolean, reason: string}}
 */
export function classifyError(statusCode, body, networkError = null) {
  const base = { provider: 'openai', http_status: statusCode, error_code: null };

  // Network-level failures
  if (networkError) {
    const isAbort = networkError.includes('aborted') || networkError.includes('timeout');
    return { ...base, http_status: 0, error_code: 'network_error', retryable: !isAbort, reason: networkError };
  }

  // Parse error body for OpenAI error structure
  let errorCode = null;
  let errorMessage = '';
  try {
    const parsed = JSON.parse(body);
    errorCode = parsed?.error?.code ?? parsed?.error?.type ?? null;
    errorMessage = parsed?.error?.message ?? '';
  } catch { /* not JSON */ }

  base.error_code = errorCode;

  // Non-retryable: quota, auth, model issues
  if (NON_RETRYABLE_CODES.has(errorCode)) {
    return { ...base, retryable: false, reason: errorMessage || `${errorCode}` };
  }

  // 401/403 — auth issues, never retry
  if (statusCode === 401 || statusCode === 403) {
    return { ...base, retryable: false, reason: errorMessage || 'authentication failed' };
  }

  // 429 — rate limit, retry with backoff
  if (statusCode === 429) {
    return { ...base, retryable: true, reason: errorMessage || 'rate limited' };
  }

  // 5xx — server errors, retry with backoff
  if (statusCode >= 500) {
    return { ...base, retryable: true, reason: errorMessage || `server error ${statusCode}` };
  }

  // 4xx other — generally not retryable
  if (statusCode >= 400) {
    return { ...base, retryable: false, reason: errorMessage || `client error ${statusCode}` };
  }

  // Unexpected
  return { ...base, retryable: false, reason: `unexpected status ${statusCode}` };
}

// ── helpers ──

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

/**
 * Try to parse a string as JSON. Returns parsed object or null.
 */
function tryParseJson(str) {
  try {
    return JSON.parse(str);
  } catch {
    return null;
  }
}

/**
 * Try to extract the first top-level {...} JSON block from a string using
 * brace-counting (handles nested objects).
 */
function extractJsonBlock(str) {
  const start = str.indexOf('{');
  if (start === -1) return null;
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < str.length; i++) {
    const ch = str[i];
    if (escape) { escape = false; continue; }
    if (ch === '\\' && inString) { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) {
        const candidate = str.slice(start, i + 1);
        return tryParseJson(candidate);
      }
    }
  }
  return null;
}

/**
 * Given raw text from an AI response, attempt to parse it as an AiEnvelope.
 * Returns { envelope, parseError }.
 */
function parseEnvelope(text) {
  // Try direct JSON parse
  let obj = tryParseJson(text);
  if (obj) {
    const v = validateAiEnvelope(obj);
    if (v.valid) return { envelope: obj, parseError: null };
  }
  // Try extracting a JSON block from mixed text
  obj = extractJsonBlock(text);
  if (obj) {
    const v = validateAiEnvelope(obj);
    if (v.valid) return { envelope: obj, parseError: null };
  }
  // Fallback: synthesize envelope from natural text (for Claude which may not return strict JSON)
  if (text && text.length > 10) {
    const envelope = synthesizeEnvelope(text);
    if (envelope) return { envelope, parseError: null };
  }
  return { envelope: null, parseError: 'Could not extract valid AiEnvelope from response' };
}

/**
 * Synthesize an AiEnvelope from natural language text.
 * Used when Claude returns prose instead of JSON.
 */
function synthesizeEnvelope(text) {
  const lower = text.toLowerCase();

  // Detect status
  let status = 'completed';
  if (lower.includes('blocked') || lower.includes('cannot') || lower.includes('unable to')) status = 'blocked';
  if (lower.includes('error') && lower.includes('fail')) status = 'error';

  // Extract summary — first sentence or first 200 chars
  const summary = text.split(/[.\n]/)[0]?.trim().slice(0, 200) || text.slice(0, 200);

  // Extract mentioned file paths
  const filePatterns = text.match(/(?:src|test|bench|eval)\/[\w/.+-]+\.m?js/g) || [];
  const artifacts = [...new Set(filePatterns)];

  // Detect progress
  const madeProgress = !lower.includes('no changes') && !lower.includes('nothing to do') &&
    (lower.includes('added') || lower.includes('created') || lower.includes('modified') ||
     lower.includes('fixed') || lower.includes('implemented') || lower.includes('updated') ||
     artifacts.length > 0);

  // Detect what should happen next
  let nextTarget = 'codex';
  if (lower.includes('all tests pass') || lower.includes('all criteria met') || lower.includes('done')) {
    // Suggest codex review, not stop — let codex decide
    nextTarget = 'codex';
  }
  if (status === 'blocked') nextTarget = 'human';

  return {
    status,
    summary,
    artifacts,
    made_progress: madeProgress,
    fingerprint_basis: summary.slice(0, 80),
    next: {
      target: nextTarget,
      kind: nextTarget === 'codex' ? 'review' : 'build',
      instruction: `Review: ${summary.slice(0, 100)}`,
      acceptance_criteria: [],
      artifacts_expected: [],
    },
  };
}

/**
 * Invoke Claude CLI and return a structured result. Never throws.
 *
 * @param {string} prompt
 * @param {object} config
 * @param {string} [kind='build'] - Task kind: 'build' uses claudeMaxTurnsBuild, others use claudeMaxTurnsReview
 * @returns {Promise<{envelope: object|null, raw: string, exitCode: number, duration: number}>}
 */
export async function invokeClaude(prompt, config, kind = 'build') {
  const start = Date.now();
  try {
    const result = await new Promise((resolve) => {
      const cmd = config.claudeCmd || 'claude';
      // Pass prompt via stdin instead of CLI arg to avoid shell escaping issues
      const maxTurns = kind === 'build' ? (config.claudeMaxTurnsBuild ?? 10) : (config.claudeMaxTurnsReview ?? 3);
      const args = Array.isArray(config.claudeArgs)
        ? config.claudeArgs
        : ['-p', '--output-format', 'json', '--max-turns', String(maxTurns)];

      // Build clean env: remove CLAUDECODE to avoid nested-session detection
      const cleanEnv = { ...process.env, ...(config.spawnEnv || {}) };
      delete cleanEnv.CLAUDECODE;

      // Only use shell on Windows when cmd looks like a .cmd/.bat shim (not for 'node' or absolute .mjs paths)
      const needsShell = process.platform === 'win32' && !cmd.endsWith('.mjs') && cmd !== 'node' && cmd !== 'echo';

      const child = spawn(cmd, args, {
        stdio: ['pipe', 'pipe', 'pipe'],  // stdin open for prompt
        env: cleanEnv,
        shell: needsShell,
      });

      // Write prompt to stdin and close it
      child.stdin.write(prompt);
      child.stdin.end();

      let stdout = '';
      let stderr = '';
      child.stdout.on('data', (d) => { stdout += d.toString(); });
      child.stderr.on('data', (d) => { stderr += d.toString(); });

      const timer = setTimeout(() => {
        child.kill('SIGTERM');
        // Give a moment, then force kill
        setTimeout(() => { try { child.kill('SIGKILL'); } catch {} }, 500);
      }, config.aiTimeoutMs || 300_000);

      child.on('close', (code) => {
        clearTimeout(timer);
        resolve({ stdout, stderr, exitCode: code ?? 1 });
      });

      child.on('error', (err) => {
        clearTimeout(timer);
        resolve({ stdout, stderr: stderr + '\n' + err.message, exitCode: 1 });
      });
    });

    const duration = Date.now() - start;
    const raw = result.stdout;

    // If non-zero exit, no envelope
    if (result.exitCode !== 0) {
      logEvent(config, { level: 'warn', source: 'dispatcher', event: 'claude_fail', data: { exitCode: result.exitCode, stderr: result.stderr, duration } });
      return { envelope: null, raw: raw || result.stderr, exitCode: result.exitCode, duration };
    }

    // Parse Claude CLI JSON output: {"type":"result","result":"<json string>"}
    // The stdout may be clean JSON or may have prefix junk (e.g. "Update available!\n{...}")
    let textContent = raw;
    let cliObj = tryParseJson(raw);
    if (!cliObj) {
      // Try extracting the first JSON block from polluted stdout
      cliObj = extractJsonBlock(raw);
    }
    // Handle Claude CLI error responses (subtype: error_during_execution)
    if (cliObj && cliObj.subtype && cliObj.subtype !== 'success') {
      logEvent(config, { level: 'warn', source: 'dispatcher', event: 'claude_cli_error', data: { subtype: cliObj.subtype, duration } });
      // Still try to extract result text — Claude may have produced partial output
      if (typeof cliObj.result === 'string') {
        textContent = cliObj.result;
      } else {
        return { envelope: null, raw, exitCode: result.exitCode, duration };
      }
    } else if (cliObj && typeof cliObj.result === 'string') {
      textContent = cliObj.result;
    } else if (cliObj && typeof cliObj.result === 'object' && cliObj.result !== null) {
      textContent = JSON.stringify(cliObj.result);
    }

    const { envelope, parseError } = parseEnvelope(textContent);

    if (envelope) {
      logEvent(config, { level: 'info', source: 'dispatcher', event: 'claude_ok', data: { summary: envelope.summary, duration } });
    } else {
      logEvent(config, { level: 'warn', source: 'dispatcher', event: 'claude_parse_fail', data: { parseError, rawLength: raw.length, duration } });
    }

    return { envelope, raw, exitCode: result.exitCode, duration };
  } catch (err) {
    const duration = Date.now() - start;
    logEvent(config, { level: 'error', source: 'dispatcher', event: 'claude_error', data: { error: err.message, duration } });
    return { envelope: null, raw: err.message, exitCode: 1, duration };
  }
}

/**
 * Invoke Codex API (OpenAI-compatible /v1/responses) and return a structured result. Never throws.
 * Classifies API errors and retries with backoff for recoverable ones (429, 5xx).
 * Non-recoverable errors (quota, auth) return immediately with apiError field.
 *
 * @param {string} prompt
 * @param {object} config
 * @returns {Promise<{envelope: object|null, raw: string, usage: object|null, duration: number, apiError: object|null}>}
 */
export async function invokeCodex(prompt, config) {
  const start = Date.now();
  try {
    const baseUrl = config.codexApiBase || 'https://api.openai.com';
    const url = new URL('/v1/responses', baseUrl);
    const isHttps = url.protocol === 'https:';
    const transport = isHttps ? https : http;

    const toolMode = config.codexToolMode ?? 'off';
    const maxToolCalls = config.codexMaxToolCalls ?? 5;
    const tools = toolMode === 'read_only' ? getToolDefinitions() : undefined;

    /**
     * Build request body. On first call, input is the prompt string.
     * On follow-up calls after tool use, input is an array of tool result items
     * and previous_response_id links to the prior response.
     */
    function buildBody(input, previousResponseId) {
      const payload = {
        model: config.codexModel || 'gpt-5.4-mini',
        input,
        text: { format: { type: 'json_object' } },
      };
      if (tools) payload.tools = tools;
      if (previousResponseId) payload.previous_response_id = previousResponseId;
      return JSON.stringify(payload);
    }

    // Single HTTP request helper
    function doRequest(bodyStr) {
      const reqOptions = {
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: url.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.codexApiKey || ''}`,
          'Content-Length': Buffer.byteLength(bodyStr),
        },
      };
      return new Promise((resolve) => {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), config.aiTimeoutMs || 300_000);
        const req = transport.request({ ...reqOptions, signal: controller.signal }, (res) => {
          let data = '';
          res.on('data', (chunk) => { data += chunk.toString(); });
          res.on('end', () => { clearTimeout(timer); resolve({ statusCode: res.statusCode, body: data, error: null }); });
        });
        req.on('error', (err) => { clearTimeout(timer); resolve({ statusCode: 0, body: '', error: err.message }); });
        req.write(bodyStr);
        req.end();
      });
    }

    // Initial request
    let body = buildBody(prompt, null);
    let result = await doRequest(body);
    let duration = Date.now() - start;

    // Network / abort error
    if (result.error) {
      const apiError = classifyError(0, '', result.error);
      logEvent(config, { level: 'error', source: 'dispatcher', event: 'codex_error', data: { ...apiError, duration } });
      return { envelope: null, raw: result.error, usage: null, duration, apiError };
    }

    // HTTP error — classify and potentially retry
    if (result.statusCode < 200 || result.statusCode >= 300) {
      const apiError = classifyError(result.statusCode, result.body);
      logEvent(config, { level: 'warn', source: 'dispatcher', event: 'codex_http_error', data: { ...apiError, duration } });

      if (apiError.retryable) {
        // Retry with backoff for 429/5xx (max 2 retries: 2s, 4s)
        for (let attempt = 1; attempt <= 2; attempt++) {
          const backoffMs = attempt * 2000;
          logEvent(config, { level: 'info', source: 'dispatcher', event: 'codex_retry', data: { attempt, backoffMs, error_code: apiError.error_code } });
          await sleep(backoffMs);
          result = await doRequest(body);
          duration = Date.now() - start;
          if (!result.error && result.statusCode >= 200 && result.statusCode < 300) break;
        }
        // Still failing after retries
        if (result.error || result.statusCode < 200 || result.statusCode >= 300) {
          return { envelope: null, raw: result.body || result.error, usage: null, duration, apiError };
        }
      } else {
        // Non-retryable (quota, auth, etc.) — return immediately, no retry
        return { envelope: null, raw: result.body, usage: null, duration, apiError };
      }
    }

    // ── Tool loop ──
    // Process the response, execute any tool calls, and loop until we get final text.
    let totalToolCalls = 0;
    let latestRaw = result.body;

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const respObj = tryParseJson(latestRaw);
      if (!respObj) {
        logEvent(config, { level: 'warn', source: 'dispatcher', event: 'codex_parse_fail', data: { rawLength: latestRaw.length, duration: Date.now() - start } });
        return { envelope: null, raw: latestRaw, usage: null, duration: Date.now() - start };
      }

      // Check for function_call items in output
      const functionCalls = (respObj.output ?? []).filter(item => item.type === 'function_call');

      // If no tool calls or tools disabled, extract final text
      if (!tools || functionCalls.length === 0) {
        return extractFinalResult(respObj, latestRaw, start, config);
      }

      // If tool cap reached but response is still function_calls (no text), force a final call without tools
      if (totalToolCalls >= maxToolCalls) {
        // Check if there's any text in this response
        const hasText = (respObj.output ?? []).some(i => i.type === 'message' && i.content?.some(c => c.type === 'output_text'));
        if (hasText) {
          return extractFinalResult(respObj, latestRaw, start, config);
        }
        // Force a completion without tools by sending cap-reached results + no tools in next request
        const capResults = functionCalls.map(fc => ({
          type: 'function_call_output', call_id: fc.call_id,
          output: 'Tool call limit reached. Now produce your final JSON response.',
        }));
        logEvent(config, { level: 'info', source: 'dispatcher', event: 'codex_tool_cap_force', data: { totalToolCalls } });
        const forceBody = JSON.stringify({
          model: config.codexModel || 'gpt-5.4-mini',
          input: capResults,
          previous_response_id: respObj.id,
          text: { format: { type: 'json_object' } },
          // No tools — force text output
        });
        const forceResult = await doRequest(forceBody);
        if (!forceResult.error && forceResult.statusCode >= 200 && forceResult.statusCode < 300) {
          latestRaw = forceResult.body;
          const forceResp = tryParseJson(latestRaw);
          if (forceResp) return extractFinalResult(forceResp, latestRaw, start, config);
        }
        return extractFinalResult(respObj, latestRaw, start, config);
      }

      // Execute tool calls and build result items
      // IMPORTANT: must return a result for EVERY function_call, even if cap is reached
      const toolResults = [];
      for (const fc of functionCalls) {
        let output;
        if (totalToolCalls >= maxToolCalls) {
          output = 'Tool call limit reached. Proceed with available information.';
        } else {
          totalToolCalls++;
          const toolArgs = typeof fc.arguments === 'string' ? tryParseJson(fc.arguments) : (fc.arguments ?? {});
          try {
            output = await executeToolCall(fc.name, toolArgs || {}, config);
          } catch (err) {
            output = `Error: ${err.message}`;
          }
          logEvent(config, { level: 'info', source: 'dispatcher', event: 'codex_tool_call', data: { tool: fc.name, call_id: fc.call_id, totalToolCalls } });
        }
        toolResults.push({
          type: 'function_call_output',
          call_id: fc.call_id,
          output: typeof output === 'string' ? output : JSON.stringify(output),
        });
      }

      // Send tool results back
      const followUpBody = buildBody(toolResults, respObj.id);
      const followUpResult = await doRequest(followUpBody);

      if (followUpResult.error || followUpResult.statusCode < 200 || followUpResult.statusCode >= 300) {
        duration = Date.now() - start;
        const apiError = followUpResult.error
          ? classifyError(0, '', followUpResult.error)
          : classifyError(followUpResult.statusCode, followUpResult.body);
        logEvent(config, { level: 'warn', source: 'dispatcher', event: 'codex_tool_loop_error', data: { ...apiError, duration } });
        return { envelope: null, raw: followUpResult.body || followUpResult.error, usage: null, duration, apiError };
      }

      latestRaw = followUpResult.body;
    }
  } catch (err) {
    const duration = Date.now() - start;
    logEvent(config, { level: 'error', source: 'dispatcher', event: 'codex_error', data: { error: err.message, duration } });
    return { envelope: null, raw: err.message, usage: null, duration, apiError: null };
  }
}

/**
 * Extract the final text result from a Codex API response object.
 * Shared between tool-loop exit and non-tool mode.
 */
function extractFinalResult(respObj, raw, startTime, config) {
  const duration = Date.now() - startTime;

  // Extract usage
  const usage = respObj.usage
    ? {
        prompt_tokens: respObj.usage.input_tokens ?? respObj.usage.prompt_tokens ?? 0,
        completion_tokens: respObj.usage.output_tokens ?? respObj.usage.completion_tokens ?? 0,
        total_tokens: respObj.usage.total_tokens ?? 0,
      }
    : null;

  // Extract text from /v1/responses format
  let textContent = '';
  if (Array.isArray(respObj.output)) {
    for (const item of respObj.output) {
      if (item.type === 'message' && Array.isArray(item.content)) {
        for (const c of item.content) {
          if (c.type === 'output_text' && typeof c.text === 'string') {
            textContent = c.text;
            break;
          }
        }
        if (textContent) break;
      }
    }
  }

  if (!textContent) {
    logEvent(config, { level: 'warn', source: 'dispatcher', event: 'codex_no_text', data: { duration } });
    return { envelope: null, raw, usage, duration, apiError: null };
  }

  const { envelope, parseError } = parseEnvelope(textContent);

  if (envelope) {
    logEvent(config, { level: 'info', source: 'dispatcher', event: 'codex_ok', data: { summary: envelope.summary, duration } });
  } else {
    logEvent(config, { level: 'warn', source: 'dispatcher', event: 'codex_envelope_fail', data: { parseError, duration } });
  }

  return { envelope, raw, usage, duration, apiError: null };
}
