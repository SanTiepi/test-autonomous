import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parsePlan, parseReview, formatPlanRequest, formatReviewRequest, formatClaudeReport } from '../src/duo.mjs';

describe('parsePlan', () => {
  it('parses compact plan format', () => {
    const plan = parsePlan(`FIX: case-insensitive tag filter
FILES: src/bookmarks.mjs
DO: Change listBookmarks to toLowerCase both tag and query
TEST: tag="JS" matches "js"
DONT: mutate stored tags
CLASS: trivial`);
    assert.equal(plan.fix, 'case-insensitive tag filter');
    assert.equal(plan.files, 'src/bookmarks.mjs');
    assert.ok(plan.do.includes('toLowerCase'));
    assert.ok(plan.test.includes('JS'));
    assert.ok(plan.dont.includes('mutate'));
    assert.equal(plan.class, 'trivial');
  });

  it('handles FEAT type', () => {
    const plan = parsePlan('FEAT: add stats endpoint\nFILES: src/bookmarks.mjs\nDO: add getBookmarkStats\nTEST: returns total\nCLASS: medium');
    assert.equal(plan.feat, 'add stats endpoint');
    assert.equal(plan.class, 'medium');
  });

  it('handles REFACTOR type', () => {
    const plan = parsePlan('REFACTOR: extract validation\nFILES: src/bookmarks.mjs, src/index.mjs\nDO: extract parseBody helper\nCLASS: complex');
    assert.equal(plan.refactor, 'extract validation');
    assert.equal(plan.class, 'complex');
  });

  it('falls back on prose', () => {
    const plan = parsePlan('Just fix the bug in listBookmarks to be case insensitive');
    assert.ok(plan.do.includes('fix the bug'));
    assert.equal(plan.class, 'medium'); // default
  });

  it('handles missing fields', () => {
    const plan = parsePlan('FIX: something\nDO: fix it');
    assert.equal(plan.fix, 'something');
    assert.equal(plan.files, '');
    assert.equal(plan.class, 'medium');
  });
});

describe('parseReview', () => {
  it('parses approve', () => {
    const review = parseReview('VERDICT: approve\nREASON: looks good');
    assert.equal(review.verdict, 'approve');
    assert.equal(review.reason, 'looks good');
  });

  it('parses challenge with fix', () => {
    const review = parseReview('VERDICT: challenge\nREASON: missing edge case\nFIX: handle empty tags array');
    assert.equal(review.verdict, 'challenge');
    assert.equal(review.fix, 'handle empty tags array');
  });

  it('parses reject', () => {
    const review = parseReview('VERDICT: reject\nREASON: wrong approach\nFIX: use a different strategy');
    assert.equal(review.verdict, 'reject');
  });

  it('detects verdict from prose fallback', () => {
    const review = parseReview('I would challenge this because the edge case is missing');
    assert.equal(review.verdict, 'challenge');
  });
});

describe('formatPlanRequest', () => {
  it('includes goal', () => {
    const req = formatPlanRequest('add pagination', 'bookmarks API exists');
    assert.ok(req.includes('add pagination'));
    assert.ok(req.includes('bookmarks API exists'));
  });

  it('works without context', () => {
    const req = formatPlanRequest('fix bug');
    assert.ok(req.includes('fix bug'));
    assert.ok(!req.includes('undefined'));
  });

  it('asks for compact format', () => {
    const req = formatPlanRequest('task');
    assert.ok(req.includes('FIX/FEAT/REFACTOR'));
    assert.ok(req.includes('CLASS'));
  });
});

describe('formatReviewRequest', () => {
  it('includes report', () => {
    const req = formatReviewRequest('DONE: fixed the bug\nCHANGED: src/foo.mjs\nTESTS: 10/10');
    assert.ok(req.includes('DONE: fixed the bug'));
    assert.ok(req.includes('VERDICT'));
  });
});

describe('formatClaudeReport', () => {
  it('formats compact report', () => {
    const report = formatClaudeReport('added stats endpoint', ['src/bookmarks.mjs', 'test/bookmarks.test.mjs'], 42);
    assert.ok(report.includes('DONE: added stats endpoint'));
    assert.ok(report.includes('src/bookmarks.mjs'));
    assert.ok(report.includes('42 pass'));
  });
});
