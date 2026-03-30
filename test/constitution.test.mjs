import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  article1_purpose,
  article2_nonHarm,
  article3_riskBudget,
  article4_traceability,
  article5_rollback,
  article6_proofObligation,
  article7_executableDiscovery,
  article8_divergence,
  article9_sovereignty,
  article10_amendment,
  articles,
  enforce,
} from '../src/constitution.mjs';

// ============================================================
// Article 1 — PURPOSE
// ============================================================
describe('Article 1: Purpose', () => {
  it('passes when action has an objective', () => {
    assert.ok(article1_purpose.check({ objective: 'ship SwissBuilding v2' }).ok);
  });
  it('rejects action without objective', () => {
    assert.equal(article1_purpose.check({}).ok, false);
  });
  it('rejects vague objective', () => {
    assert.equal(article1_purpose.check({ objective: 'ok' }).ok, false);
  });
  it('rejects null', () => {
    assert.equal(article1_purpose.check(null).ok, false);
  });
});

// ============================================================
// Article 2 — NON-HARM
// ============================================================
describe('Article 2: Non-Harm', () => {
  it('passes when no regressions', () => {
    const r = article2_nonHarm.check({ before: { fail: 0 }, after: { fail: 0 } });
    assert.ok(r.ok);
  });
  it('passes when failures decrease', () => {
    const r = article2_nonHarm.check({ before: { fail: 3 }, after: { fail: 1 } });
    assert.ok(r.ok);
  });
  it('rejects regressions', () => {
    const r = article2_nonHarm.check({ before: { fail: 0 }, after: { fail: 2 } });
    assert.equal(r.ok, false);
    assert.equal(r.regressions, 2);
  });
  it('rejects missing data', () => {
    assert.equal(article2_nonHarm.check(null).ok, false);
  });
});

// ============================================================
// Article 3 — RISK BUDGET
// ============================================================
describe('Article 3: Risk Budget', () => {
  it('passes low-risk actions', () => {
    const actions = [{ type: 'read' }, { type: 'read' }, { type: 'write_test' }];
    const r = article3_riskBudget.check(actions);
    assert.ok(r.ok);
    assert.equal(r.total, 1); // 0+0+1
  });
  it('rejects budget overflow', () => {
    const actions = Array(3).fill({ type: 'deploy' }); // 3×50 = 150
    const r = article3_riskBudget.check(actions);
    assert.equal(r.ok, false);
    assert.equal(r.total, 150);
  });
  it('uses default weight for unknown types', () => {
    const actions = [{ type: 'unknown_action' }];
    const r = article3_riskBudget.check(actions);
    assert.ok(r.ok);
    assert.equal(r.total, 10);
  });
});

// ============================================================
// Article 4 — TRACEABILITY
// ============================================================
describe('Article 4: Traceability', () => {
  it('passes complete decisions', () => {
    const d = { who: 'Claude', what: 'refactor', why: 'debt', evidence: 'test results' };
    assert.ok(article4_traceability.check(d).ok);
  });
  it('rejects incomplete decisions', () => {
    const d = { who: 'Claude', what: 'refactor' };
    const r = article4_traceability.check(d);
    assert.equal(r.ok, false);
    assert.ok(r.reason.includes('why'));
  });
});

// ============================================================
// Article 5 — ROLLBACK RIGHT
// ============================================================
describe('Article 5: Rollback Right', () => {
  it('passes reversible actions', () => {
    assert.ok(article5_rollback.check({ type: 'write_code' }).ok);
  });
  it('passes irreversible with approval', () => {
    assert.ok(article5_rollback.check({ type: 'deploy', humanApproved: true }).ok);
  });
  it('rejects irreversible without approval', () => {
    const r = article5_rollback.check({ type: 'deploy' });
    assert.equal(r.ok, false);
    assert.ok(r.reason.includes('human approval'));
  });
});

// ============================================================
// Article 6 — PROOF OBLIGATION
// ============================================================
describe('Article 6: Proof Obligation', () => {
  it('passes verified claims', () => {
    const c = { statement: '84% pertinence', evidence: ['batiscan_test.json'], verifiable: true };
    assert.ok(article6_proofObligation.check(c).ok);
  });
  it('rejects unverifiable claims', () => {
    const c = { statement: 'this is great', evidence: ['x'], verifiable: false };
    assert.equal(article6_proofObligation.check(c).ok, false);
  });
  it('rejects empty evidence', () => {
    const c = { statement: 'claim', evidence: [], verifiable: true };
    assert.equal(article6_proofObligation.check(c).ok, false);
  });
});

