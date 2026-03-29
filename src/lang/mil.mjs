// MIL — Machine Instruction Language v0.1
// Token-efficient inter-agent communication codec

const CORE_OPS = [
  "REVIEW", "SEARCH", "IMPLEMENT", "TEST", "REPORT",
  "DIAGNOSE", "REFACTOR", "PLAN", "PATCH",
];

const VALID_OPS = new Set(CORE_OPS);

/**
 * Register a new OP at runtime. Returns true if added, false if already exists.
 * Use for organic vocabulary evolution — agents may invent OPs that become standard.
 * @param {string} op
 * @returns {boolean}
 */
export function registerOp(op) {
  const normalized = op.toUpperCase();
  if (VALID_OPS.has(normalized)) return false;
  VALID_OPS.add(normalized);
  return true;
}

/**
 * Get all registered OPs (core + runtime-added).
 * @returns {string[]}
 */
export function getOps() {
  return [...VALID_OPS];
}

const VALID_STATUS = new Set([
  "APPROVE", "CHALLENGE", "REJECT", "DONE", "FAIL", "PARTIAL",
]);

const FIELD_ORDER = ["OP", "TGT", "ROOT", "CTX", "ARG", "OUT", "PRI"];
const RESP_ORDER = ["STATUS", "DATA", "NEXT", "COST"];

/**
 * Parse a MIL message string into a structured object.
 * @param {string} raw — MIL-formatted string
 * @returns {{ op: string, tgt?: string, ctx?: string, arg?: Record<string,string>, out?: string, pri?: number }}
 */
export function decode(raw) {
  const lines = raw.trim().split("\n").map(l => l.trim()).filter(Boolean);
  const msg = {};

  for (const line of lines) {
    const spaceIdx = line.indexOf(" ");
    if (spaceIdx === -1) throw new Error(`MIL: malformed line: ${line}`);
    const field = line.slice(0, spaceIdx).toUpperCase();
    const value = line.slice(spaceIdx + 1);

    switch (field) {
      case "OP":
        if (!VALID_OPS.has(value)) throw new Error(`MIL: unknown OP: ${value}`);
        msg.op = value;
        break;
      case "TGT":
        msg.tgt = value;
        break;
      case "ROOT":
        msg.root = value;
        break;
      case "CTX":
        msg.ctx = value;
        break;
      case "ARG":
        msg.arg = parseArgs(value);
        break;
      case "OUT":
        msg.out = value;
        break;
      case "PRI":
        msg.pri = parseInt(value, 10);
        if (msg.pri < 0 || msg.pri > 9) throw new Error(`MIL: PRI must be 0-9`);
        break;
      default:
        throw new Error(`MIL: unknown field: ${field}`);
    }
  }

  if (!msg.op) throw new Error("MIL: OP is required");
  return msg;
}

/**
 * Parse a MIL response string.
 * @param {string} raw
 * @returns {{ status: string, data?: string, next?: string, cost?: number }}
 */
export function decodeResponse(raw) {
  const lines = raw.trim().split("\n").map(l => l.trim()).filter(Boolean);
  const resp = {};

  for (const line of lines) {
    const spaceIdx = line.indexOf(" ");
    if (spaceIdx === -1) throw new Error(`MIL: malformed response line: ${line}`);
    const field = line.slice(0, spaceIdx).toUpperCase();
    const value = line.slice(spaceIdx + 1);

    switch (field) {
      case "STATUS":
        if (!VALID_STATUS.has(value)) throw new Error(`MIL: unknown STATUS: ${value}`);
        resp.status = value;
        break;
      case "DATA":
        resp.data = value;
        break;
      case "NEXT":
        resp.next = value;
        break;
      case "COST":
        resp.cost = parseInt(value, 10);
        break;
      default:
        throw new Error(`MIL: unknown response field: ${field}`);
    }
  }

  if (!resp.status) throw new Error("MIL: STATUS is required");
  return resp;
}

/**
 * Encode a structured message into MIL format.
 * @param {{ op: string, tgt?: string, ctx?: string, arg?: Record<string,string>, out?: string, pri?: number }} msg
 * @returns {string}
 */
export function encode(msg) {
  if (!msg.op || !VALID_OPS.has(msg.op)) throw new Error(`MIL: invalid OP: ${msg.op}`);
  const lines = [`OP ${msg.op}`];
  if (msg.tgt) lines.push(`TGT ${msg.tgt}`);
  if (msg.root) lines.push(`ROOT ${msg.root}`);
  if (msg.ctx) lines.push(`CTX ${msg.ctx}`);
  if (msg.arg) lines.push(`ARG ${encodeArgs(msg.arg)}`);
  if (msg.out) lines.push(`OUT ${msg.out}`);
  if (msg.pri !== undefined) lines.push(`PRI ${msg.pri}`);
  return lines.join("\n");
}

/**
 * Encode a response into MIL format.
 * @param {{ status: string, data?: string, next?: string, cost?: number }} resp
 * @returns {string}
 */
export function encodeResponse(resp) {
  if (!resp.status || !VALID_STATUS.has(resp.status)) {
    throw new Error(`MIL: invalid STATUS: ${resp.status}`);
  }
  const lines = [`STATUS ${resp.status}`];
  if (resp.data) lines.push(`DATA ${resp.data}`);
  if (resp.next) lines.push(`NEXT ${resp.next}`);
  if (resp.cost !== undefined) lines.push(`COST ${resp.cost}`);
  return lines.join("\n");
}

/**
 * Estimate token count for a string (rough: 1 token ≈ 4 chars for English).
 * @param {string} text
 * @returns {number}
 */
export function estimateTokens(text) {
  return Math.ceil(text.length / 4);
}

/**
 * Compare token cost of MIL vs equivalent JSON and prose.
 * @param {{ mil: string, json: string, prose: string }} variants
 * @returns {{ mil: number, json: number, prose: number, savings_vs_prose: string, savings_vs_json: string }}
 */
export function benchmark(variants) {
  const mil = estimateTokens(variants.mil);
  const json = estimateTokens(variants.json);
  const prose = estimateTokens(variants.prose);
  return {
    mil, json, prose,
    savings_vs_prose: `${Math.round((1 - mil / prose) * 100)}%`,
    savings_vs_json: `${Math.round((1 - mil / json) * 100)}%`,
  };
}

// --- Internal helpers ---

function parseArgs(value) {
  const args = {};
  const pairs = value.split(/\s+/);
  for (const pair of pairs) {
    const eq = pair.indexOf("=");
    if (eq === -1) throw new Error(`MIL: malformed ARG pair: ${pair}`);
    args[pair.slice(0, eq)] = pair.slice(eq + 1);
  }
  return args;
}

function encodeArgs(obj) {
  return Object.entries(obj).map(([k, v]) => `${k}=${v}`).join(" ");
}
