import { getModuleSpec } from "../lib/module_specs.mjs";
import {
  extractExportedFunctions,
  normalizeFunctionBody,
  readWorkspaceSource,
  stableHash,
} from "../lib/source_utils.mjs";

const variant = {
  id: "candidate_ir",
  label: "Candidate semantic IR",
  async render(task, repoState) {
    const source = await readWorkspaceSource(repoState.workspaceRoot, task.module);
    const spec = getModuleSpec(task.module);
    const functions = extractExportedFunctions(source);
    const ordered = orderFunctions(functions, task.symbol);

    const blocks = ordered.map((fn) => {
      const symbolSpec = spec.symbols[fn.name] ?? { effects: ["unknown"], invariants: [], tests: [] };
      const bodyLines = normalizeFunctionBody(fn.body).split("\n").filter(Boolean);
      const pseudoOps = bodyLines.map((line, index) => `  b${String(index + 1).padStart(2, "0")} ${toPseudoOp(line)}`);
      return [
        `IR_FUNC ${fn.name}`,
        `  inputs (${fn.args || "-"})`,
        `  effects ${symbolSpec.effects.join(", ")}`,
        `  invariants ${symbolSpec.invariants.join(" | ") || "none"}`,
        `  tests ${symbolSpec.tests.join(" | ") || "none"}`,
        ...pseudoOps,
      ].join("\n");
    });

    return [
      `VARIANT candidate_ir`,
      `MODULE ${task.module}`,
      `TARGET_SYMBOL ${task.symbol}`,
      `MODULE_LABEL ${spec.label}`,
      `SOURCE_HASH ${stableHash(source)}`,
      "",
      blocks.join("\n\n"),
    ].join("\n");
  },
};

function orderFunctions(functions, target) {
  const sorted = [...functions];
  sorted.sort((left, right) => {
    if (left.name === target) return -1;
    if (right.name === target) return 1;
    return left.start - right.start;
  });
  return sorted;
}

function toPseudoOp(line) {
  const clean = line.replace(/;$/, "");

  const declaration = clean.match(/^(const|let)\s+([A-Za-z_$][\w$]*)\s*=\s*(.+)$/);
  if (declaration) {
    return `%${declaration[2]} = ${normalizeExpression(declaration[3])}`;
  }

  const ifReturn = clean.match(/^if\s*\((.+)\)\s*return\s+(.+)$/);
  if (ifReturn) {
    return `IF ${normalizeExpression(ifReturn[1])} THEN RETURN ${normalizeExpression(ifReturn[2])}`;
  }

  const ifThrow = clean.match(/^if\s*\((.+)\)\s*throw\s+(.+)$/);
  if (ifThrow) {
    return `IF ${normalizeExpression(ifThrow[1])} THEN THROW ${normalizeExpression(ifThrow[2])}`;
  }

  const branch = clean.match(/^if\s*\((.+)\)\s*(.+)$/);
  if (branch) {
    return `BRANCH ${normalizeExpression(branch[1])} => ${normalizeExpression(branch[2])}`;
  }

  const forLoop = clean.match(/^for\s*\((.+)\)$/);
  if (forLoop) {
    return `LOOP ${normalizeExpression(forLoop[1])}`;
  }

  const switchLine = clean.match(/^switch\s*\((.+)\)$/);
  if (switchLine) {
    return `SWITCH ${normalizeExpression(switchLine[1])}`;
  }

  const caseLine = clean.match(/^case\s+(.+):$/);
  if (caseLine) {
    return `CASE ${normalizeExpression(caseLine[1])}`;
  }

  if (clean === "default:") {
    return "CASE DEFAULT";
  }

  if (clean.startsWith("return ")) {
    return `RETURN ${normalizeExpression(clean.slice(7))}`;
  }

  if (clean === "return") {
    return "RETURN";
  }

  if (clean.startsWith("throw ")) {
    return `THROW ${normalizeExpression(clean.slice(6))}`;
  }

  if (clean.includes(".push(")) {
    return `MUTATE ${normalizeExpression(clean)}`;
  }

  if (clean.includes(".add(") || clean.includes(".set(")) {
    return `EFFECT ${normalizeExpression(clean)}`;
  }

  if (clean === "break" || clean === "continue") {
    return clean.toUpperCase();
  }

  return `STMT ${normalizeExpression(clean)}`;
}

function normalizeExpression(value) {
  return value.replace(/\s+/g, " ").trim();
}

export default variant;