// ============================================================
// Article 7 — EXECUTABLE DISCOVERY
// ============================================================
describe('Article 7: Executable Discovery', () => {
  it('passes discoveries incarnated as code', () => {
    const d = { name: 'adaptive form', validated: true, form: 'test' };
    assert.ok(article7_executableDiscovery.check(d).ok);
  });
  it('rejects validated discoveries that remain text', () => {
    const d = { name: 'respect agent preferences', validated: true, form: 'text' };
    const r = article7_executableDiscovery.check(d);
    assert.equal(r.ok, false);
    assert.ok(r.reason.includes('respect agent preferences'));
  });
  it('allows unvalidated discoveries to exist as text', () => {
    const d = { name: 'hypothesis', validated: false, form: 'text' };
    assert.ok(article7_executableDiscovery.check(d).ok);
  });
});

// ============================================================
// Article 8 — DIVERGENCE BEFORE CONVERGENCE
// ============================================================
describe('Article 8: Divergence', () => {
  it('passes structural decisions with 2+ perspectives', () => {
    const d = { structural: true, perspectives: ['Claude', 'Codex'] };
    assert.ok(article8_divergence.check(d).ok);
  });
  it('rejects structural decisions with single perspective', () => {
    const d = { structural: true, perspectives: ['Claude'] };
    assert.equal(article8_divergence.check(d).ok, false);
  });
  it('allows non-structural decisions without divergence', () => {
    const d = { structural: false, perspectives: [] };
    assert.ok(article8_divergence.check(d).ok);
  });
});

// ============================================================
// Article 9 — SOVEREIGNTY
// ============================================================
describe('Article 9: Sovereignty', () => {
  it('accepts code-scale actions', () => {
    assert.ok(article9_sovereignty.check({ scale: 'code' }).ok);
  });
  it('accepts human-scale actions', () => {
    assert.ok(article9_sovereignty.check({ scale: 'human' }).ok);
  });
  it('accepts entity-scale actions', () => {
    assert.ok(article9_sovereignty.check({ scale: 'entity' }).ok);
  });
  it('rejects actions without declared scale', () => {
    assert.equal(article9_sovereignty.check({ scale: 'unknown' }).ok, false);
  });
});

// ============================================================
// Article 10 — AMENDMENT
// ============================================================
describe('Article 10: Amendment', () => {
  it('passes complete amendments', () => {
    const a = {
      necessityProof: 'Article 3 budget too low for Mode B',
      testBefore: 'risk_budget.test.mjs snapshot',
      testAfter: 'risk_budget_v2.test.mjs passes',
      robinApproved: true,
    };
    assert.ok(article10_amendment.check(a).ok);
  });
  it('rejects amendments without Robin approval', () => {
    const a = { necessityProof: 'x', testBefore: 'y', testAfter: 'z' };
    const r = article10_amendment.check(a);
    assert.equal(r.ok, false);
    assert.ok(r.reason.includes('Robin approval'));
  });
});

// ============================================================
// ENFORCE — Full constitution check
// ============================================================
describe('enforce() — full constitution', () => {
  it('has exactly 10 articles', () => {
    assert.equal(articles.length, 10);
  });

  it('each article has id, rule, check', () => {
    for (const article of articles) {
      assert.ok(article.id, `article missing id`);
      assert.ok(article.rule, `${article.id} missing rule`);
      assert.equal(typeof article.check, 'function', `${article.id} missing check()`);
    }
  });

  it('returns structured verdict', () => {
    const verdict = enforce({});
    assert.equal(typeof verdict.constitutional, 'boolean');
    assert.equal(typeof verdict.passed, 'number');
    assert.ok(Array.isArray(verdict.violations));
    assert.equal(verdict.total, 10);
    assert.ok(verdict.timestamp);
  });

  it('detects violations across articles', () => {
    const verdict = enforce({});
    assert.ok(verdict.violations.length > 0, 'empty context should have violations');
    assert.equal(verdict.constitutional, false);
  });
});
