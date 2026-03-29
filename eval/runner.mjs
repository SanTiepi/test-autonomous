// eval/runner.mjs — Execute evaluation tickets against conditions
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';

const VALID_CONDITIONS = ['orchestra', 'claude_direct', 'codex_direct'];
const REQUIRED_FIELDS = ['id', 'brief', 'acceptance_criteria', 'oracle_test', 'budget_max', 'timebox_max'];

// --- Ticket loading ---

export async function loadTicket(ticketPath) {
  const raw = await readFile(ticketPath, 'utf-8');
  const ticket = JSON.parse(raw);
  for (const field of REQUIRED_FIELDS) {
    if (!(field in ticket)) {
      throw new Error(`Ticket missing required field: ${field}`);
    }
  }
  return ticket;
}

export async function loadAllTickets(ticketsDir) {
  const files = (await readdir(ticketsDir))
    .filter(f => f.endsWith('.json'))
    .sort();
  const tickets = [];
  for (const f of files) {
    tickets.push(await loadTicket(join(ticketsDir, f)));
  }
  return tickets;
}

// --- Result schema ---

export function createResult(ticket, condition) {
  return {
    ticket_id: ticket.id,
    condition,
    success: false,
    time_ms: 0,
    human_interventions: 0,
    tests_passed: false,
    regressions: [],
    error: null,
    started_at: null,
    finished_at: null,
  };
}

// --- Execution ---

export async function runTicket(ticket, condition, adapter) {
  if (!VALID_CONDITIONS.includes(condition)) {
    throw new Error(`Invalid condition: ${condition}. Must be one of: ${VALID_CONDITIONS.join(', ')}`);
  }

  const result = createResult(ticket, condition);
  result.started_at = new Date().toISOString();
  const t0 = performance.now();

  try {
    const outcome = await adapter.execute(ticket, condition);
    result.success = outcome.success === true;
    result.tests_passed = outcome.tests_passed === true;
    result.human_interventions = outcome.human_interventions || 0;
    result.regressions = outcome.regressions || [];
    result.error = outcome.error || null;
  } catch (err) {
    result.success = false;
    result.error = err.message;
  }

  result.time_ms = Math.round(performance.now() - t0);
  result.finished_at = new Date().toISOString();

  // Enforce timebox
  if (result.time_ms > ticket.timebox_max * 1000) {
    result.success = false;
    result.error = result.error || `Exceeded timebox: ${result.time_ms}ms > ${ticket.timebox_max * 1000}ms`;
  }

  return result;
}

// --- Condition adapters ---

export function createOrchestraAdapter(options = {}) {
  return {
    name: 'orchestra',
    async execute(ticket) {
      if (options.execute) return options.execute(ticket);
      throw new Error('Orchestra adapter not configured');
    },
  };
}

export function createClaudeDirectAdapter(options = {}) {
  return {
    name: 'claude_direct',
    async execute(ticket) {
      if (options.execute) return options.execute(ticket);
      throw new Error('Claude direct adapter not configured');
    },
  };
}

export function createCodexDirectAdapter(options = {}) {
  return {
    name: 'codex_direct',
    async execute(ticket) {
      if (options.execute) return options.execute(ticket);
      throw new Error('Codex direct adapter not configured');
    },
  };
}

export { VALID_CONDITIONS, REQUIRED_FIELDS };
