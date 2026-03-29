// codex_tools.mjs — Read-only file access tools for Codex to inspect the codebase.
// ZERO external dependencies. Uses node:fs/promises and node:path.

import { readFile, readdir } from 'node:fs/promises';
import { resolve, relative, join } from 'node:path';

/**
 * Resolve a user-supplied path inside repoRoot. Rejects anything outside.
 * @param {string} repoRoot
 * @param {string} userPath
 * @returns {string}
 */
function safePath(repoRoot, userPath) {
  const resolved = resolve(repoRoot, userPath);
  if (!resolved.startsWith(repoRoot)) throw new Error('Path outside repo');
  return resolved;
}

/** Directories to skip during traversal. */
const SKIP_DIRS = new Set(['.git', 'node_modules', '.orchestra', 'coverage']);

/** File extensions eligible for content search. */
const SEARCHABLE_EXTS = new Set(['.mjs', '.js', '.json', '.md', '.oir', '.txt', '.yml', '.yaml']);

/**
 * Returns the OpenAI-compatible tool definitions for the 3 read-only tools.
 * @returns {Array<object>}
 */
export function getToolDefinitions() {
  return [
    {
      type: 'function',
      name: 'list_files',
      description: 'List files in the repository. Returns repo-relative paths.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Directory path relative to repo root. Default: "."' },
          glob: { type: 'string', description: 'Optional glob filter like "*.mjs" or "**/*.test.mjs"' },
          limit: { type: 'number', description: 'Max files to return. Default: 50' },
        },
      },
    },
    {
      type: 'function',
      name: 'search_repo',
      description: 'Search file contents using grep. Returns matching lines with file:line format.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search pattern (regex supported)' },
          path: { type: 'string', description: 'Directory to search in. Default: "src"' },
          limit: { type: 'number', description: 'Max results. Default: 10' },
        },
        required: ['query'],
      },
    },
    {
      type: 'function',
      name: 'read_file',
      description: 'Read a file from the repository. Returns text content.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'File path relative to repo root' },
          startLine: { type: 'number', description: 'Start line (1-based). Default: 1' },
          endLine: { type: 'number', description: 'End line. Default: startLine+100' },
          maxBytes: { type: 'number', description: 'Max bytes to return. Default: from config' },
        },
        required: ['path'],
      },
    },
  ];
}

/**
 * Execute a tool call by name. Returns a string result.
 * @param {string} name - Tool name (list_files | search_repo | read_file)
 * @param {object} args - Tool arguments
 * @param {object} config - App config (needs paths.root, codexReadFileMaxBytes, codexSearchMaxResults)
 * @returns {Promise<string>}
 */
export async function executeToolCall(name, args, config) {
  const repoRoot = config.paths.root;
  const maxBytes = config.codexReadFileMaxBytes ?? 8192;
  const maxResults = config.codexSearchMaxResults ?? 10;

  switch (name) {
    case 'list_files': {
      const dir = safePath(repoRoot, args.path || '.');
      const limit = args.limit || 50;
      const entries = [];

      async function walk(d, depth) {
        if (depth > 3) return;
        const items = await readdir(d, { withFileTypes: true }).catch(() => []);
        for (const item of items) {
          if (entries.length >= limit) return;
          if (SKIP_DIRS.has(item.name)) continue;
          const full = join(d, item.name);
          const rel = relative(repoRoot, full);
          if (item.isDirectory()) {
            entries.push(rel + '/');
            await walk(full, depth + 1);
          } else {
            if (!args.glob || matchGlob(item.name, args.glob)) {
              entries.push(rel);
            }
          }
        }
      }

      await walk(dir, 0);
      return entries.slice(0, limit).join('\n');
    }

    case 'search_repo': {
      const searchPath = safePath(repoRoot, args.path || 'src');
      const limit = Math.min(args.limit || maxResults, maxResults);
      try {
        const results = [];
        await searchFiles(searchPath, args.query, results, limit, repoRoot);
        return results.join('\n') || '(no matches)';
      } catch {
        return '(search failed)';
      }
    }

    case 'read_file': {
      const filePath = safePath(repoRoot, args.path);
      const content = await readFile(filePath, 'utf8');
      const lines = content.split('\n');
      const start = Math.max(1, args.startLine || 1) - 1;
      const end = Math.min(lines.length, args.endLine || (start + 101));
      const slice = lines.slice(start, end).join('\n');
      return slice.slice(0, args.maxBytes || maxBytes);
    }

    default:
      return `Unknown tool: ${name}`;
  }
}

/**
 * Simple glob matching for file extensions.
 * @param {string} name - File name
 * @param {string} glob - Glob pattern
 * @returns {boolean}
 */
function matchGlob(name, glob) {
  if (glob.startsWith('*.')) return name.endsWith(glob.slice(1));
  if (glob.startsWith('**/*.')) return name.endsWith(glob.slice(3));
  return name.includes(glob);
}

/**
 * Recursively search files for a regex pattern.
 * @param {string} dir
 * @param {string} pattern
 * @param {string[]} results
 * @param {number} limit
 * @param {string} repoRoot
 */
async function searchFiles(dir, pattern, results, limit, repoRoot) {
  const re = new RegExp(pattern, 'i');
  const items = await readdir(dir, { withFileTypes: true }).catch(() => []);
  for (const item of items) {
    if (results.length >= limit) break;
    const full = join(dir, item.name);
    if (item.isDirectory()) {
      if (SKIP_DIRS.has(item.name)) continue;
      await searchFiles(full, pattern, results, limit, repoRoot);
    } else {
      const ext = item.name.lastIndexOf('.') >= 0 ? item.name.slice(item.name.lastIndexOf('.')) : '';
      if (!SEARCHABLE_EXTS.has(ext)) continue;
      try {
        const content = await readFile(full, 'utf8');
        const lines = content.split('\n');
        for (let i = 0; i < lines.length && results.length < limit; i++) {
          if (re.test(lines[i])) {
            results.push(`${relative(repoRoot, full)}:${i + 1}: ${lines[i].trim().slice(0, 120)}`);
          }
        }
      } catch { /* skip unreadable */ }
    }
  }
}
