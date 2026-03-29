import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  assertPhase,
  createEmptyRunResult,
  validateEditResponse,
  validateRunResult,
} from "./contracts.mjs";
import { analyzeResults } from "./analyze.mjs";
import { createFixtureWorkspace } from "./fixtures.mjs";
import { buildBenchmarkPrompt } from "./prompt.mjs";
import { createProvider } from "./providers.mjs";
import { groupTasksByChain, loadBenchmarkTasks } from "./tasks.mjs";
import { getVariants } from "./variants.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_BENCH_ROOT = path.resolve(__dirname, "..");

export async function runBenchmark(options) {
  assertPhase(options.phase);

  const tasksDir = options.tasksDir ?? path.join(DEFAULT_BENCH_ROOT, "tasks");
  const tasks = await loadBenchmarkTasks(tasksDir);
  const selectedTasks = selectTasks(tasks, options.phase, options.taskIds ?? []);
  const variants = getVariants(resolveVariantIds(options.phase, options.variantIds ?? []));
  const provider = await createProvider(options);
  const runId = options.runId ?? `bench_${Date.now()}`;
  const outputDir = options.outputDir ?? path.join(options.workspaceRoot, ".orchestra", "bench", "runs", runId);

  await mkdir(outputDir, { recursive: true });

  const results = options.phase === "b"
    ? await runChains({ options, tasks: selectedTasks, variants, provider, outputDir })
    : await runSingles({ options, tasks: selectedTasks, variants, provider, outputDir });

  for (const result of results) {
    const validation = validateRunResult(result);
    if (!validation.valid) {
      throw new Error(`Invalid run result for ${result.task_id}: ${validation.errors.join(", ")}`);
    }
  }

  const manifest = {
    run_id: runId,
    created_at: new Date().toISOString(),
    phase: options.phase,
    provider: provider.id,
    model: options.model ?? (provider.id === "openai" ? "gpt-5.4-mini" : "replay"),
    task_count: selectedTasks.length,
    variant_ids: variants.map((variant) => variant.id),
  };
  const summary = analyzeResults(results);

  await writeFile(path.join(outputDir, "manifest.json"), JSON.stringify(manifest, null, 2));
  await writeFile(path.join(outputDir, "results.json"), JSON.stringify(results, null, 2));
  await writeFile(path.join(outputDir, "summary.json"), JSON.stringify(summary, null, 2));

  return { runId, outputDir, manifest, results, summary };
}

async function runSingles({ options, tasks, variants, provider, outputDir }) {
  const results = [];

  for (const task of tasks) {
    for (const variant of variants) {
      const fixtureRoot = await createFixtureWorkspace({
        workspaceRoot: options.workspaceRoot,
        destinationRoot: outputDir,
        fixtureName: `${task.id}__${variant.id}`,
      });

      const result = await executeTask({
        options,
        task,
        variant,
        provider,
        workspaceRoot: fixtureRoot,
        phase: options.phase,
        chainIndex: null,
      });
      results.push(result);
    }
  }

  return results;
}

async function runChains({ options, tasks, variants, provider, outputDir }) {
  const results = [];
  const groups = [...groupTasksByChain(tasks).entries()];

  for (const [chainGroup, chainTasks] of groups) {
    for (const variant of variants) {
      const fixtureRoot = await createFixtureWorkspace({
        workspaceRoot: options.workspaceRoot,
        destinationRoot: outputDir,
        fixtureName: `${chainGroup}__${variant.id}`,
      });

      for (const task of chainTasks) {
        const result = await executeTask({
          options,
          task,
          variant,
          provider,
          workspaceRoot: fixtureRoot,
          phase: "b",
          chainIndex: task.chain_index ?? null,
        });
        results.push(result);
        if (!result.pass) break;
      }
    }
  }

  return results;
}

