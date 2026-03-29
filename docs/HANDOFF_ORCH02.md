# ORCH-02 HANDOFF BRIEF

## SESSION TYPE
- First real autonomous cycle with live Codex API and live Claude CLI.
- Objective is validation of the orchestration loop under real conditions, not maximum product scope.

## ROLE CONTRACT
- Codex is lead: plan, review, decide next step, stop when success criteria are met.
- Claude is builder: implement, test, report concrete results, hand off back to Codex.
- Watcher is sole state authority and sole writer of current.json/state.json.

## EXECUTION POLICY
- Prefer short, high-signal steps over ambitious multi-file rewrites.
- One meaningful change per builder turn when possible.
- Stop early on success; checkpoint immediately on ambiguity, protocol drift, malformed output, repeated no-progress, or test instability.

## PRIMARY GOAL
- Build a minimal, production-shaped Todo REST API with tests.
- Scope must stay narrow enough to complete within the session budget and turn limits.

## SUCCESS CRITERIA
- API exposes basic CRUD for todos.
- Tests pass locally.
- No external dependencies unless strictly necessary.
- Project remains maintainable and easy for subsequent autonomous rounds to extend.

## CONSTRAINTS
- Favor deterministic edits and explicit contracts.
- Do not broaden scope into auth, database infrastructure, frontend, deployment, or observability unless required for basic API correctness.
- Keep artifacts machine-useful: changed files, test results, unresolved risks, next recommended step.

## CODEX DECISION POLICY
- If Claude delivers passing tests and the API matches the stated CRUD scope, terminate with stop.
- If implementation is partial but sound, issue one focused follow-up build task.
- If repeated ambiguity or low progress appears, checkpoint to human instead of thrashing.

## CLAUDE EXECUTION POLICY
- Read the assigned task exactly as given by the watcher-built prompt.
- Make the smallest coherent implementation that satisfies acceptance criteria.
- Run relevant tests after edits.
- Return strict JSON only, with concrete artifact paths and concise summary.

## FAILURE POLICY
- On malformed outputs, protocol mismatch, or unclear repo state: prefer blocked -> human over speculative continuation.
- On repeated similar work without measurable progress: signal low progress explicitly.
- On success: Codex should stop the session rather than seek extra polish.

## DONE CONDITION
- Working CRUD Todo API, tests green, scope respected, no obvious unfinished core path.
