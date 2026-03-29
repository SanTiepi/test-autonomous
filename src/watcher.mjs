// watcher.mjs — State machine, polling loop, orchestration.
// 5 states: idle, running_codex, running_claude, wait_human, stopped

import { readJson, writeJsonAtomic, removeIfExists } from './storage.mjs';
import { evaluateGuards, recoverRuntimeState } from './safety.mjs';
import { invokeClaude, invokeCodex } from './dispatcher.mjs';
import { buildClaudePrompt, buildCodexPrompt } from './prompt_builder.mjs';
import { loadRecentTurns } from './history.mjs';
import { makeCurrent } from './protocol.mjs';
import { logEvent } from './logger.mjs';
import { processAiResult } from './result_processor.mjs';
import { resolve, dirname } from 'node:path';

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function now() {
  return new Date().toISOString();
}

function sessionStatePath(config, sessionId) {
  return resolve(dirname(config.paths.stateFile), `state_${sessionId}.json`);
}

async function persistState(state, config) {
  await writeJsonAtomic(config.paths.stateFile, state);
  if (state.session_id) {
    await writeJsonAtomic(sessionStatePath(config, state.session_id), state);
  }
}

// Dispatch configuration per actor — eliminates codex/claude ternaries
const ACTOR_DISPATCH = {
  codex: {
    invoke: invokeCodex,
    buildPrompt: buildCodexPrompt,
    lifecycle: 'running_codex',
    recentCount: 2,
    extraArgs: () => [],
  },
  claude: {
    invoke: invokeClaude,
    buildPrompt: buildClaudePrompt,
    lifecycle: 'running_claude',
    recentCount: 1,
    extraArgs: (current) => [current.kind],
  },
};

/**
 * Transition the state lifecycle and persist.
 */
async function transition(state, newLifecycle, config) {
  state.lifecycle = newLifecycle;
  state.timestamps.updated_at = now();
  state.timestamps.last_transition_at = now();
  await persistState(state, config);
  logEvent(config, { level: 'info', source: 'watcher', event: 'transition', data: { to: newLifecycle } });
  return state;
}

/**
 * Invoke an AI actor with auto-retry on parse failure.
 * Returns the final result (envelope may be null if both attempts fail).
 */
async function invokeWithRetry(actor, target, prompt, current, config) {
  let result;
  try {
    result = await actor.invoke(prompt, config, ...actor.extraArgs(current));
  } catch (err) {
    logEvent(config, { level: 'error', source: 'watcher', event: 'dispatch_invoke_error', data: { actor: target, error: err.message } });
    return { envelope: null, raw: err.message, duration: 0 };
  }

  // Auto-retry once on parse fail — but ONLY if the error is not a non-recoverable API error
  // (quota/auth/model errors already got proper handling in dispatcher, no point re-prompting)
  if (!result.envelope && result.raw && !result.apiError) {
    logEvent(config, { level: 'warn', source: 'watcher', event: 'parse_retry', data: { actor: target, rawLen: result.raw.length } });
    const retryPrompt = `IMPORTANT: Your previous response was not valid JSON matching the required AiEnvelope schema. Output ONLY a single JSON object with these required fields: status, summary, artifacts, made_progress, fingerprint_basis, next.\n\n${prompt}`;
    try {
      result = await actor.invoke(retryPrompt, config, ...actor.extraArgs(current));
    } catch (err) {
      logEvent(config, { level: 'error', source: 'watcher', event: 'dispatch_retry_error', data: { actor: target, error: err.message } });
      return { envelope: null, raw: err.message, duration: 0 };
    }
  }

  return result;
}

/**
 * Dispatch the appropriate AI based on current.json target_actor.
 */
async function dispatchAi(current, state, config) {
  const target = current.target_actor;
  const actor = ACTOR_DISPATCH[target];

  if (!actor) {
    logEvent(config, { level: 'warn', source: 'watcher', event: 'unknown_target', data: { target } });
    return 'wait_human';
  }

  // Load recent turns for context
  let recentTurns;
  try {
    recentTurns = await loadRecentTurns(state.session_id, actor.recentCount, config);
  } catch (err) {
    logEvent(config, { level: 'error', source: 'watcher', event: 'load_recent_failed', data: { actor: target, error: err.message } });
    recentTurns = [];
  }

  const formattedRecent = recentTurns.map(t => ({
    id: t.turn_id,
    actor: t.actor,
    status: t.status,
    summary: t.data?.envelope?.summary ?? '',
  }));

  // Build prompt
  let prompt;
  try {
    prompt = actor.buildPrompt({ current, state, recentTurns: formattedRecent });
  } catch (err) {
    logEvent(config, { level: 'error', source: 'watcher', event: 'prompt_build_failed', data: { actor: target, error: err.message } });
    return 'wait_human';
  }

  await transition(state, actor.lifecycle, config);
  state.active_run = { actor: target, pid: null, turn_id: current.turn_id, started_at: now(), timeout_at: null, prompt_hash: null };
  try {
    await persistState(state, config);
  } catch (err) {
    logEvent(config, { level: 'error', source: 'watcher', event: 'state_persist_failed', data: { phase: 'active_run', actor: target, error: err.message } });
  }

  const result = await invokeWithRetry(actor, target, prompt, current, config);

  // Process result
  try {
    const { nextLifecycle } = await processAiResult(target, result, current, state, config);
    return nextLifecycle;
  } catch (err) {
    logEvent(config, { level: 'error', source: 'watcher', event: 'result_processing_failed', data: { actor: target, turnId: current.turn_id, error: err.message } });
    return 'wait_human';
  }
}

