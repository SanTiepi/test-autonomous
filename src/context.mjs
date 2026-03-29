// context.mjs — Intelligent context retrieval for duo mode.
// Builds minimal, targeted context for Codex (planner) and Claude (executor).
// Replaces "dump everything" with "retrieve what matters".

import { readFile, readdir, writeFile, stat } from 'node:fs/promises';
import { join, relative, dirname } from 'node:path';

// ── Project Memory ──
// Persistent facts about the project that don't change often.
// Updated after each completed task.

const MEMORY_FILE = '.orchestra/project_memory.json';

const DEFAULT_MEMORY = {
  architecture: {},    // module → purpose
  conventions: [],     // "always use node:test", "zero deps", etc.
  known_constraints: [], // "don't modify Orchestra files during product work"
  module_map: {},      // file → {exports, imports, lines, purpose}
  recent_decisions: [], // last 10 decisions with rationale
  updated_at: null,
};

export async function loadProjectMemory(root) {
  try {
    const raw = await readFile(join(root, MEMORY_FILE), 'utf8');
    return { ...DEFAULT_MEMORY, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_MEMORY };
  }
}

export async function saveProjectMemory(root, memory) {
  memory.updated_at = new Date().toISOString();
  const { mkdir } = await import('node:fs/promises');
  const dir = dirname(join(root, MEMORY_FILE));
  await mkdir(dir, { recursive: true });
  await writeFile(join(root, MEMORY_FILE), JSON.stringify(memory, null, 2));
}

export async function updateMemoryAfterTask(root, taskSummary, filesChanged) {
  const memory = await loadProjectMemory(root);

  // Update module map for changed files
  for (const file of filesChanged) {
    try {
      const content = await readFile(join(root, file), 'utf8');
      const lines = content.split('\n').length;
      const imports = [...content.matchAll(/import\s+.*from\s+['"]([^'"]+)['"]/g)].map(m => m[1]);
      const exports = [...content.matchAll(/export\s+(?:function|const|class|let|var|async\s+function)\s+(\w+)/g)].map(m => m[1]);
      memory.module_map[file] = { exports, imports, lines, updated: new Date().toISOString() };
    } catch { /* skip */ }
  }

  // Add decision
  memory.recent_decisions.push({
    task: taskSummary,
    files: filesChanged,
    at: new Date().toISOString(),
  });
  if (memory.recent_decisions.length > 10) memory.recent_decisions.shift();

  await saveProjectMemory(root, memory);
  return memory;
}

// ── Targeted Context Retrieval ──
// Given a task description, find the minimum set of files and line ranges needed.

export async function retrieveContext(root, task, options = {}) {
  const memory = await loadProjectMemory(root);
  const maxFiles = options.maxFiles ?? 5;
  const maxLinesPerFile = options.maxLinesPerFile ?? 100;

  // Step 1: Find relevant files by keyword matching
  const taskLower = task.toLowerCase();
  const keywords = taskLower.split(/\s+/).filter(w => w.length > 3);

  const scored = [];
  for (const [file, info] of Object.entries(memory.module_map)) {
    let score = 0;
    // File name match
    const fileLower = file.toLowerCase();
    for (const kw of keywords) {
      if (fileLower.includes(kw)) score += 3;
    }
    // Export name match
    for (const exp of (info.exports || [])) {
      for (const kw of keywords) {
        if (exp.toLowerCase().includes(kw)) score += 2;
      }
    }
    // Recently changed files get a boost
    if (info.updated) {
      const age = Date.now() - new Date(info.updated).getTime();
      if (age < 3600_000) score += 2; // last hour
      else if (age < 86400_000) score += 1; // last day
    }
    if (score > 0) scored.push({ file, score, info });
  }

  // Sort by relevance
  scored.sort((a, b) => b.score - a.score);
  const topFiles = scored.slice(0, maxFiles);

  // Step 2: If no memory hits, fall back to grep
  if (topFiles.length === 0) {
    // Search src/ and test/ for task keywords
    const srcDir = join(root, 'src');
    try {
      const files = await readdir(srcDir);
      for (const f of files.filter(f => f.endsWith('.mjs')).slice(0, maxFiles)) {
        const content = await readFile(join(srcDir, f), 'utf8');
        const contentLower = content.toLowerCase();
        let score = 0;
        for (const kw of keywords) {
          if (contentLower.includes(kw)) score++;
        }
        if (score > 0) topFiles.push({ file: `src/${f}`, score, info: {} });
      }
      topFiles.sort((a, b) => b.score - a.score);
    } catch { /* no src dir */ }
  }

  // Step 3: Load file contents (truncated)
  const context = [];
  for (const { file } of topFiles.slice(0, maxFiles)) {
    try {
      const content = await readFile(join(root, file), 'utf8');
      const lines = content.split('\n');
      const truncated = lines.length > maxLinesPerFile
        ? lines.slice(0, maxLinesPerFile).join('\n') + `\n... (${lines.length - maxLinesPerFile} more lines)`
        : content;
      context.push({ file, content: truncated, lines: lines.length });
    } catch { /* skip */ }
  }

  // Step 4: Include relevant conventions and constraints
  const relevantConstraints = memory.conventions.concat(memory.known_constraints);

  return {
    files: context,
    constraints: relevantConstraints,
    recent_decisions: memory.recent_decisions.slice(-3),
    token_estimate: context.reduce((sum, f) => sum + Math.ceil(f.content.length / 4), 0),
  };
}

// ── Build initial memory from repo scan ──

export async function buildInitialMemory(root) {
  const memory = { ...DEFAULT_MEMORY };
  const srcDir = join(root, 'src');

  try {
    const files = await readdir(srcDir);
    for (const f of files.filter(f => f.endsWith('.mjs'))) {
      const content = await readFile(join(srcDir, f), 'utf8');
      const lines = content.split('\n').length;
      const imports = [...content.matchAll(/import\s+.*from\s+['"]([^'"]+)['"]/g)].map(m => m[1]);
      const exports = [...content.matchAll(/export\s+(?:function|const|class|let|var|async\s+function)\s+(\w+)/g)].map(m => m[1]);
      memory.module_map[`src/${f}`] = { exports, imports, lines, updated: new Date().toISOString() };
    }
  } catch { /* no src */ }

  // Detect conventions from package.json and existing patterns
  try {
    const pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
    if (pkg.type === 'module') memory.conventions.push('ES modules (.mjs)');
    if (!pkg.dependencies || Object.keys(pkg.dependencies).length === 0) memory.conventions.push('Zero external dependencies');
    if (pkg.scripts?.test?.includes('node --test')) memory.conventions.push('Tests via node:test');
  } catch { /* no package.json */ }

  await saveProjectMemory(root, memory);
  return memory;
}
