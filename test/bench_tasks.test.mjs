import { describe, it } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { groupTasksByChain, loadBenchmarkTasks, summarizeTaskKinds } from "../bench/lib/tasks.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const tasksDir = path.resolve(__dirname, "../bench/tasks");

describe("benchmark tasks", () => {
  it("loads 20 fixed tasks with the expected kind distribution", async () => {
    const tasks = await loadBenchmarkTasks(tasksDir);
    const counts = summarizeTaskKinds(tasks);

    assert.equal(tasks.length, 20);
    assert.deepEqual(counts, {
      bugfix: 8,
      refactor: 6,
      feature: 6,
    });
  });

  it("builds four chain groups of five tasks each", async () => {
    const tasks = await loadBenchmarkTasks(tasksDir);
    const groups = [...groupTasksByChain(tasks).entries()];

    assert.equal(groups.length, 4);
    for (const [, chainTasks] of groups) {
      assert.equal(chainTasks.length, 5);
      const indices = chainTasks.map((task) => task.chain_index);
      assert.deepEqual(indices, [1, 2, 3, 4, 5]);
    }
  });
});
