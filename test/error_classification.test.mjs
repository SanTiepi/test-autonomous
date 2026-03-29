// error_classification.test.mjs — Tests for API error classification and retry behavior.
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { classifyError, invokeCodex } from '../src/dispatcher.mjs';
import { startFakeCodex } from './helpers/fake-codex-server.mjs';

// ── Unit tests for classifyError ──

describe('classifyError', () => {
  it('classifies insufficient_quota as non-retryable', () => {
    const body = JSON.stringify({ error: { message: 'quota exceeded', code: 'insufficient_quota' } });
    const err = classifyError(429, body);
    assert.equal(err.retryable, false);
    assert.equal(err.error_code, 'insufficient_quota');
    assert.equal(err.provider, 'openai');
  });

  it('classifies invalid_api_key as non-retryable', () => {
    const body = JSON.stringify({ error: { message: 'bad key', code: 'invalid_api_key' } });
    const err = classifyError(401, body);
    assert.equal(err.retryable, false);
    assert.equal(err.error_code, 'invalid_api_key');
  });

  it('classifies 401 as non-retryable even without error code', () => {
    const err = classifyError(401, 'Unauthorized');
    assert.equal(err.retryable, false);
  });

  it('classifies 403 as non-retryable', () => {
    const err = classifyError(403, '{}');
    assert.equal(err.retryable, false);
  });

  it('classifies 429 rate_limit as retryable', () => {
    const body = JSON.stringify({ error: { message: 'rate limited', code: 'rate_limit_exceeded' } });
    const err = classifyError(429, body);
    assert.equal(err.retryable, true);
    assert.equal(err.error_code, 'rate_limit_exceeded');
  });

  it('classifies 500 as retryable', () => {
    const body = JSON.stringify({ error: { message: 'internal error', type: 'server_error' } });
    const err = classifyError(500, body);
    assert.equal(err.retryable, true);
  });

  it('classifies 502 as retryable', () => {
    const err = classifyError(502, 'Bad Gateway');
    assert.equal(err.retryable, true);
  });

  it('classifies 503 as retryable', () => {
    const err = classifyError(503, '{}');
    assert.equal(err.retryable, true);
  });

  it('classifies network error as retryable', () => {
    const err = classifyError(0, '', 'ECONNRESET');
    assert.equal(err.retryable, true);
    assert.equal(err.error_code, 'network_error');
  });

  it('classifies abort/timeout as non-retryable', () => {
    const err = classifyError(0, '', 'The operation was aborted');
    assert.equal(err.retryable, false);
  });

  it('classifies model_not_found as non-retryable', () => {
    const body = JSON.stringify({ error: { code: 'model_not_found', message: 'not found' } });
    const err = classifyError(404, body);
    assert.equal(err.retryable, false);
    assert.equal(err.error_code, 'model_not_found');
  });
});

// ── Integration tests for retry behavior ──

describe('invokeCodex retry behavior', () => {
  let fake;
  const baseConfig = {
    codexModel: 'test',
    codexApiKey: 'test-key',
    aiTimeoutMs: 5000,
    paths: { eventsLog: '/dev/null', logsDir: '/tmp' },
  };

  afterEach(async () => {
    if (fake) await fake.close();
  });

  it('does NOT retry on quota error (non-retryable)', async () => {
    fake = await startFakeCodex(0);
    const config = { ...baseConfig, codexApiBase: fake.url };
    fake.setMode('quota');

    const result = await invokeCodex('test prompt', config);

    assert.equal(result.envelope, null);
    assert.ok(result.apiError);
    assert.equal(result.apiError.retryable, false);
    assert.equal(result.apiError.error_code, 'insufficient_quota');
    // Only 1 request — no retry
    assert.equal(fake.getRequestCount(), 1);
  });

  it('does NOT retry on auth error (non-retryable)', async () => {
    fake = await startFakeCodex(0);
    const config = { ...baseConfig, codexApiBase: fake.url };
    fake.setMode('auth_error');

    const result = await invokeCodex('test prompt', config);

    assert.equal(result.apiError.retryable, false);
    assert.equal(fake.getRequestCount(), 1);
  });

  it('retries on 500 and succeeds on second attempt', async () => {
    fake = await startFakeCodex(0);
    const config = { ...baseConfig, codexApiBase: fake.url };
    fake.setMode('error_500_then_ok');

    const result = await invokeCodex('test prompt', config);

    assert.ok(result.envelope, 'should have parsed envelope after retry');
    assert.equal(result.envelope.summary, 'planned next phase');
    // First request failed, then retry succeeded
    assert.ok(fake.getRequestCount() >= 2, `expected >=2 requests, got ${fake.getRequestCount()}`);
  });
});
