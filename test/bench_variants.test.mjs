import { describe, it } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadBenchmarkTasks } from "../bench/lib/tasks.mjs";
import { getVariants } from "../bench/lib/variants.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const tasksDir = path.resolve(__dirname, "../bench/tasks");

describe("benchmark variants", () => {
  it("render deterministically for the same task and workspace", async () => {
    const tasks = await loadBenchmarkTasks(tasksDir);
    const task = tasks.find((item) => item.id === "mil_bugfix_trim_register_op");
    const variants = getVariants();

    for (const variant of variants) {
      const first = await variant.render(task, { workspaceRoot: repoRoot });
      const second = await variant.render(task, { workspaceRoot: repoRoot });
      assert.equal(first, second, `${variant.id} should be deterministic`);
    }
  });

  it("render distinct representations of the same target", async () => {
    const tasks = await loadBenchmarkTasks(tasksDir);
    const task = tasks.find((item) => item.id === "mil_bugfix_trim_register_op");
    const [raw, structured, candidate] = getVariants();

    const rawView = await raw.render(task, { workspaceRoot: repoRoot });
    const structuredView = await structured.render(task, { workspaceRoot: repoRoot });
    const irView = await candidate.render(task, { workspaceRoot: repoRoot });

    assert.ok(rawView.includes("export function registerOp"));
    assert.ok(structuredView.includes("FUNC registerOp(op)"));
    assert.ok(irView.includes("IR_FUNC registerOp"));
  });
});
