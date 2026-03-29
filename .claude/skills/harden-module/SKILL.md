---
name: harden-module
description: Analyze a module for production-readiness gaps (memory leaks, unbounded growth, missing cleanup, missing caps) and fix them with tests.
allowed-tools: Read, Edit, Write, Grep, Glob, Bash, Agent
---

# /harden-module <target>

Harden a module for production readiness.

## Process

1. Read the target module
2. Spawn critic with:
   ```
   OP REVIEW
   TGT <target>
   ARG focus=security,perf,resilience risk=production_readiness
   OUT gaps_list
   PRI 7
   ```
3. For each gap identified:
   - Implement the fix
   - Add test coverage
4. Run full test suite
5. Report: gaps found, gaps fixed, tests added

## Common hardening patterns
- Unbounded Map/Set → add size cap + LRU eviction
- No cleanup → add setInterval reaper or per-access prune
- No timeout → add AbortController or socket.setTimeout
- No input validation → add boundary checks
- No error recovery → add try/catch with graceful degradation
