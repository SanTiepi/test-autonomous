import path from "node:path";
import { writeFile } from "node:fs/promises";
import { analyzeResults } from "./lib/analyze.mjs";
import { readResultsFile } from "./lib/runner.mjs";

const args = parseArgs(process.argv.slice(2));
if (!args.results) {
  throw new Error("Usage: node bench/analyze.mjs --results <path/to/results.json> [--output <path>]");
}

const results = await readResultsFile(path.resolve(args.results));
const summary = analyzeResults(results);

if (args.output) {
  await writeFile(path.resolve(args.output), JSON.stringify(summary, null, 2));
}

console.log(JSON.stringify(summary, null, 2));

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
