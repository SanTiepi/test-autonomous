import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

export async function readWorkspaceSource(workspaceRoot, relativePath) {
  return readFile(path.join(workspaceRoot, relativePath), "utf8");
}

export function stableHash(value) {
  return createHash("sha1").update(value).digest("hex").slice(0, 12);
}

export function extractExportedFunctions(source) {
  const functions = [];
  const pattern = /export function\s+([A-Za-z_$][\w$]*)\s*\(([^)]*)\)\s*\{/g;

  let match = null;
  while ((match = pattern.exec(source)) !== null) {
    const name = match[1];
    const args = match[2].trim();
    const start = match.index;
    const openBrace = pattern.lastIndex - 1;
    const end = findMatchingBrace(source, openBrace);
    const full = source.slice(start, end + 1);
    const body = source.slice(openBrace + 1, end);
    const startLine = source.slice(0, start).split("\n").length;
    functions.push({
      name,
      args,
      start,
      end,
      startLine,
      endLine: startLine + full.split("\n").length - 1,
      full,
      body,
    });
  }

  return functions;
}

export function getFunctionByName(source, name) {
  return extractExportedFunctions(source).find((item) => item.name === name) ?? null;
}

export function getSignificantLines(source) {
  return source
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !line.startsWith("//"))
    .filter((line) => !line.startsWith("*"))
    .filter((line) => !line.startsWith("/*"))
    .filter((line) => !line.startsWith("*/"));
}

export function normalizeFunctionBody(body) {
  return getSignificantLines(body)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .join("\n");
}

export function extractTopLevelConstants(source) {
  const names = [];
  const pattern = /^const\s+([A-Za-z_$][\w$]*)\s*=/gm;
  let match = null;
  while ((match = pattern.exec(source)) !== null) {
    names.push(match[1]);
  }
  return names;
}

export function renderLineRange(item) {
  return `${item.startLine}-${item.endLine}`;
}

function findMatchingBrace(source, openIndex) {
  let depth = 0;
  let inSingle = false;
  let inDouble = false;
  let inTemplate = false;
  let inLineComment = false;
  let inBlockComment = false;
  let escape = false;

  for (let index = openIndex; index < source.length; index++) {
    const char = source[index];
    const next = source[index + 1];

    if (inLineComment) {
      if (char === "\n") inLineComment = false;
      continue;
    }

    if (inBlockComment) {
      if (char === "*" && next === "/") {
        inBlockComment = false;
        index += 1;
      }
      continue;
    }

    if (escape) {
      escape = false;
      continue;
    }

    if (inSingle) {
      if (char === "\\") escape = true;
      else if (char === "'") inSingle = false;
      continue;
    }

    if (inDouble) {
      if (char === "\\") escape = true;
      else if (char === "\"") inDouble = false;
      continue;
    }

    if (inTemplate) {
      if (char === "\\") escape = true;
      else if (char === "`") inTemplate = false;
      continue;
    }

    if (char === "/" && next === "/") {
      inLineComment = true;
      index += 1;
      continue;
    }

    if (char === "/" && next === "*") {
      inBlockComment = true;
      index += 1;
      continue;
    }

    if (char === "'") {
      inSingle = true;
      continue;
    }

    if (char === "\"") {
      inDouble = true;
      continue;
    }

    if (char === "`") {
      inTemplate = true;
      continue;
    }

    if (char === "{") depth += 1;
    if (char === "}") depth -= 1;

    if (depth === 0) {
      return index;
    }
  }

  throw new Error("Could not find matching brace for exported function");
}
