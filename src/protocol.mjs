// protocol.mjs — Pure validators and factories. NO disk I/O.

const VALID_ACTORS = ['codex', 'claude', 'human'];
const VALID_NEXT_TARGETS = ['codex', 'claude', 'human', 'stop'];
const VALID_KINDS = ['plan', 'build', 'review', 'checkpoint', 'stop'];
const VALID_LIFECYCLES = ['booting', 'idle', 'running_codex', 'running_claude', 'wait_human', 'stopped'];
const VALID_STATUSES = ['completed', 'blocked', 'error'];

// ── helpers ──

function isString(v) { return typeof v === 'string'; }
function isNumber(v) { return typeof v === 'number' && !Number.isNaN(v); }
function isBoolean(v) { return typeof v === 'boolean'; }
function isObject(v) { return v !== null && typeof v === 'object' && !Array.isArray(v); }
function isArrayOfStrings(v) { return Array.isArray(v) && v.every(isString); }

function require(errors, cond, msg) {
  if (!cond) errors.push(msg);
}

// ── validators ──

export function validateCurrent(obj) {
  const errors = [];
  if (!isObject(obj)) return { valid: false, errors: ['root must be an object'] };

  require(errors, obj.schema_version === 1, 'schema_version must be 1');
  require(errors, isString(obj.session_id) && obj.session_id.length > 0, 'session_id is required string');
  require(errors, isNumber(obj.turn_id), 'turn_id must be a number');
  require(errors, VALID_ACTORS.includes(obj.target_actor), `target_actor must be one of ${VALID_ACTORS.join(', ')}`);
  require(errors, VALID_KINDS.includes(obj.kind), `kind must be one of ${VALID_KINDS.join(', ')}`);

  if (obj.input !== undefined) {
    if (!isObject(obj.input)) {
      errors.push('input must be an object');
    } else {
      require(errors, isString(obj.input.from), 'input.from must be a string');
      require(errors, isString(obj.input.instruction), 'input.instruction must be a string');
      if (obj.input.acceptance_criteria !== undefined)
        require(errors, isArrayOfStrings(obj.input.acceptance_criteria), 'input.acceptance_criteria must be string[]');
      if (obj.input.artifacts_expected !== undefined)
        require(errors, isArrayOfStrings(obj.input.artifacts_expected), 'input.artifacts_expected must be string[]');
      if (obj.input.context_refs !== undefined)
        require(errors, isArrayOfStrings(obj.input.context_refs), 'input.context_refs must be string[]');
    }
  }

  if (obj.context !== undefined) {
    if (!isObject(obj.context)) {
      errors.push('context must be an object');
    } else {
      if (obj.context.goal !== undefined) require(errors, isString(obj.context.goal), 'context.goal must be a string');
      if (obj.context.constraints !== undefined) require(errors, isArrayOfStrings(obj.context.constraints), 'context.constraints must be string[]');
      if (obj.context.rolling_summary !== undefined) require(errors, isString(obj.context.rolling_summary), 'context.rolling_summary must be a string');
      if (obj.context.recent_turns !== undefined) {
        require(errors, Array.isArray(obj.context.recent_turns), 'context.recent_turns must be an array');
      }
    }
  }

  if (obj.limits !== undefined) {
    if (!isObject(obj.limits)) {
      errors.push('limits must be an object');
    } else {
      if (obj.limits.timeout_ms !== undefined) require(errors, isNumber(obj.limits.timeout_ms), 'limits.timeout_ms must be a number');
      if (obj.limits.budget_remaining_usd !== undefined) require(errors, isNumber(obj.limits.budget_remaining_usd), 'limits.budget_remaining_usd must be a number');
      if (obj.limits.remaining_turns !== undefined) require(errors, isNumber(obj.limits.remaining_turns), 'limits.remaining_turns must be a number');
    }
  }

  if (obj.timestamps !== undefined) {
    if (!isObject(obj.timestamps)) {
      errors.push('timestamps must be an object');
    } else {
      require(errors, isString(obj.timestamps.created_at), 'timestamps.created_at must be a string');
    }
  }

  return { valid: errors.length === 0, errors };
}

export function validateState(obj) {
  const errors = [];
  if (!isObject(obj)) return { valid: false, errors: ['root must be an object'] };

  require(errors, obj.schema_version === 1, 'schema_version must be 1');
  require(errors, isString(obj.session_id) && obj.session_id.length > 0, 'session_id is required string');
  require(errors, VALID_LIFECYCLES.includes(obj.lifecycle), `lifecycle must be one of ${VALID_LIFECYCLES.join(', ')}`);

  if (obj.goal !== undefined) {
    require(errors, isObject(obj.goal), 'goal must be an object');
    if (isObject(obj.goal)) {
      require(errors, isString(obj.goal.summary), 'goal.summary must be a string');
      if (obj.goal.success_criteria !== undefined)
        require(errors, isArrayOfStrings(obj.goal.success_criteria), 'goal.success_criteria must be string[]');
      if (obj.goal.constraints !== undefined)
        require(errors, isArrayOfStrings(obj.goal.constraints), 'goal.constraints must be string[]');
    }
  }

  if (obj.budget !== undefined) {
    require(errors, isObject(obj.budget), 'budget must be an object');
    if (isObject(obj.budget)) {
      require(errors, isNumber(obj.budget.limit_usd), 'budget.limit_usd must be a number');
      require(errors, isNumber(obj.budget.spent_usd), 'budget.spent_usd must be a number');
    }
  }

  if (obj.counters !== undefined) {
    require(errors, isObject(obj.counters), 'counters must be an object');
    if (isObject(obj.counters)) {
      require(errors, isNumber(obj.counters.next_turn_id), 'counters.next_turn_id must be a number');
      require(errors, isNumber(obj.counters.completed_turns), 'counters.completed_turns must be a number');
      require(errors, isNumber(obj.counters.completed_ai_turns), 'counters.completed_ai_turns must be a number');
      require(errors, isNumber(obj.counters.no_progress_streak), 'counters.no_progress_streak must be a number');
    }
  }

  if (obj.timestamps !== undefined) {
    require(errors, isObject(obj.timestamps), 'timestamps must be an object');
    if (isObject(obj.timestamps)) {
      require(errors, isString(obj.timestamps.created_at), 'timestamps.created_at must be a string');
      require(errors, isString(obj.timestamps.updated_at), 'timestamps.updated_at must be a string');
    }
  }

  return { valid: errors.length === 0, errors };
}

