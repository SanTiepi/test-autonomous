// result_processor.mjs — Processes AI results: status tracking, archival, next-turn generation.
// Extracted from watcher.mjs to isolate result handling from the polling loop.

import { writeJsonAtomic } from './storage.mjs';
import { computeFingerprint } from './safety.mjs';
import { archiveTurn, loadRecentTurns, rebuildRollingSummary } from './history.mjs';
import { makeCurrent } from './protocol.mjs';
import { logEvent } from './logger.mjs';

function now() {
  return new Date().toISOString();
}

/**
 * Determine next target/kind/instruction from AI result envelope.
 * Pure function — no side effects.
 */
function resolveNextTarget(actor, status, envelope) {
  if (!envelope) {
    return {
      stopped: false,
      target: 'human',
      kind: 'checkpoint',
      instruction: `AI (${actor}) returned unparseable response. Review raw output and decide next step.`,
      criteria: [],
      artifacts: [],
    };
  }

  if (envelope.next?.target === 'stop' || status === 'completed' && envelope.next?.target === 'stop') {
    return { stopped: true };
  }

  if (envelope.next?.target === 'human') {
    return {
      stopped: false,
      target: 'human',
      kind: envelope.next?.kind ?? 'checkpoint',
      instruction: envelope.next?.instruction ?? 'AI requested human review.',
      criteria: envelope.next?.acceptance_criteria ?? [],
      artifacts: envelope.next?.artifacts_expected ?? [],
    };
  }

  return {
    stopped: false,
    target: envelope.next?.target ?? (actor === 'codex' ? 'claude' : 'codex'),
    kind: envelope.next?.kind ?? 'build',
    instruction: envelope.next?.instruction ?? '',
    criteria: envelope.next?.acceptance_criteria ?? [],
    artifacts: envelope.next?.artifacts_expected ?? [],
  };
}

/**
 * Process the result from an AI invocation.
 * Updates state counters, loop guard, archives the turn, builds next current.json.
 */
