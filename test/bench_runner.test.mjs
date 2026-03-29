import { describe, it } from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { runBenchmark } from "../bench/lib/runner.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const smokeReplay = path.resolve(__dirname, "../bench/replays/smoke.json");

describe("benchmark runner", () => {
  it("executes the local smoke benchmark with replay responses", async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), "orch-bench-smoke-"));
    try {
      const result = await runBenchmark({
        workspaceRoot: repoRoot,
        phase: "smoke",
        provider: "replay",
        replayFile: smokeReplay,
        outputDir: path.join(tempRoot, "run"),
      });

      assert.equal(result.results.length, 4);
      assert.ok(result.results.every((item) => item.pass));
      assert.equal(result.manifest.task_count, 2);
    } finally {
      await rm(tempRoot, { recursive: true, force: true });
    }
  });

  it("classifies out-of-scope edits before verification", async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), "orch-bench-oos-"));
    try {
      const replayPath = path.join(tempRoot, "bad-replay.json");
      await writeFile(replayPath, JSON.stringify({
        responses: [
          {
            task_id: "mil_bugfix_trim_register_op",
            variant: "source_raw",
            changes: [
              {
                path: "tests/mil.test.mjs",
                content: "bad change",
              },
            ],
          },
        ],
      }, null, 2));

      const result = await runBenchmark({
        workspaceRoot: repoRoot,
        phase: "a",
        provider: "replay",
        replayFile: replayPath,
        outputDir: path.join(tempRoot, "run"),
        taskIds: ["mil_bugfix_trim_register_op"],
        variantIds: ["source_raw"],
      });

      assert.equal(result.results.length, 1);
      assert.equal(result.results[0].pass, false);
      assert.equal(result.results[0].failure_class, "out_of_scope");
    } finally {
      await rm(tempRoot, { recursive: true, force: true });
    }
  });

  it("classifies verifier failures as tests_red", async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), "orch-bench-red-"));
    try {
      const replayPath = path.join(tempRoot, "red-replay.json");
      await writeFile(replayPath, JSON.stringify({
        responses: [
          {
            task_id: "mil_bugfix_trim_register_op",
            variant: "source_raw",
            operations: [
              {
                type: "replace_text",
                path: "src/lang/mil.mjs",
                find: "  const normalized = op.toUpperCase();",
                replace: "  const normalized = op.toUpperCase();",
              },
            ],
          },
        ],
      }, null, 2));

      const result = await runBenchmark({
        workspaceRoot: repoRoot,
        phase: "a",
        provider: "replay",
        replayFile: replayPath,
        outputDir: path.join(tempRoot, "run"),
        taskIds: ["mil_bugfix_trim_register_op"],
        variantIds: ["source_raw"],
      });

      assert.equal(result.results.length, 1);
      assert.equal(result.results[0].pass, false);
      assert.equal(result.results[0].failure_class, "tests_red");
    } finally {
      await rm(tempRoot, { recursive: true, force: true });
    }
  });
});
