import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

export const DEFAULTS = {
  pollIntervalMs: 500,
  aiTimeoutMs: 300_000,       // 5 min
  maxTurns: 40,
  maxNoProgress: 5,
  checkpointEvery: 6,
  budgetUsd: 5.0,
  claudeCmd: process.env.CLAUDE_CMD || 'claude',
  claudeMaxTurnsBuild: 20,     // internal iterations for build tasks (was 10, caused error_max_turns)
  claudeMaxTurnsReview: 5,     // internal iterations for review/verify tasks
  claudeLeanProfileEnabled: false,  // experimental: skip repo bootstrap context
  codexModel: 'gpt-5.4-mini',
  codexApiBase: 'https://api.openai.com',
  codexToolMode: 'read_only',     // 'off' | 'read_only'
  codexMaxToolCalls: 8,           // max tool invocations per Codex turn
  codexReadFileMaxBytes: 8192,    // max bytes per read_file call
  codexSearchMaxResults: 10,      // max results per search_repo call
  paths: {
    root: ROOT,
    currentFile: resolve(ROOT, 'current.json'),
    stateFile: resolve(ROOT, '.orchestra/state.json'),
    historyDir: resolve(ROOT, '.orchestra/history'),
    logsDir: resolve(ROOT, '.orchestra/logs'),
    approveFile: resolve(ROOT, '.orchestra/approve.json'),
    eventsLog: resolve(ROOT, '.orchestra/logs/events.ndjson'),
    activeSessionFile: resolve(ROOT, '.orchestra/active_session.json'),
  },
};

export function loadConfig(argv = [], env = {}) {
  const config = structuredClone(DEFAULTS);
  for (let i = 0; i < argv.length; i++) {
    switch (argv[i]) {
      case '--goal': config.goal = argv[++i]; break;
      case '--success': config.successCriteria = argv[++i]?.split(',') ?? []; break;
      case '--constraint': config.constraints = argv[++i]?.split(',') ?? []; break;
      case '--budget': config.budgetUsd = parseFloat(argv[++i]) || config.budgetUsd; break;
      case '--max-turns': config.maxTurns = parseInt(argv[++i], 10) || config.maxTurns; break;
      case '--model': config.codexModel = argv[++i] || config.codexModel; break;
      case '--claude-cmd': config.claudeCmd = argv[++i] || config.claudeCmd; break;
    }
  }
  if (env.CODEX_API_KEY) config.codexApiKey = env.CODEX_API_KEY;
  if (env.ORCHESTRA_BUDGET) config.budgetUsd = parseFloat(env.ORCHESTRA_BUDGET) || config.budgetUsd;
  return Object.freeze(config);
}
