// dispatcher.test.mjs — Tests for invokeClaude and invokeCodex
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync, existsSync } from 'node:fs';

import { invokeClaude, invokeCodex } from '../src/dispatcher.mjs';
import { startFakeCodex } from './helpers/fake-codex-server.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FAKE_CLI = resolve(__dirname, 'helpers', 'fake-claude-cli.mjs');

// Ensure logs directory exists so logEvent doesn't fail
const LOGS_DIR = resolve(__dirname, '..', '.orchestra', 'logs');
if (!existsSync(LOGS_DIR)) mkdirSync(LOGS_DIR, { recursive: true });

const EVENTS_LOG = resolve(LOGS_DIR, 'events.ndjson');

function makeConfig(overrides = {}) {
  return {
    claudeCmd: 'node',
    claudeArgs: [FAKE_CLI],
    aiTimeoutMs: 10_000,
    codexModel: 'test-model',
    codexApiBase: 'http://127.0.0.1:9999',
    codexApiKey: 'test-key',
    spawnEnv: {},
    paths: {
      eventsLog: EVENTS_LOG,
    },
    ...overrides,
  };
}

// ── invokeClaude tests ──

describe('invokeClaude', () => {
  it('parses a valid envelope on success', async () => {
    const config = makeConfig({ spawnEnv: { FAKE_CLAUDE_MODE: 'success' } });
    const result = await invokeClaude('test prompt', config);

    assert.equal(result.exitCode, 0);
    assert.ok(result.envelope, 'envelope should not be null');
    assert.equal(result.envelope.status, 'completed');
    assert.equal(result.envelope.summary, 'implemented feature');
    assert.ok(result.duration >= 0);
    assert.ok(typeof result.raw === 'string');
  });

  it('synthesizes envelope from malformed stdout', async () => {
    const config = makeConfig({ spawnEnv: { FAKE_CLAUDE_MODE: 'malformed' } });
    const result = await invokeClaude('test prompt', config);

    assert.equal(result.exitCode, 0);
    // With synthesizeEnvelope fallback, malformed text still produces an envelope
    assert.ok(result.envelope || result.raw, 'should have envelope or raw output');
  });

  it('handles crash with non-zero exit code', async () => {
    const config = makeConfig({ spawnEnv: { FAKE_CLAUDE_MODE: 'crash' } });
    const result = await invokeClaude('test prompt', config);

    assert.ok(result.exitCode !== 0, 'exitCode should be non-zero');
    assert.equal(result.envelope, null);
  });

  it('handles timeout by killing the process', async () => {
    const config = makeConfig({
      spawnEnv: { FAKE_CLAUDE_MODE: 'timeout' },
      aiTimeoutMs: 1000,
    });
    const start = Date.now();
    const result = await invokeClaude('test prompt', config);
    const elapsed = Date.now() - start;

    assert.equal(result.envelope, null);
    assert.ok(elapsed < 5000, `Should return within 5s, took ${elapsed}ms`);
  });

  it('extracts envelope from polluted stdout', async () => {
    const config = makeConfig({ spawnEnv: { FAKE_CLAUDE_MODE: 'polluted' } });
    const result = await invokeClaude('test prompt', config);

    assert.equal(result.exitCode, 0);
    assert.ok(result.envelope, 'envelope should be extracted despite prefix junk');
    assert.equal(result.envelope.status, 'completed');
    assert.equal(result.envelope.summary, 'implemented feature');
  });
});

// ── invokeCodex tests ──

describe('invokeCodex', () => {
  /** @type {Awaited<ReturnType<typeof startFakeCodex>>} */
  let fake;
  let config;

  before(async () => {
    fake = await startFakeCodex(0);
    config = makeConfig({ codexApiBase: fake.url });
  });

  after(async () => {
    if (fake) await fake.close();
  });

  it('parses a valid envelope on success', async () => {
    fake.setMode('success');
    const result = await invokeCodex('test prompt', config);

    assert.ok(result.envelope, 'envelope should not be null');
    assert.equal(result.envelope.status, 'completed');
    assert.equal(result.envelope.summary, 'planned next phase');
    assert.ok(result.usage, 'usage should be present');
    assert.equal(result.usage.total_tokens, 300);
    assert.ok(result.duration >= 0);
  });

  it('handles malformed text (synthesizes or returns null)', async () => {
    fake.setMode('malformed');
    const result = await invokeCodex('test prompt', config);

    // With synthesizeEnvelope, malformed text may produce a fallback envelope
    assert.ok(result.envelope || result.raw, 'should have envelope or raw');
    assert.ok(typeof result.raw === 'string');
  });

  it('handles HTTP 500 error', async () => {
    fake.setMode('error_500');
    const result = await invokeCodex('test prompt', config);

    assert.equal(result.envelope, null);
    assert.ok(result.raw.includes('error') || result.raw.includes('Internal'));
  });

  it('handles timeout by aborting the request', async () => {
    fake.setMode('slow');
    const timeoutConfig = makeConfig({
      codexApiBase: fake.url,
      aiTimeoutMs: 1000,
    });
    const start = Date.now();
    const result = await invokeCodex('test prompt', timeoutConfig);
    const elapsed = Date.now() - start;

    assert.equal(result.envelope, null);
    assert.ok(elapsed < 5000, `Should return within 5s, took ${elapsed}ms`);
  });
});
