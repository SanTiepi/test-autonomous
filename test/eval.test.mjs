import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  loadTicket, loadAllTickets, runTicket, createResult,
  createOrchestraAdapter, createClaudeDirectAdapter, createCodexDirectAdapter,
  VALID_CONDITIONS, REQUIRED_FIELDS,
} from '../eval/runner.mjs';
import { score, scoreByCondition } from '../eval/scorer.mjs';
import { verdict, VERDICTS } from '../eval/verdict.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TICKETS_DIR = join(__dirname, '..', 'eval', 'tickets');

// --- Ticket loading ---

describe('eval/runner — ticket loading', () => {
  it('loads all 12 tickets from eval/tickets/', async () => {
    const tickets = await loadAllTickets(TICKETS_DIR);
    assert.equal(tickets.length, 12);
  });

  it('every ticket has required fields', async () => {
    const tickets = await loadAllTickets(TICKETS_DIR);
    for (const t of tickets) {
      for (const field of REQUIRED_FIELDS) {
        assert.ok(field in t, `ticket ${t.id} missing ${field}`);
      }
    }
  });

  it('tickets cover all required categories', async () => {
    const tickets = await loadAllTickets(TICKETS_DIR);
    const cats = {};
    for (const t of tickets) {
      cats[t.category] = (cats[t.category] || 0) + 1;
    }
    assert.equal(cats['feature'], 4);
    assert.equal(cats['bugfix'], 3);
    assert.equal(cats['refactor'], 2);
    assert.equal(cats['review-correction'], 2);
    assert.equal(cats['resume-after-pause'], 1);
  });

  it('every ticket has a unique id', async () => {
    const tickets = await loadAllTickets(TICKETS_DIR);
    const ids = tickets.map(t => t.id);
    assert.equal(new Set(ids).size, ids.length);
  });

  it('acceptance_criteria is a non-empty array on every ticket', async () => {
    const tickets = await loadAllTickets(TICKETS_DIR);
    for (const t of tickets) {
      assert.ok(Array.isArray(t.acceptance_criteria), `${t.id}: acceptance_criteria not array`);
      assert.ok(t.acceptance_criteria.length > 0, `${t.id}: acceptance_criteria empty`);
    }
  });

  it('budget_max and timebox_max are positive numbers', async () => {
    const tickets = await loadAllTickets(TICKETS_DIR);
    for (const t of tickets) {
      assert.ok(typeof t.budget_max === 'number' && t.budget_max > 0, `${t.id}: bad budget_max`);
      assert.ok(typeof t.timebox_max === 'number' && t.timebox_max > 0, `${t.id}: bad timebox_max`);
    }
  });

  it('rejects ticket missing a required field', async () => {
    // loadTicket on a non-existent path should throw
    await assert.rejects(() => loadTicket('/nonexistent/ticket.json'));
  });
});

// --- Runner execution shape ---

