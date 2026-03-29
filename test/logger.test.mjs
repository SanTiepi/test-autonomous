import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { logEvent } from '../src/logger.mjs';

describe('logEvent', () => {
  let tempDir;
  let config;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'logger-test-'));
    config = {
      paths: {
        eventsLog: join(tempDir, 'logs', 'events.ndjson'),
      },
    };
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('creates the log directory if missing', () => {
    logEvent(config, { level: 'info', source: 'system', event: 'boot', data: {} });
    const content = readFileSync(config.paths.eventsLog, 'utf8');
    assert.ok(content.length > 0);
  });

  it('appends valid NDJSON lines', () => {
    logEvent(config, { level: 'info', source: 'watcher', event: 'start', data: { foo: 1 } });
    logEvent(config, { level: 'warn', source: 'safety', event: 'budget_low', data: { pct: 10 } });

    const lines = readFileSync(config.paths.eventsLog, 'utf8').trim().split('\n');
    assert.equal(lines.length, 2);

    for (const line of lines) {
      const obj = JSON.parse(line);
      assert.ok(obj.ts, 'ts field must be present');
      assert.ok(obj.level);
      assert.ok(obj.source);
      assert.ok(obj.event);
    }
  });

  it('auto-adds ts as ISO 8601', () => {
    logEvent(config, { level: 'info', source: 'system', event: 'test', data: {} });
    const lines = readFileSync(config.paths.eventsLog, 'utf8').trim().split('\n');
    const obj = JSON.parse(lines[0]);
    // Should be a valid ISO date
    const d = new Date(obj.ts);
    assert.ok(!isNaN(d.getTime()), 'ts must be a valid date');
    assert.ok(obj.ts.includes('T'), 'ts must be ISO 8601 format');
  });

  it('preserves event data', () => {
    logEvent(config, { level: 'error', source: 'dispatcher', event: 'crash', data: { code: 42 } });
    const lines = readFileSync(config.paths.eventsLog, 'utf8').trim().split('\n');
    const obj = JSON.parse(lines[0]);
    assert.equal(obj.level, 'error');
    assert.equal(obj.source, 'dispatcher');
    assert.equal(obj.event, 'crash');
    assert.equal(obj.data.code, 42);
  });

  it('defaults missing fields', () => {
    logEvent(config, {});
    const lines = readFileSync(config.paths.eventsLog, 'utf8').trim().split('\n');
    const obj = JSON.parse(lines[0]);
    assert.equal(obj.level, 'info');
    assert.equal(obj.source, 'system');
    assert.equal(obj.event, 'unknown');
    assert.deepEqual(obj.data, {});
  });
});
