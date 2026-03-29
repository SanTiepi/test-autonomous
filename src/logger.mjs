import { appendFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';

/**
 * Append one NDJSON event to the events log.
 * Also prints a human-friendly line to console.
 *
 * @param {object} config - Config object (needs config.paths.eventsLog)
 * @param {object} event  - {level, source, event, data}
 */
export function logEvent(config, event) {
  const now = new Date();
  const record = {
    ts: now.toISOString(),
    level: event.level || 'info',
    source: event.source || 'system',
    event: event.event || 'unknown',
    data: event.data ?? {},
  };

  const line = JSON.stringify(record) + '\n';

  // Write to file
  const logPath = config.paths.eventsLog;
  const dir = dirname(logPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  appendFileSync(logPath, line, 'utf8');

  // Console output: [HH:MM:SS] [SOURCE] event_name: summary
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');
  const summary = record.data.summary || record.data.reason || record.event;
  console.log(`[${hh}:${mm}:${ss}] [${record.source.toUpperCase()}] ${record.event}: ${summary}`);
}