describe('eval/runner — execution', () => {
  const mockTicket = {
    id: 'test-ticket',
    category: 'feature',
    brief: 'Test ticket',
    acceptance_criteria: ['it works'],
    oracle_test: 'verify it works',
    budget_max: 10000,
    timebox_max: 60,
  };

  it('createResult returns correct schema', () => {
    const r = createResult(mockTicket, 'orchestra');
    assert.equal(r.ticket_id, 'test-ticket');
    assert.equal(r.condition, 'orchestra');
    assert.equal(r.success, false);
    assert.equal(r.time_ms, 0);
    assert.equal(r.human_interventions, 0);
    assert.equal(r.tests_passed, false);
    assert.deepEqual(r.regressions, []);
    assert.equal(r.error, null);
    assert.equal(r.started_at, null);
    assert.equal(r.finished_at, null);
  });

  it('runTicket with successful adapter returns success result', async () => {
    const adapter = createOrchestraAdapter({
      execute: () => ({ success: true, tests_passed: true, human_interventions: 0, regressions: [] }),
    });
    const result = await runTicket(mockTicket, 'orchestra', adapter);
    assert.equal(result.ticket_id, 'test-ticket');
    assert.equal(result.condition, 'orchestra');
    assert.equal(result.success, true);
    assert.equal(result.tests_passed, true);
    assert.ok(result.time_ms >= 0);
    assert.ok(result.started_at);
    assert.ok(result.finished_at);
    assert.equal(result.error, null);
  });

  it('runTicket with failing adapter returns error result', async () => {
    const adapter = createClaudeDirectAdapter({
      execute: () => { throw new Error('API unavailable'); },
    });
    const result = await runTicket(mockTicket, 'claude_direct', adapter);
    assert.equal(result.success, false);
    assert.equal(result.error, 'API unavailable');
  });

  it('runTicket with partial failure captures details', async () => {
    const adapter = createCodexDirectAdapter({
      execute: () => ({
        success: false,
        tests_passed: false,
        human_interventions: 2,
        regressions: ['test_a broke'],
        error: 'compilation failed',
      }),
    });
    const result = await runTicket(mockTicket, 'codex_direct', adapter);
    assert.equal(result.success, false);
    assert.equal(result.human_interventions, 2);
    assert.deepEqual(result.regressions, ['test_a broke']);
    assert.equal(result.error, 'compilation failed');
  });

  it('rejects invalid condition', async () => {
    const adapter = createOrchestraAdapter({ execute: () => ({ success: true }) });
    await assert.rejects(
      () => runTicket(mockTicket, 'invalid_cond', adapter),
      /Invalid condition/,
    );
  });

  it('VALID_CONDITIONS lists all three', () => {
    assert.deepEqual(VALID_CONDITIONS, ['orchestra', 'claude_direct', 'codex_direct']);
  });

  it('unconfigured adapter throws descriptive error', async () => {
    const adapter = createOrchestraAdapter();
    const result = await runTicket(mockTicket, 'orchestra', adapter);
    assert.equal(result.success, false);
    assert.ok(result.error.includes('not configured'));
  });
});

// --- Scorer metrics ---

describe('eval/scorer — metrics', () => {
  it('returns zeros for empty results', () => {
    const s = score([]);
    assert.equal(s.success_rate, 0);
    assert.equal(s.time_to_green, 0);
    assert.equal(s.human_interventions, 0);
    assert.equal(s.regression_rate, 0);
  });

  it('computes correct metrics for mixed results', () => {
    const results = [
      { success: true, time_ms: 100, human_interventions: 0, regressions: [] },
      { success: true, time_ms: 200, human_interventions: 1, regressions: [] },
      { success: false, time_ms: 500, human_interventions: 2, regressions: ['test_x'] },
      { success: false, time_ms: 300, human_interventions: 0, regressions: [] },
    ];
    const s = score(results);
    assert.equal(s.success_rate, 0.5);
    assert.equal(s.time_to_green, 150); // avg(100,200)
    assert.equal(s.human_interventions, 3); // 0+1+2+0
    assert.equal(s.regression_rate, 0.25); // 1/4
  });

  it('handles all-success scenario', () => {
    const results = [
      { success: true, time_ms: 50, human_interventions: 0, regressions: [] },
      { success: true, time_ms: 150, human_interventions: 0, regressions: [] },
    ];
    const s = score(results);
    assert.equal(s.success_rate, 1);
    assert.equal(s.time_to_green, 100);
    assert.equal(s.human_interventions, 0);
    assert.equal(s.regression_rate, 0);
  });

  it('handles all-failure scenario', () => {
    const results = [
      { success: false, time_ms: 400, human_interventions: 3, regressions: ['a'] },
      { success: false, time_ms: 600, human_interventions: 1, regressions: ['b', 'c'] },
    ];
    const s = score(results);
    assert.equal(s.success_rate, 0);
    assert.equal(s.time_to_green, 0);
    assert.equal(s.human_interventions, 4);
    assert.equal(s.regression_rate, 1);
  });

  it('scoreByCondition groups results correctly', () => {
    const results = [
      { condition: 'orchestra', success: true, time_ms: 100, human_interventions: 0, regressions: [] },
      { condition: 'orchestra', success: true, time_ms: 200, human_interventions: 0, regressions: [] },
      { condition: 'claude_direct', success: false, time_ms: 500, human_interventions: 2, regressions: ['x'] },
      { condition: 'codex_direct', success: true, time_ms: 300, human_interventions: 1, regressions: [] },
    ];
    const scores = scoreByCondition(results);
    assert.equal(scores.orchestra.success_rate, 1);
    assert.equal(scores.claude_direct.success_rate, 0);
    assert.equal(scores.codex_direct.success_rate, 1);
  });
});