export async function processAiResult(actor, result, current, state, config) {
  const { envelope, raw, duration } = result;
  const turnId = current.turn_id;
  const sessionId = state.session_id;

  // Determine status
  let status, summary;
  if (!envelope) {
    status = 'error';
    summary = `AI returned unparseable response (${raw?.length ?? 0} bytes)`;
    state.counters.no_progress_streak++;
    logEvent(config, {
      level: 'warn', source: 'watcher', event: 'unparseable_response',
      data: { actor, turnId, rawLength: raw?.length ?? 0 },
    });
  } else {
    status = envelope.status;
    summary = envelope.summary;

    // Update progress tracking
    if (envelope.made_progress) {
      state.counters.no_progress_streak = 0;
    } else {
      state.counters.no_progress_streak++;
    }

    // Update loop guard — fingerprint includes task context
    const fp = computeFingerprint(envelope, current.input);
    if (fp === state.loop_guard.last_fingerprint) {
      state.loop_guard.repeat_count++;
    } else {
      state.loop_guard.last_fingerprint = fp;
      state.loop_guard.repeat_count = 1;
    }

    // Update budget from usage data
    if (result.usage) {
      // Model-specific rates (USD per 1K tokens) — input / output
      // Source: OpenAI pricing as of 2026-03 (per MTok → /1000 for per-KTok)
      const rates = {
        'gpt-5.4':      { input: 0.0025, output: 0.015 },
        'gpt-5.4-mini': { input: 0.00075, output: 0.0045 },
        'gpt-5.4-nano': { input: 0.0002, output: 0.00125 },
        '_default':     { input: 0.00075, output: 0.0045 },
      };
      const r = rates[config.codexModel] ?? rates._default;
      const inputCost = (result.usage.prompt_tokens ?? 0) / 1000 * r.input;
      const outputCost = (result.usage.completion_tokens ?? 0) / 1000 * r.output;
      state.budget.spent_usd += inputCost + outputCost;
    }

    // Log meta_feedback if present (LLM-to-LLM optimization)
    if (envelope.meta_feedback) {
      logEvent(config, {
        level: 'info', source: 'watcher', event: 'meta_feedback',
        data: { from: actor, ...envelope.meta_feedback },
      });
    }
  }

  // Archive the turn
  const archiveData = { envelope, raw, duration, current };
  let archivePath;
  try {
    archivePath = await archiveTurn(sessionId, turnId, actor, status, archiveData, config);
  } catch (err) {
    logEvent(config, {
      level: 'error', source: 'watcher', event: 'archive_failed',
      data: { actor, turnId, error: err.message },
    });
    archivePath = null;
  }

  // Update state counters
  state.counters.completed_turns++;
  state.counters.completed_ai_turns++;
  state.last_result = { turn_id: turnId, actor, status, archive_path: archivePath, summary };

  // Rebuild rolling summary periodically (every 20 turns)
  if (state.counters.completed_ai_turns % 20 === 0) {
    try {
      state.rolling_summary.text = await rebuildRollingSummary(sessionId, config);
      state.rolling_summary.rebuilt_at = now();
      state.rolling_summary.source_turn_id = turnId;
    } catch (err) {
      logEvent(config, {
        level: 'error', source: 'watcher', event: 'summary_rebuild_failed',
        data: { error: err.message },
      });
    }
  } else if (envelope?.summary) {
    // Append to rolling summary
    const append = `T${turnId}[${actor}]: ${envelope.summary.slice(0, 80)}`;
    const sep = state.rolling_summary.text ? '; ' : '';
    state.rolling_summary.text = (state.rolling_summary.text + sep + append).slice(0, 500);
    state.rolling_summary.source_turn_id = turnId;
  }

  // Clear active run
  state.active_run = { actor: null, pid: null, turn_id: null, started_at: null, timeout_at: null, prompt_hash: null };

  // Determine next actor
  const next = resolveNextTarget(actor, status, envelope);

  if (next.stopped) {
    state.stop = { requested: true, reason: 'goal achieved', code: 'success' };
    await writeJsonAtomic(config.paths.stateFile, state);
    return { nextLifecycle: 'stopped', state };
  }

  // Build next current.json
  let recentTurns;
  try {
    recentTurns = await loadRecentTurns(sessionId, 2, config);
  } catch (err) {
    logEvent(config, {
      level: 'error', source: 'watcher', event: 'load_recent_for_next_failed',
      data: { actor, turnId, error: err.message },
    });
    recentTurns = [];
  }
  const formattedRecent = recentTurns.map(t => ({
    turn_id: t.turn_id,
    actor: t.actor,
    status: t.status,
    summary: t.data?.envelope?.summary ?? t.data?.summary ?? '',
  }));

  const nextTurnId = state.counters.next_turn_id++;
  const nextCurrent = makeCurrent({
    session_id: sessionId,
    turn_id: nextTurnId,
    target_actor: next.target,
    kind: next.kind,
    input: {
      from: actor,
      instruction: next.instruction,
      acceptance_criteria: next.criteria,
      artifacts_expected: next.artifacts,
      context_refs: [],
    },
    context: {
      goal: state.goal?.summary ?? '',
      constraints: state.goal?.constraints ?? [],
      rolling_summary: state.rolling_summary.text,
      recent_turns: formattedRecent,
    },
    limits: {
      timeout_ms: config.aiTimeoutMs,
      budget_remaining_usd: state.budget.limit_usd - state.budget.spent_usd,
      remaining_turns: state.limits.max_turns - state.counters.completed_ai_turns,
    },
  });

  await writeJsonAtomic(config.paths.currentFile, nextCurrent);
  await writeJsonAtomic(config.paths.stateFile, state);

  // Determine next lifecycle
  let nextLifecycle;
  if (next.target === 'human') {
    state.checkpoint = { required: true, reason: next.instruction, requested_at: now(), approved_at: null };
    await writeJsonAtomic(config.paths.stateFile, state);
    nextLifecycle = 'wait_human';
  } else {
    nextLifecycle = 'idle'; // will dispatch on next tick
  }

  return { nextLifecycle, state };
}
