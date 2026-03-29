import { readFile } from "node:fs/promises";
import path from "node:path";

export async function createReplayProvider({ replayFile }) {
  if (!replayFile) {
    throw new Error("Replay provider requires --replay-file");
  }

  const raw = await readFile(replayFile, "utf8");
  const parsed = JSON.parse(raw);
  const responses = Array.isArray(parsed.responses) ? parsed.responses : parsed;
  const index = new Map();

  for (const entry of responses) {
    const key = makeKey(entry.task_id, entry.variant, entry.chain_index ?? null);
    index.set(key, entry);
  }

  return {
    id: "replay",
    async generate({ task, variant, chainIndex, workspaceRoot }) {
      const key = makeKey(task.id, variant.id, chainIndex ?? null);
      const entry = index.get(key);
      if (!entry) {
        return {
          error: `No replay response for ${key}`,
          failure_class: "provider_error",
          runtime_ms: 0,
          tokens_in: 0,
          tokens_out: 0,
        };
      }

      if (entry.error) {
        return {
          error: entry.error,
          failure_class: entry.failure_class ?? "provider_error",
          runtime_ms: entry.runtime_ms ?? 0,
          tokens_in: entry.tokens_in ?? 0,
          tokens_out: entry.tokens_out ?? 0,
          raw: entry.raw ?? "",
        };
      }

      const edit = entry.changes
        ? { changes: entry.changes, notes: entry.notes ?? "" }
        : { changes: await resolveOperations(entry.operations ?? [], workspaceRoot), notes: entry.notes ?? "" };

      return {
        edit,
        raw: JSON.stringify(edit),
        runtime_ms: entry.runtime_ms ?? 0,
        tokens_in: entry.tokens_in ?? 0,
        tokens_out: entry.tokens_out ?? 0,
      };
    },
  };
}

async function resolveOperations(operations, workspaceRoot) {
  const resolved = [];
  for (const operation of operations) {
    if (operation.type === "overwrite") {
      resolved.push({ path: operation.path, content: operation.content });
      continue;
    }

    if (operation.type === "replace_text") {
      const fullPath = path.join(workspaceRoot, operation.path);
      const source = await readFile(fullPath, "utf8");
      if (!source.includes(operation.find)) {
        throw new Error(`Replay operation could not find text in ${operation.path}`);
      }
      resolved.push({
        path: operation.path,
        content: source.replace(operation.find, operation.replace),
      });
      continue;
    }

    throw new Error(`Unknown replay operation type: ${operation.type}`);
  }

  return resolved;
}

function makeKey(taskId, variantId, chainIndex) {
  return `${taskId}::${variantId}::${chainIndex ?? "na"}`;
}
