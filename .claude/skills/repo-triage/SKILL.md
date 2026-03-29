---
name: repo-triage
description: Quick triage of a repository — file structure, dependency graph, test coverage, architecture boundaries, potential issues
---
Analyze the current repository for a quick triage:
1. Run `src/devtools.mjs` analyzeRepo() to get file tree, dependency graph, exported symbols, and routes
2. Identify: total files, total test files, test-to-source ratio
3. Identify: circular dependencies, orphan files (no imports), oversized files (>300 lines)
4. Identify: missing test coverage (source files with no corresponding test)
5. Summarize: architecture layers (API routes, business logic, infrastructure, tests)
6. Output a structured report with: health score (0-100), issues found, recommendations
