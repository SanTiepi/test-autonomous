#!/usr/bin/env node
// fake-claude-cli.mjs — Simulates the Claude CLI for testing.
// Usage: FAKE_CLAUDE_MODE=success node test/helpers/fake-claude-cli.mjs

const VALID_ENVELOPE = JSON.stringify({
  status: 'completed',
  summary: 'implemented feature',
  artifacts: ['src/foo.mjs'],
  made_progress: true,
  fingerprint_basis: 'added foo module',
  next: {
    target: 'codex',
    kind: 'review',
    instruction: 'review the implementation',
    acceptance_criteria: ['code is clean'],
    artifacts_expected: [],
  },
  meta_feedback: {
    prompt_quality: 4,
    redundant_fields: [],
    missing_context: [],
    optimization_notes: 'good prompt',
  },
});

const CLI_RESPONSE = JSON.stringify({
  type: 'result',
  subtype: 'success',
  result: VALID_ENVELOPE,
});

// Natural text response — no JSON, just prose.
// The dispatcher synthesizeEnvelope should handle this.
const NATURAL_TEXT = 'I implemented the auth module and added JWT support. Modified src/auth.mjs and created test/auth.test.mjs. All tests pass and the feature is complete.';
const NATURAL_TEXT_CLI = JSON.stringify({
  type: 'result',
  subtype: 'success',
  result: NATURAL_TEXT,
});

const mode = process.env.FAKE_CLAUDE_MODE || 'success';

switch (mode) {
  case 'success':
    process.stdout.write(CLI_RESPONSE);
    process.exit(0);
    break;

  case 'natural_text':
    process.stdout.write(NATURAL_TEXT_CLI);
    process.exit(0);
    break;

  case 'malformed':
    process.stdout.write('Some warning\n{invalid json');
    process.exit(0);
    break;

  case 'timeout':
    // Sleep forever — the caller should kill us
    setInterval(() => {}, 60_000);
    break;

  case 'crash':
    process.stderr.write('Segfault');
    process.exit(1);
    break;

  case 'polluted':
    process.stdout.write('Update available!\n' + CLI_RESPONSE);
    process.exit(0);
    break;

  default:
    process.stdout.write(CLI_RESPONSE);
    process.exit(0);
    break;
}
