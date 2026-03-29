import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import {
  normalizeTaskPayload,
  validateTaskCollection,
} from "./contracts.mjs";

export async function loadBenchmarkTasks(tasksDir) {
  const entries = await readdir(tasksDir, { withFileTypes: true });
  const jsonFiles = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) => entry.name)
    .sort();

  const tasks = [];
  for (const filename of jsonFiles) {
    const filePath = path.join(tasksDir, filename);
    const raw = await readFile(filePath, "utf8");
    const parsed = JSON.parse(raw);
    const fileTasks = normalizeTaskPayload(parsed);
    for (const task of fileTasks) {
      tasks.push(task);
    }
  }

  const validation = validateTaskCollection(tasks);
  if (!validation.valid) {
    throw new Error(`Invalid benchmark tasks: ${validation.errors.join(" | ")}`);
  }

  return tasks;
}

export function summarizeTaskKinds(tasks) {
  return tasks.reduce((acc, task) => {
    acc[task.kind] = (acc[task.kind] ?? 0) + 1;
    return acc;
  }, {});
}

export function groupTasksByChain(tasks) {
  const groups = new Map();
  for (const task of tasks) {
    if (!task.chain_group) continue;
    if (!groups.has(task.chain_group)) {
      groups.set(task.chain_group, []);
    }
    groups.get(task.chain_group).push(task);
  }

  for (const [key, value] of groups) {
    value.sort((left, right) => (left.chain_index ?? 0) - (right.chain_index ?? 0));
    groups.set(key, value);
  }

  return groups;
}
