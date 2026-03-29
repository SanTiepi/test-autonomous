// fake-codex-server.mjs — Simulates the OpenAI /v1/responses endpoint for testing.
// Exports: startFakeCodex(port) → {server, url, setMode(mode), close()}

import http from 'node:http';

const VALID_ENVELOPE = JSON.stringify({
  status: 'completed',
  summary: 'planned next phase',
  artifacts: [],
  made_progress: true,
  fingerprint_basis: 'architecture decision',
  next: {
    target: 'claude',
    kind: 'build',
    instruction: 'implement the auth module',
    acceptance_criteria: ['tests pass', 'no external deps'],
    artifacts_expected: ['src/auth.mjs'],
  },
  meta_feedback: {
    prompt_quality: 4,
    redundant_fields: ['constraints'],
    missing_context: ['current test count'],
    optimization_notes: 'reduce rolling summary size',
  },
});

const DONE_ENVELOPE = JSON.stringify({
  status: 'completed',
  summary: 'goal fully achieved',
  artifacts: ['src/auth.mjs'],
  made_progress: true,
  fingerprint_basis: 'all tests pass final',
  next: {
    target: 'stop',
    kind: 'stop',
    instruction: 'all success criteria met',
    acceptance_criteria: [],
    artifacts_expected: [],
  },
  meta_feedback: {
    prompt_quality: 5,
    redundant_fields: [],
    missing_context: [],
    optimization_notes: 'none',
  },
});

const STOP_IMMEDIATE_ENVELOPE = JSON.stringify({
  status: 'completed',
  summary: 'stopping immediately',
  artifacts: [],
  made_progress: true,
  fingerprint_basis: 'immediate stop',
  next: {
    target: 'stop',
    kind: 'stop',
    instruction: 'done',
    acceptance_criteria: [],
    artifacts_expected: [],
  },
  meta_feedback: {
    prompt_quality: 4,
    redundant_fields: [],
    missing_context: [],
    optimization_notes: 'none',
  },
});

function makeSuccessBody(envelopeText = VALID_ENVELOPE) {
  return JSON.stringify({
    id: 'resp_001',
    output: [
      {
        type: 'message',
        content: [{ type: 'output_text', text: envelopeText }],
      },
    ],
    usage: { input_tokens: 100, output_tokens: 200, total_tokens: 300 },
  });
}

/**
 * Start a fake Codex server on the given port (0 = random).
 * @param {number} [port=0]
 * @returns {Promise<{server: http.Server, url: string, setMode: function, close: function}>}
 */
export function startFakeCodex(port = 0) {
  let mode = 'success';
  let requestCount = 0;

  const server = http.createServer((req, res) => {
    // Collect request body (we don't use it but need to drain it)
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      requestCount++;
      switch (mode) {
        case 'success': {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(makeSuccessBody());
          break;
        }

        case 'done': {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(makeSuccessBody(DONE_ENVELOPE));
          break;
        }

        case 'stop_immediate': {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(makeSuccessBody(STOP_IMMEDIATE_ENVELOPE));
          break;
        }

        case 'malformed': {
          const malformed = JSON.stringify({
            id: 'resp_002',
            output: [
              {
                type: 'message',
                content: [{ type: 'output_text', text: 'not valid json {{{' }],
              },
            ],
            usage: { input_tokens: 50, output_tokens: 10, total_tokens: 60 },
          });
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(malformed);
          break;
        }

        case 'slow': {
          // Respond after 10 seconds
          setTimeout(() => {
            if (!res.writableEnded) {
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(makeSuccessBody());
            }
          }, 10_000);
          break;
        }

        case 'error_500': {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: { message: 'Internal server error', type: 'server_error' } }));
          break;
        }

        case 'quota': {
          res.writeHead(429, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: { message: 'You exceeded your current quota', type: 'insufficient_quota', code: 'insufficient_quota' } }));
          break;
        }

        case 'rate_limit': {
          res.writeHead(429, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: { message: 'Rate limit exceeded', type: 'rate_limit_exceeded', code: 'rate_limit_exceeded' } }));
          break;
        }

        case 'auth_error': {
          res.writeHead(401, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: { message: 'Invalid API key', type: 'invalid_request_error', code: 'invalid_api_key' } }));
          break;
        }

        case 'error_500_then_ok': {
          // First request fails, subsequent succeed
          if (requestCount <= 1) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: { message: 'Temporary failure', type: 'server_error' } }));
          } else {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(makeSuccessBody());
          }
          break;
        }

        case 'over_budget': {
          const bigUsage = JSON.stringify({
            id: 'resp_003',
            output: [
              {
                type: 'message',
                content: [{ type: 'output_text', text: VALID_ENVELOPE }],
              },
            ],
            usage: { input_tokens: 500_000, output_tokens: 100_000, total_tokens: 600_000 },
          });
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(bigUsage);
          break;
        }

        default: {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(makeSuccessBody());
          break;
        }
      }
    });
  });

  return new Promise((resolve, reject) => {
    server.listen(port, '127.0.0.1', () => {
      const addr = server.address();
      const url = `http://127.0.0.1:${addr.port}`;
      resolve({
        server,
        url,
        setMode(m) { mode = m; },
        getRequestCount() { return requestCount; },
        close() {
          return new Promise((res) => {
            server.close(() => res());
          });
        },
      });
    });
    server.on('error', reject);
  });
}
