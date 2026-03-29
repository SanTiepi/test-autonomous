import { getModuleSpec } from "../lib/module_specs.mjs";
import {
  extractExportedFunctions,
  extractTopLevelConstants,
  normalizeFunctionBody,
  readWorkspaceSource,
  renderLineRange,
  stableHash,
} from "../lib/source_utils.mjs";

const variant = {
  id: "source_structured",
  label: "Structured function cards",
  async render(task, repoState) {
    const source = await readWorkspaceSource(repoState.workspaceRoot, task.module);
    const spec = getModuleSpec(task.module);
    const functions = extractExportedFunctions(source);
    const topLevel = extractTopLevelConstants(source);
    const ordered = orderFunctions(functions, task.symbol);

    const cards = ordered.map((fn) => {
      const symbolSpec = spec.symbols[fn.name] ?? { effects: ["unknown"], invariants: [], tests: [] };
      return [
        `FUNC ${fn.name}(${fn.args}) lines:${renderLineRange(fn)}`,
        `effects: ${symbolSpec.effects.join(", ")}`,
        `invariants: ${symbolSpec.invariants.join(" | ") || "none declared"}`,
        `tests: ${symbolSpec.tests.join(" | ") || "none declared"}`,
        "body:",
        indent(normalizeFunctionBody(fn.body) || "(empty)"),
      ].join("\n");
    });

    return [
      `VARIANT source_structured`,
      `MODULE ${task.module}`,
      `LABEL ${spec.label}`,
      `DESCRIPTION ${spec.description}`,
      `TARGET_SYMBOL ${task.symbol}`,
      `SOURCE_HASH ${stableHash(source)}`,
      `TOP_LEVEL_CONSTANTS ${topLevel.join(", ")}`,
      `SHARED_INVARIANTS ${spec.sharedInvariants.join(" | ")}`,
      "",
      cards.join("\n\n"),
    ].join("\n");
  },
};

function indent(value) {
  return value.split("\n").map((line) => `  ${line}`).join("\n");
}

function orderFunctions(functions, target) {
  const sorted = [...functions];
  sorted.sort((left, right) => {
    if (left.name === target) return -1;
    if (right.name === target) return 1;
    return left.start - right.start;
  });
  return sorted;
}

export default variant;
