const VALID_TASK_KINDS = new Set(["bugfix", "refactor", "feature"]);
const VALID_PHASES = new Set(["smoke", "a", "b"]);
const VALID_DECISIONS = new Set([
  "kill_opaque_ir",
  "continue_as_tooling",
  "continue_as_narrow_ir",
]);

function isString(value) {
  return typeof value === "string";
}

function isNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function isArrayOfStrings(value) {
  return Array.isArray(value) && value.every(isString);
}

function requireField(errors, condition, message) {
  if (!condition) errors.push(message);
}

export function validateBenchmarkTask(task) {
  const errors = [];
  if (!task || typeof task !== "object" || Array.isArray(task)) {
    return { valid: false, errors: ["task must be an object"] };
  }

  requireField(errors, isString(task.id) && task.id.length > 0, "id must be a non-empty string");
  requireField(errors, isString(task.module) && task.module.length > 0, "module must be a non-empty string");
  requireField(errors, isString(task.symbol) && task.symbol.length > 0, "symbol must be a non-empty string");
  requireField(errors, VALID_TASK_KINDS.has(task.kind), "kind must be bugfix|refactor|feature");
  requireField(errors, isString(task.prompt) && task.prompt.length > 0, "prompt must be a non-empty string");
  requireField(errors, isArrayOfStrings(task.acceptance), "acceptance must be string[]");
  requireField(errors, isString(task.verify_command) && task.verify_command.length > 0, "verify_command must be a non-empty string");

  if (task.chain_group !== undefined) {
    requireField(errors, isString(task.chain_group) && task.chain_group.length > 0, "chain_group must be a non-empty string when present");
  }
  if (task.chain_index !== undefined) {
    requireField(errors, isNumber(task.chain_index) && task.chain_index >= 1, "chain_index must be a positive number when present");
  }
  if (task.allowed_paths !== undefined) {
    requireField(errors, isArrayOfStrings(task.allowed_paths), "allowed_paths must be string[] when present");
  }

  return { valid: errors.length === 0, errors };
}

export function validateTaskCollection(tasks) {
  const errors = [];
  if (!Array.isArray(tasks)) {
    return { valid: false, errors: ["tasks must be an array"] };
  }

  const ids = new Set();
  for (const task of tasks) {
    const result = validateBenchmarkTask(task);
    if (!result.valid) {
      errors.push(`${task?.id ?? "(unknown)"}: ${result.errors.join(", ")}`);
    }
    if (ids.has(task.id)) {
      errors.push(`duplicate task id: ${task.id}`);
    }
    ids.add(task.id);
  }

  return { valid: errors.length === 0, errors };
}

export function normalizeTaskPayload(payload) {
  if (Array.isArray(payload)) return payload;
  if (payload && Array.isArray(payload.tasks)) return payload.tasks;
  throw new Error("Task file must contain an array or { tasks: [] }");
}

export function validateEditResponse(edit) {
  const errors = [];
  if (!edit || typeof edit !== "object" || Array.isArray(edit)) {
    return { valid: false, errors: ["edit response must be an object"] };
  }

  requireField(errors, Array.isArray(edit.changes) && edit.changes.length > 0, "changes must be a non-empty array");
  if (Array.isArray(edit.changes)) {
    for (const [index, change] of edit.changes.entries()) {
      requireField(errors, change && typeof change === "object" && !Array.isArray(change), `changes[${index}] must be an object`);
      requireField(errors, isString(change?.path) && change.path.length > 0, `changes[${index}].path must be a non-empty string`);
      requireField(errors, isString(change?.content), `changes[${index}].content must be a string`);
    }
  }
  if (edit.notes !== undefined) {
    requireField(errors, isString(edit.notes), "notes must be a string when present");
  }

  return { valid: errors.length === 0, errors };
}

export function validateRunResult(result) {
  const errors = [];
  if (!result || typeof result !== "object" || Array.isArray(result)) {
    return { valid: false, errors: ["run result must be an object"] };
  }

  requireField(errors, isString(result.task_id), "task_id must be a string");
  requireField(errors, isString(result.variant), "variant must be a string");
  requireField(errors, isString(result.model), "model must be a string");
  requireField(errors, typeof result.pass === "boolean", "pass must be a boolean");
  requireField(errors, isNumber(result.iterations), "iterations must be a number");
  requireField(errors, isNumber(result.tokens_in), "tokens_in must be a number");
  requireField(errors, isNumber(result.tokens_out), "tokens_out must be a number");
  requireField(errors, isNumber(result.runtime_ms), "runtime_ms must be a number");
  if (result.failure_class !== null && result.failure_class !== undefined) {
    requireField(errors, isString(result.failure_class), "failure_class must be a string or null");
  }
  if (result.chain_index !== null && result.chain_index !== undefined) {
    requireField(errors, isNumber(result.chain_index), "chain_index must be a number or null");
  }

  return { valid: errors.length === 0, errors };
}

export function assertPhase(phase) {
  if (!VALID_PHASES.has(phase)) {
    throw new Error(`Unknown phase "${phase}"`);
  }
}

export function assertDecision(decision) {
  if (!VALID_DECISIONS.has(decision)) {
    throw new Error(`Unknown decision "${decision}"`);
  }
}

export function createEmptyRunResult(overrides = {}) {
  return {
    task_id: "",
    variant: "",
    model: "",
    pass: false,
    iterations: 1,
    tokens_in: 0,
    tokens_out: 0,
    runtime_ms: 0,
    failure_class: null,
    chain_index: null,
    ...overrides,
  };
}

export { VALID_TASK_KINDS, VALID_PHASES, VALID_DECISIONS };
