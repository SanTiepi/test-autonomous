---
name: eval-report
description: Generate a KPI evaluation report for the current session. Use at end of session or periodically to measure agent performance.
allowed-tools: Read, Grep, Glob, Bash
context: fork
agent: general-purpose
---

Generate a performance evaluation report for this autonomous agent session.

## Tool rules
- Use Bash ONLY for `git log` and `git diff --stat` — nothing else.
- Use Grep/Glob/Read for all file search and reading operations.

## Data collection

### 1. Task completion
- Read TASKS.md: count items in Active, Next Ready, Completed
- For completed items: extract timestamps if available
- Calculate: tasks_completed, tasks_remaining

### 2. Tool discipline
- Read .claude/settings.json or hook logs if available
- Search git diff for any Bash calls using `cat`, `find`, `grep`, `head`, `tail`, `sed`, `awk`
- Calculate: tool_violations (should be 0)

### 3. Critic usage
- Search for critic agent invocations in the session (grep for "critic:" in recent activity)
- If available: count APPROVE vs CHALLENGE vs REJECT
- Calculate: critic_invocations, challenge_rate

### 4. Test health
- Run `npm test` (or project test command) and capture result
- Calculate: tests_passing, tests_failing, tests_total

### 5. Self-boost activity
- Check .claude/agents/ for custom agents created this session
- Check .claude/skills/ for custom skills created this session
- Check .claude/settings.json for hooks added this session
- Check memory/MEMORY.md for new entries
- Calculate: agents_created, skills_created, hooks_added, memory_entries

### 6. Code output
- Run `git diff --stat HEAD~N` (where N = commits this session)
- Calculate: files_changed, lines_added, lines_removed

## Output format
```
═══════════════════════════════════════
  AGENT PERFORMANCE REPORT
  Session: $DATE
═══════════════════════════════════════

TASK COMPLETION
  Completed:  N
  Remaining:  N
  Throughput: N tasks/session

QUALITY
  Tests:           N passing / N total
  Tool violations: N (target: 0)
  Critic usage:    N invocations
  Challenge rate:  N% (target: 10-30%)

CODE OUTPUT
  Files changed:   N
  Lines added:     +N
  Lines removed:   -N

SELF-BOOST
  Agents created:  N
  Skills created:  N
  Hooks added:     N
  Memory entries:  N

OVERALL SCORE: [A/B/C/D/F]
  A: All tasks done, 0 violations, tests green, critic used appropriately
  B: Most tasks done, minor issues
  C: Partial progress, some violations
  D: Blocked, multiple issues
  F: Session produced no useful output

RECOMMENDATIONS:
  - [specific improvements for next session]
═══════════════════════════════════════
```

## Scoring rules
- Start at 100 points
- -10 per tool violation
- -20 per failing test at end of session
- -10 per critic trigger that was skipped (significant decision without critic)
- -5 per task started but not completed
- +5 per self-boost action (agent/skill/hook/memory created)
- +10 if all tasks completed
- A: 90+, B: 75+, C: 60+, D: 40+, F: <40