/**
 * Check if a human approval file exists and process it.
 */
async function checkApproval(state, config) {
  const approval = await readJson(config.paths.approveFile);
  if (!approval) return null;

  await removeIfExists(config.paths.approveFile);

  logEvent(config, { level: 'info', source: 'watcher', event: 'approval_received', data: approval });

  if (approval.decision === 'stop') {
    state.stop = { requested: true, reason: approval.reason ?? 'human requested stop', code: 'human_stop' };
    return 'stopped';
  }

  // For both 'approve' and 'revise': rewrite current.json to retarget an AI.
  // Without this, a simple 'approve' leaves current.json targeting 'human',
  // causing an infinite idle → wait_human loop.
  {
    const nextTurnId = state.counters.next_turn_id++;
    const instruction = (approval.decision === 'revise' && approval.instruction)
      ? approval.instruction
      : (await readJson(config.paths.currentFile))?.input?.instruction ?? 'Continue from last result.';
    const nextCurrent = makeCurrent({
      session_id: state.session_id,
      turn_id: nextTurnId,
      target_actor: approval.target ?? 'codex',
      kind: approval.kind ?? 'plan',
      input: {
        from: 'human',
        instruction,
        acceptance_criteria: approval.acceptance_criteria ?? [],
        artifacts_expected: approval.artifacts_expected ?? [],
        context_refs: [],
      },
      context: {
        goal: state.goal?.summary ?? '',
        constraints: state.goal?.constraints ?? [],
        rolling_summary: state.rolling_summary.text,
        recent_turns: [],
      },
      limits: {
        timeout_ms: config.aiTimeoutMs,
        budget_remaining_usd: state.budget.limit_usd - state.budget.spent_usd,
        remaining_turns: state.limits.max_turns - state.counters.completed_ai_turns,
      },
    });
    await writeJsonAtomic(config.paths.currentFile, nextCurrent);
  }

  // Clear checkpoint
  state.checkpoint = { required: false, reason: null, requested_at: null, approved_at: now() };
  return 'idle';
}

/**
 * Main watcher loop. Polls every config.pollIntervalMs.
 * Returns when lifecycle reaches 'stopped'.
 */
export async function startWatcher(config, { onTick } = {}) {
  const _startMs = Date.now();
  let state = await readJson(config.paths.stateFile);
  if (!state) {
    logEvent(config, { level: 'error', source: 'watcher', event: 'no_state_file', data: { path: config.paths.stateFile } });
    throw new Error('No state.json found — run orchestra.mjs start first');
  }

  // Boot recovery
  const recovery = recoverRuntimeState(state, false);
  if (recovery.recovered) {
    state = recovery.state;
    await persistState(state, config);
    logEvent(config, { level: 'warn', source: 'watcher', event: 'recovery', data: { reason: recovery.reason } });
  }

  // Transition from booting to idle
  if (state.lifecycle === 'booting') {
    state = await transition(state, 'idle', config);
  }

  logEvent(config, { level: 'info', source: 'watcher', event: 'started', data: { session: state.session_id, lifecycle: state.lifecycle } });

  // Main loop
  while (state.lifecycle !== 'stopped') {
    // Callback for testing
    if (onTick) onTick(state);

    if (state.lifecycle === 'idle') {
      // Check guards
      const guard = evaluateGuards(state, config);

      if (guard.action === 'stop') {
        state.stop = { requested: true, reason: guard.reason, code: 'guard' };
        state = await transition(state, 'stopped', config);
        break;
      }

      if (guard.action === 'checkpoint') {
        state.checkpoint = { required: true, reason: guard.reason, requested_at: now(), approved_at: null };
        state = await transition(state, 'wait_human', config);
        // Write approve request for human to see
        await writeJsonAtomic(config.paths.approveFile + '.request', {
          type: 'checkpoint',
          reason: guard.reason,
          state_summary: {
            turns: state.counters.completed_ai_turns,
            budget_spent: state.budget.spent_usd,
            last_summary: state.last_result?.summary,
          },
        });
        continue;
      }

      // Read current.json and dispatch
      const current = await readJson(config.paths.currentFile);
      if (!current) {
        await sleep(config.pollIntervalMs);
        continue;
      }

      const nextLifecycle = await dispatchAi(current, state, config);
      state = await transition(state, nextLifecycle, config);

    } else if (state.lifecycle === 'wait_human') {
      // Poll for approval file
      const nextLifecycle = await checkApproval(state, config);
      if (nextLifecycle) {
        state = await transition(state, nextLifecycle, config);
      } else {
        await sleep(config.pollIntervalMs);
      }

    } else {
      // running_codex or running_claude — shouldn't happen in normal flow
      // because dispatch is synchronous, but handle recovery
      logEvent(config, { level: 'warn', source: 'watcher', event: 'unexpected_state', data: { lifecycle: state.lifecycle } });
      const recovery = recoverRuntimeState(state, false);
      state = recovery.state;
      state = await transition(state, state.lifecycle, config);
    }
  }

  logEvent(config, { level: 'info', source: 'watcher', event: 'stopped', data: {
    reason: state.stop?.reason,
    turns: state.counters?.completed_ai_turns,
    duration_ms: Date.now() - _startMs,
    budget_spent_usd: state.budget?.spent_usd,
    budget_limit_usd: state.budget?.limit_usd,
  } });
  return state;
}
