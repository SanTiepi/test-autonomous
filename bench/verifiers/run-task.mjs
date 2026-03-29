import path from "node:path";
import { spawn } from "node:child_process";
import { pathToFileURL } from "node:url";
import { readFile } from "node:fs/promises";
import { loadBenchmarkTasks } from "../lib/tasks.mjs";
import { getTestFilesForModule } from "../lib/module_specs.mjs";
import { TASK_ASSERTIONS } from "./task_specs.mjs";

const args = parseArgs(process.argv.slice(2));
const workspace = path.resolve(args.workspace ?? ".");
const taskId = args.task;

if (!taskId) {
  throw new Error("--task is required");
}

const tasks = await loadBenchmarkTasks(path.resolve("bench/tasks"));
const task = tasks.find((item) => item.id === taskId);
if (!task) {
  throw new Error(`Unknown benchmark task ${taskId}`);
}

const baseTests = await runBaseTests(workspace, getTestFilesForModule(task.module));
if (!baseTests.ok) {
  console.error(JSON.stringify({ pass: false, phase: "base_tests", stdout: baseTests.stdout, stderr: baseTests.stderr }, null, 2));
  process.exit(1);
}

const modulePath = path.join(workspace, task.module);
const moduleUrl = `${pathToFileURL(modulePath).href}?t=${Date.now()}`;
const mod = await import(moduleUrl);
const source = await readFile(modulePath, "utf8");
const assertion = TASK_ASSERTIONS[task.id];
if (!assertion) {
  throw new Error(`No verifier for ${task.id}`);
}

await assertion({ mod, source, workspaceRoot: workspace, task });
console.log(JSON.stringify({ pass: true, task_id: task.id }, null, 2));

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

async function runBaseTests(workspace, files) {
  return new Promise((resolve) => {
    const child = spawn("node", ["--test", ...files], {
      cwd: workspace,
      stdio: ["ignore", "pipe", "pipe"],
      shell: false,
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk.toString(); });
    child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
    child.on("close", (code) => resolve({ ok: code === 0, stdout, stderr }));
    child.on("error", (error) => resolve({ ok: false, stdout, stderr: `${stderr}\n${error.message}` }));
  });
}