async function executeTask({ options, task, variant, provider, workspaceRoot, phase, chainIndex }) {
  const promptContext = await variant.render(task, { workspaceRoot });
  const prompt = buildBenchmarkPrompt({ task, variant, promptContext });
  const model = options.model ?? (provider.id === "openai" ? "gpt-5.4-mini" : "replay");

  const baseResult = createEmptyRunResult({
    task_id: task.id,
    variant: variant.id,
    model,
    chain_index: chainIndex,
    phase,
  });

  const generation = await provider.generate({
    prompt,
    task,
    variant,
    chainIndex,
    workspaceRoot,
  });

  if (generation.error) {
    return {
      ...baseResult,
      runtime_ms: generation.runtime_ms ?? 0,
      tokens_in: generation.tokens_in ?? 0,
      tokens_out: generation.tokens_out ?? 0,
      failure_class: generation.failure_class ?? "provider_error",
      raw: generation.raw ?? generation.error,
    };
  }

  const validation = validateEditResponse(generation.edit);
  if (!validation.valid) {
    return {
      ...baseResult,
      runtime_ms: generation.runtime_ms ?? 0,
      tokens_in: generation.tokens_in ?? 0,
      tokens_out: generation.tokens_out ?? 0,
      failure_class: "parse",
      raw: generation.raw ?? "",
      details: validation.errors.join(", "),
    };
  }

  try {
    await applyChanges(workspaceRoot, task, generation.edit.changes);
  } catch (error) {
    return {
      ...baseResult,
      runtime_ms: generation.runtime_ms ?? 0,
      tokens_in: generation.tokens_in ?? 0,
      tokens_out: generation.tokens_out ?? 0,
      failure_class: error.code === "OUT_OF_SCOPE" ? "out_of_scope" : "apply_error",
      raw: generation.raw ?? "",
      details: error.message,
    };
  }

  const verification = await runVerifyCommand(task.verify_command, workspaceRoot, options.verifyTimeoutMs ?? 60_000);
  if (!verification.ok) {
    return {
      ...baseResult,
      runtime_ms: generation.runtime_ms ?? 0,
      tokens_in: generation.tokens_in ?? 0,
      tokens_out: generation.tokens_out ?? 0,
      failure_class: verification.timeout
        ? "timeout"
        : (phase === "b" && chainIndex && chainIndex > 1 ? "chain_corruption" : "tests_red"),
      raw: generation.raw ?? "",
      details: verification.stderr || verification.stdout,
    };
  }

  return {
    ...baseResult,
    pass: true,
    runtime_ms: generation.runtime_ms ?? 0,
    tokens_in: generation.tokens_in ?? 0,
    tokens_out: generation.tokens_out ?? 0,
    raw: generation.raw ?? "",
  };
}

async function applyChanges(workspaceRoot, task, changes) {
  const allowedPaths = new Set(task.allowed_paths ?? [task.module]);
  for (const change of changes) {
    if (!allowedPaths.has(change.path)) {
      const error = new Error(`Change outside allowed paths: ${change.path}`);
      error.code = "OUT_OF_SCOPE";
      throw error;
    }
    const fullPath = path.join(workspaceRoot, change.path);
    await mkdir(path.dirname(fullPath), { recursive: true });
    await writeFile(fullPath, change.content);
  }
}

async function runVerifyCommand(command, cwd, timeoutMs) {
  const tokens = tokenizeCommand(command);
  const executable = tokens[0];
  const args = tokens.slice(1);

  return new Promise((resolve) => {
    const child = spawn(executable, args, {
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
      shell: false,
    });

    let stdout = "";
    let stderr = "";
    let timeout = false;

    const timer = setTimeout(() => {
      timeout = true;
      child.kill("SIGTERM");
      setTimeout(() => {
        try {
          child.kill("SIGKILL");
        } catch {}
      }, 250);
    }, timeoutMs);

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ ok: !timeout && code === 0, code, stdout, stderr, timeout });
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      resolve({ ok: false, code: 1, stdout, stderr: `${stderr}\n${error.message}`, timeout });
    });
  });
}

function tokenizeCommand(command) {
  const parts = command.match(/"[^"]*"|\S+/g) ?? [];
  return parts.map((part) => part.replace(/^"(.*)"$/, "$1"));
}

function resolveVariantIds(phase, requested) {
  if (requested.length > 0) return requested;
  if (phase === "smoke") return ["source_raw", "source_structured"];
  return ["source_raw", "source_structured", "candidate_ir"];
}

function selectTasks(tasks, phase, requestedIds) {
  if (requestedIds.length > 0) {
    const wanted = new Set(requestedIds);
    return tasks.filter((task) => wanted.has(task.id));
  }

  if (phase === "smoke") {
    const smokeIds = new Set(["mil_bugfix_trim_register_op", "compliance_bugfix_empty_check"]);
    return tasks.filter((task) => smokeIds.has(task.id));
  }

  return tasks;
}

export async function readResultsFile(filePath) {
  const raw = await readFile(filePath, "utf8");
  return JSON.parse(raw);
}
