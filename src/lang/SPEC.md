# MIL — Machine Instruction Language v0.1

> A token-efficient, unambiguous format for LLM agent-to-agent communication.

## Why

JSON + English prose wastes tokens on syntax ({, }, quotes, whitespace) and ambiguity ("please consider maybe doing X"). Agents don't need politeness, hedging, or formatting — they need structured intent.

## Design Principles

1. **Token-minimal**: Every byte carries meaning. No syntax tax.
2. **Unambiguous**: One parse, one meaning. No interpretation needed.
3. **Typed**: Actions, targets, and constraints have fixed vocabularies.
4. **Extensible**: Project-specific ops register without breaking core.
5. **Measurable**: We track token savings vs JSON/prose for every message.

## Core Format

A MIL message is a sequence of typed fields, each on one line:

```
OP <action>
TGT <target>
ROOT <absolute project root — required when agents may run in different CWD>
CTX <compressed context>
ARG <key=value pairs>
OUT <expected output format>
PRI <0-9 priority>
```

### Field Reference

| Field | Required | Description | Example |
|-------|----------|-------------|---------|
| OP | yes | Action verb from closed vocabulary | `OP REVIEW`, `OP SEARCH`, `OP IMPLEMENT` |
| TGT | yes | What to act on | `TGT src/api/users.mjs` |
| CTX | no | Compressed context (prior state) | `CTX 23t_pass mid02_done` |
| ARG | no | Key=value parameters | `ARG depth=shallow focus=security` |
| OUT | no | Expected response format | `OUT VERDICT reason` |
| PRI | no | Priority 0(low)-9(critical) | `PRI 7` |

### OP Vocabulary (v0.1)

| OP | Meaning | Typical Agent |
|----|---------|---------------|
| REVIEW | Evaluate a decision/change | critic |
| SEARCH | Find code/files/patterns | scout |
| IMPLEMENT | Write/modify code | worker |
| TEST | Run and report test results | verify |
| REPORT | Generate status/metrics | any |
| DIAGNOSE | Investigate a failure | any |
| REFACTOR | Restructure without behavior change | worker |
| PLAN | Design an approach | planner |

### Response Format

```
STATUS <APPROVE|CHALLENGE|REJECT|DONE|FAIL|PARTIAL>
DATA <compressed result>
NEXT <suggested follow-up OP if any>
COST <tokens_used>
```

## Compression Rules

1. Drop articles (a, the, an)
2. Use snake_case identifiers, not sentences
3. Abbreviate common terms: `t`=tests, `f`=files, `fn`=function, `dep`=dependency
4. Numbers inline: `23t_pass` = "23 tests passing"
5. Chain with `/`: `review/security/api` = "review security of API"

## Example: Critic Review

### In MIL:
```
OP REVIEW
TGT rate_limiter.mjs
CTX 39t_pass mid02_impl no_dep_added
ARG focus=architecture,perf pattern=fixed_window
OUT VERDICT reason
PRI 5
```
(7 lines, ~45 tokens)

### Equivalent English prompt:
"You are a senior code reviewer. Please review the rate_limiter.mjs implementation. Context: we have 39 tests passing, MID-02 has been implemented, no new dependencies were added. Focus on architecture and performance. The pattern used is a fixed-window rate limiter. Please respond with your verdict and reasoning."
(~65 tokens)

### Equivalent JSON:
```json
{"op":"review","target":"rate_limiter.mjs","context":{"tests_passing":39,"task":"MID-02","deps_added":0},"args":{"focus":["architecture","perf"],"pattern":"fixed_window"},"output":"verdict_reason","priority":5}
```
(~55 tokens)

## Token Budget

| Format | Avg tokens/message | Overhead |
|--------|-------------------|----------|
| English prose | 65 | baseline |
| JSON | 55 | -15% |
| MIL | 45 | -31% |

Target: **30%+ token reduction** vs prose, **20%+ vs JSON**, with zero ambiguity loss.
