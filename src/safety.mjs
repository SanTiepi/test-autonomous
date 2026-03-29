import { createHash } from 'node:crypto';
import { makeCheckpointDecision } from './protocol.mjs';

/**
 * Evaluate all guards in priority order. First match wins.
 * @param {object} state  - Orchestra state object
 * @param {object} config - Config object
 * @returns {{action: "continue"|"checkpoint"|"stop", reason: string|null}}
 */
export function evaluateGuards(state, config) {
  // 1. Explicit stop requested
  if (state.stop?.requested === true) {
    return { action: 'stop', reason: 'stop requested' };
  }

  // 2. Max turns
  if (state.counters?.completed_ai_turns >= state.limits?.max_turns) {
    return { action: 'stop', reason: 'max turns reached' };
  }

  // 3. Budget exhausted
  if (state.budget?.spent_usd >= state.budget?.limit_usd) {
    return { action: 'stop', reason: 'budget exhausted' };
  }

  // 4. Deadline passed
  if (state.limits?.deadline_at && new Date(state.limits.deadline_at) < new Date()) {
    return { action: 'stop', reason: 'deadline passed' };
  }

  // 5. No progress streak
  if (state.counters?.no_progress_streak >= state.limits?.max_no_progress) {
    return { action: 'stop', reason: 'no progress' };
  }

  // 6. Loop detected
  if (state.loop_guard?.repeat_count >= 3) {
    return { action: 'stop', reason: 'loop detected' };
  }

  // 7. Checkpoint decision
  const cp = makeCheckpointDecision(state);
  if (cp.needed) {
    return { action: 'checkpoint', reason: cp.reason };
  }

  // 8. All clear
  return { action: 'continue', reason: null };
}

/**
 * SHA-256 hash of task identity + result artifacts.
 * Uses fingerprint_basis (which should encode task+expected artifacts per prompt contract)
 * plus actual artifacts returned, to detect true repetition vs superficial similarity.
 * @param {object} envelope - AI response envelope
 * @param {object} [task] - Optional task context (instruction + expected artifacts)
 * @returns {string} hex digest
 */
export function computeFingerprint(envelope, task) {
  const parts = [
    envelope.fingerprint_basis ?? '',
    ...(envelope.artifacts ?? []).sort(),
  ];
  if (task) {
    parts.push(task.instruction ?? '');
    parts.push(...(task.artifacts_expected ?? []).sort());
  }
  return createHash('sha256').update(parts.join('|')).digest('hex');
}

/**
 * Called at boot. Detects stale "running" states when no process is alive.
 * @param {object} state          - Current state
 * @param {boolean} isProcessAlive - Whether the AI process is actually running
 * @returns {{state: object, recovered: boolean, reason: string|null}}
 */
export function recoverRuntimeState(state, isProcessAlive) {
  const runningStates = ['running_codex', 'running_claude'];

  if (runningStates.includes(state.lifecycle) && !isProcessAlive) {
    const updated = {
      ...state,
      lifecycle: 'wait_human',
      checkpoint: {
        ...(state.checkpoint ?? {}),
        required: true,
        reason: 'recovery: stale running state without live process',
      },
    };
    return {
      state: updated,
      recovered: true,
      reason: 'recovery: stale running state without live process',
    };
  }

  return { state, recovered: false, reason: null };
}
