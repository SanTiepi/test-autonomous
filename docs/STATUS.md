# Status

## Resume Point
1. Active: clean state — duo mode v2 operational, engine ready
2. Just completed: full protocol refonte + autonomous engine + context system
3. Next step: ENGINE-01 (continuous loop) or PROJ-02 (real external project)
4. Blockers: none
5. Key decision pending: run engine autonomously vs direct to real project

## What Works
- **Duo mode**: Codex (API, 3s) plans → Claude (IDE, 40s) executes → Codex reviews (3s) → log+memory
- **Context retrieval**: 20 modules indexed, targeted file selection (~4K tokens instead of full repo)
- **Transform log**: every change logged with hashes, symbols, test delta, duration
- **Project memory**: conventions, module map, recent decisions — persists across sessions
- **Autonomous engine**: detects highest-impact opportunity, proposes plan, ready for execution loop

## What Doesn't Work Yet
- Engine continuous loop not tested at scale
- No auto-rollback on regression (git stash exists but not wired to engine)
- Codex and Claude duplicate file reads (Codex reads via tools, Claude re-reads in IDE)
- Legacy Orchestra (watcher/subprocess) still in codebase — works but duo mode is superior

## Key Numbers
- 440 tests / 99 suites / 0 failures
- Duo cycle: ~47s per feature
- Real Claude CLI success rate: ~86% (but duo mode avoids CLI entirely = 100%)
- Codex API: ~3s per call, ~500 tokens average
- Total session cost: ~$0.35

## Protocol (current)
Codex→Claude: `FIX/FEAT/REFACTOR: ... | FILES: ... | DO: ... | TEST: ... | DONT: ... | CLASS: ...`
Claude→Codex: `DONE: ... | CHANGED: ... | TESTS: ... | RISK: ...`
Codex review: `VERDICT: approve|challenge|reject | REASON: ... | FIX: ...`
