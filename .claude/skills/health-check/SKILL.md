---
name: health-check
description: Run full project health check — tests, build, lint, git status. Use at session start or after major changes.
allowed-tools: Bash, Read, Grep, Glob
context: fork
agent: general-purpose
---

Run a complete health check on this project and report results.

## Steps
1. Check `package.json`, `Makefile`, `Cargo.toml`, or equivalent for available commands
2. Run test suite
3. Run build (if configured)
4. Run linter (if configured)
5. Check `git status` for uncommitted changes
6. Check for broken imports or missing dependencies

## Output format
```
HEALTH CHECK — $DATE

TESTS:   PASS (N) | FAIL (N/M) | NOT CONFIGURED
BUILD:   PASS | FAIL | NOT CONFIGURED
LINT:    PASS | FAIL (N issues) | NOT CONFIGURED
GIT:     clean | N uncommitted changes
DEPS:    ok | missing: [list]

OVERALL: HEALTHY | DEGRADED (reason) | BROKEN (reason)
```
