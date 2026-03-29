import path from "node:path";
import { runBenchmark } from "./lib/runner.mjs";

const args = parseArgs(process.argv.slice(2));
const workspaceRoot = path.resolve(args.workspaceRoot ?? process.cwd());

const result = await runBenchmark({
  workspaceRoot,
  phase: args.phase ?? "smoke",
  provider: args.provider ?? "replay",
  replayFile: args.replayFile ? path.resolve(args.replayFile) : undefined,
  outputDir: args.outputDir ? path.resolve(args.outputDir) : undefined,
  tasksDir: args.tasksDir ? path.resolve(args.tasksDir) : undefined,
  variantIds: splitCsv(args.variants),
  taskIds: splitCsv(args.tasks),
  model: args.model,
  apiKey: process.env.CODEX_API_KEY || process.env.OPENAI_API_KEY,
  baseUrl: args.baseUrl,
  timeoutMs: toNumber(args.timeoutMs, 120_000),
  verifyTimeoutMs: toNumber(args.verifyTimeoutMs, 60_000),
});

console.log(JSON.stringify({
  run_id: result.runId,
  output_dir: result.outputDir,
  ready_for_decision: result.summary.ready_for_decision,
  decision: result.summary.decision,
  variants: result.summary.variants,
}, null, 2));

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      parsed[key] = true;
      continue;
    }
    parsed[key] = next;
    index += 1;
  }
  return parsed;
}

function splitCsv(value) {
  if (!value || value === true) return [];
  return String(value).split(",").map((item) => item.trim()).filter(Boolean);
}

function toNumber(value, fallback) {
  if (value === undefined || value === true) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}
