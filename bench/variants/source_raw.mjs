import { readWorkspaceSource, stableHash } from "../lib/source_utils.mjs";

const variant = {
  id: "source_raw",
  label: "Raw JS source",
  async render(task, repoState) {
    const source = await readWorkspaceSource(repoState.workspaceRoot, task.module);
    return [
      `VARIANT source_raw`,
      `TARGET_FILE ${task.module}`,
      `TARGET_SYMBOL ${task.symbol}`,
      `SOURCE_HASH ${stableHash(source)}`,
      "",
      "SOURCE",
      source,
    ].join("\n");
  },
};

export default variant;