// --- Verdict output ---

describe('eval/verdict — classification', () => {
  it('VERDICTS contains the three valid outcomes', () => {
    assert.deepEqual(VERDICTS, ['differentiated', 'useful_but_not_unique', 'not_worth_it_yet']);
  });

  it('returns differentiated when orchestra clearly wins', () => {
    const v = verdict({
      orchestra:     { success_rate: 0.9, time_to_green: 100, human_interventions: 0, regression_rate: 0 },
      claude_direct: { success_rate: 0.4, time_to_green: 500, human_interventions: 5, regression_rate: 0.3 },
      codex_direct:  { success_rate: 0.3, time_to_green: 600, human_interventions: 4, regression_rate: 0.2 },
    });
    assert.equal(v, 'differentiated');
  });

  it('returns useful_but_not_unique when orchestra matches baselines', () => {
    const v = verdict({
      orchestra:     { success_rate: 0.7, time_to_green: 200, human_interventions: 1, regression_rate: 0.1 },
      claude_direct: { success_rate: 0.7, time_to_green: 200, human_interventions: 1, regression_rate: 0.1 },
      codex_direct:  { success_rate: 0.6, time_to_green: 300, human_interventions: 2, regression_rate: 0.1 },
    });
    assert.equal(v, 'useful_but_not_unique');
  });

  it('returns not_worth_it_yet when orchestra is worse', () => {
    const v = verdict({
      orchestra:     { success_rate: 0.2, time_to_green: 800, human_interventions: 5, regression_rate: 0.5 },
      claude_direct: { success_rate: 0.8, time_to_green: 100, human_interventions: 0, regression_rate: 0 },
      codex_direct:  { success_rate: 0.7, time_to_green: 150, human_interventions: 1, regression_rate: 0.05 },
    });
    assert.equal(v, 'not_worth_it_yet');
  });

  it('returns not_worth_it_yet when orchestra is missing', () => {
    const v = verdict({
      claude_direct: { success_rate: 0.8, time_to_green: 100, human_interventions: 0, regression_rate: 0 },
    });
    assert.equal(v, 'not_worth_it_yet');
  });

  it('returns not_worth_it_yet when no baselines', () => {
    const v = verdict({
      orchestra: { success_rate: 0.9, time_to_green: 100, human_interventions: 0, regression_rate: 0 },
    });
    assert.equal(v, 'not_worth_it_yet');
  });

  it('verdict always returns a valid value', () => {
    const combos = [
      { orchestra: { success_rate: 1, time_to_green: 0, human_interventions: 0, regression_rate: 0 },
        claude_direct: { success_rate: 0, time_to_green: 0, human_interventions: 0, regression_rate: 0 } },
      { orchestra: { success_rate: 0.5, time_to_green: 0, human_interventions: 0, regression_rate: 0 },
        codex_direct: { success_rate: 0.5, time_to_green: 0, human_interventions: 0, regression_rate: 0 } },
    ];
    for (const c of combos) {
      assert.ok(VERDICTS.includes(verdict(c)), `unexpected verdict for ${JSON.stringify(c)}`);
    }
  });
});
