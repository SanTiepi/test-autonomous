---
name: review-changes
description: Review all uncommitted changes for quality, correctness, and completeness. Use after implementing a feature before committing.
allowed-tools: Read, Grep, Glob, Bash
context: fork
agent: Plan
---

Review all uncommitted changes in this repository.

## Tool rules
- Use Bash ONLY for `git diff` and `git status` — nothing else.
- Use Grep/Glob/Read for all file search and reading operations.

## Steps
1. Run `git diff --stat` to see what files changed
2. Run `git diff` to see the actual changes
3. For each changed file, assess:
   - **Correctness**: Does the logic work? Edge cases handled?
   - **Security**: Any injection, auth bypass, or data leak risks?
   - **Tests**: Are changes covered by tests? Should new tests be added?
   - **Style**: Consistent with the rest of the codebase?

## Output format
```
VERDICT: LGTM | ISSUES FOUND

FILES REVIEWED: N

ISSUES:
  - [severity] file:line — description
  - ...

SUGGESTIONS:
  - file:line — optional improvement (not blocking)

SUMMARY: 1-2 sentences overall assessment
```

Severity levels: CRITICAL (must fix) | WARNING (should fix) | NOTE (nice to have)