export function validateAiEnvelope(obj) {
  const errors = [];
  if (!isObject(obj)) return { valid: false, errors: ['root must be an object'] };

  require(errors, VALID_STATUSES.includes(obj.status), `status must be one of ${VALID_STATUSES.join(', ')}`);
  require(errors, isString(obj.summary), 'summary is required string');
  if (obj.details !== undefined) require(errors, isString(obj.details), 'details must be a string');
  require(errors, isArrayOfStrings(obj.artifacts ?? []), 'artifacts must be string[]');
  require(errors, isBoolean(obj.made_progress), 'made_progress must be a boolean');
  require(errors, isString(obj.fingerprint_basis), 'fingerprint_basis is required string');

  if (obj.next !== undefined) {
    require(errors, isObject(obj.next), 'next must be an object');
    if (isObject(obj.next)) {
      require(errors, VALID_NEXT_TARGETS.includes(obj.next.target), `next.target must be one of ${VALID_NEXT_TARGETS.join(', ')}`);
      require(errors, VALID_KINDS.includes(obj.next.kind), `next.kind must be one of ${VALID_KINDS.join(', ')}`);
      require(errors, isString(obj.next.instruction), 'next.instruction must be a string');
    }
  }

  if (obj.meta_feedback !== undefined && obj.meta_feedback !== null) {
    require(errors, isObject(obj.meta_feedback), 'meta_feedback must be an object');
    if (isObject(obj.meta_feedback) && Object.keys(obj.meta_feedback).length > 0) {
      // Only validate prompt_quality if meta_feedback has content (empty {} is valid = "nothing to say")
      if (obj.meta_feedback.prompt_quality !== undefined) {
        require(errors, isNumber(obj.meta_feedback.prompt_quality) && obj.meta_feedback.prompt_quality >= 1 && obj.meta_feedback.prompt_quality <= 5,
          'meta_feedback.prompt_quality must be 1-5');
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

// ── factories ──

export function makeCurrent({ session_id, turn_id, target_actor, kind, input, context, limits }) {
  const now = new Date().toISOString();
  const current = {
    schema_version: 1,
    session_id,
    turn_id,
    target_actor,
    kind,
    input: input ?? {
      from: 'orchestrator',
      instruction: '',
      acceptance_criteria: [],
      artifacts_expected: [],
      context_refs: [],
    },
    context: context ?? {
      goal: '',
      constraints: [],
      rolling_summary: '',
      recent_turns: [],
    },
    limits: limits ?? {
      timeout_ms: 300_000,
      budget_remaining_usd: 5.0,
      remaining_turns: 40,
    },
    timestamps: {
      created_at: now,
      dispatched_at: null,
    },
  };
  return current;
}

export function makeInitialState({ session_id, goal, config }) {
  const now = new Date().toISOString();
  return {
    schema_version: 1,
    session_id,
    lifecycle: 'booting',
    goal: {
      summary: goal?.summary ?? '',
      success_criteria: goal?.success_criteria ?? [],
      constraints: goal?.constraints ?? [],
    },
    paths: {
      current_file: config.paths.currentFile,
      state_file: config.paths.stateFile,
      history_dir: config.paths.historyDir,
      logs_dir: config.paths.logsDir,
      approve_file: config.paths.approveFile,
    },
    budget: {
      limit_usd: config.budgetUsd,
      spent_usd: 0,
    },
    limits: {
      max_turns: config.maxTurns,
      max_no_progress: config.maxNoProgress,
      checkpoint_every: config.checkpointEvery,
      timeout_ms: config.aiTimeoutMs,
      deadline_at: null,
    },
    counters: {
      next_turn_id: 1,
      completed_turns: 0,
      completed_ai_turns: 0,
      no_progress_streak: 0,
    },
    rolling_summary: {
      text: '',
      rebuilt_at: now,
      source_turn_id: 0,
    },
    loop_guard: {
      last_fingerprint: null,
      repeat_count: 0,
    },
    active_run: {
      actor: null,
      pid: null,
      turn_id: null,
      started_at: null,
      timeout_at: null,
      prompt_hash: null,
    },
    last_result: {
      turn_id: null,
      actor: null,
      status: null,
      archive_path: null,
      summary: null,
    },
    checkpoint: {
      required: false,
      reason: null,
      requested_at: null,
      approved_at: null,
    },
    stop: {
      requested: false,
      reason: null,
      code: null,
    },
    timestamps: {
      created_at: now,
      updated_at: now,
      last_transition_at: now,
    },
  };
}

export function makeCheckpointDecision(state) {
  if (!state || !state.counters || !state.limits) {
    return { needed: false, reason: null };
  }

  const { completed_ai_turns } = state.counters;
  const { checkpoint_every } = state.limits;

  if (checkpoint_every > 0 && completed_ai_turns > 0 && completed_ai_turns % checkpoint_every === 0) {
    return { needed: true, reason: `Completed ${completed_ai_turns} AI turns (checkpoint every ${checkpoint_every})` };
  }

  return { needed: false, reason: null };
}
