# MIL v0.2b — Context-First Protocol

## Principle

v0.1 compressed the message. v0.2 tried to eliminate it. v0.2b found the minimum viable signal.

**Experimentally proven minimum:** output format + absolute path. Nothing else.

## Experimental Evidence

| Version | Prompt | Response | Compliant | Correct scope | Duration |
|---------|--------|----------|-----------|---------------|----------|
| v0.2 (no constraint) | 5 tok | 300 tok | No | No | 21.5s |
| v0.1 (full MIL) | 80 tok | 70 tok | Yes | Yes | 13.6s |
| **v0.2b (sweet spot)** | **18 tok** | **18 tok** | **Yes** | **Yes** | **6.1s** |

**Key finding:** The model needs exactly 2 things in the prompt:
1. Expected output format (1 line)
2. Absolute path to target

Everything else (context, arguments, priority, identity, motivation) is noise the model can derive from reading the code itself.

## Architecture shift

### v0.1 (message-heavy)
```
[60 tokens: describe context] → agent reasons → [40 tokens: describe answer]
Total overhead: 100 tokens of TEXT about the code
```

### v0.2 (context-first)
```
[8 tokens: OP + TGT + OUT] → agent reads code via tools → [6 tokens: STATUS + DATA]
Total overhead: 14 tokens. Agent spends its budget on READING, not on being told.
```

## Format

### Request (minimal pointer)
```
<OP> <TGT> [<OUT>]
```

That's it. No CTX (the agent reads it). No ARG (the agent figures it out from the code). No PRI (the agent assesses risk itself). No ROOT (inferred from TGT being absolute or relative).

Examples:
```
REVIEW src/rate_limiter.mjs VERDICT
SEARCH src/ MAP
TEST tests/ PASS_FAIL
IMPLEMENT src/auth.mjs DONE
```

### Response (minimal signal)
```
<STATUS> [<DATA>]
```

Examples:
```
APPROVE
CHALLENGE unbounded_map→add_lru_cap
REJECT breaks_23_tests→revert
DONE 4f_created 12t_added
FAIL 3/83_tests src/index.mjs:42
MAP 4f 3dep 83t 5gaps
```

### When to add context

Only when the agent CANNOT read it:
- Cross-project reference: append absolute path
- Ephemeral state not in files: append inline
- Decision that has no code yet: append intent

Format: `<OP> <TGT> [<OUT>] | <context only if unreadable>`

```
REVIEW src/auth.mjs VERDICT | not_yet_written intent=jwt_middleware
```

## Agent definitions (machine-optimized)

### v0.1 (human)
```
You are a decision reviewer. Your job is to prevent bad decisions from cascading.
Focus on: correctness, maintainability, security, performance (in that order).
Be blunt. Don't soften bad news.
```

### v0.2 (machine)
```
ROLE review
TOOLS Read,Grep,Glob
OUT STATUS [DATA] [NEXT]
PRIORITY correctness>maintainability>security>performance
CONSTRAINT output_max=20_tokens
```

No identity. No motivation. No style guidance. The model knows how to review code — it doesn't need to be told it's a "senior reviewer."

## Adaptive thresholds

### v0.1 (fixed)
```
- 3 consecutive failures → change strategy
- 2 consecutive CHALLENGE → reassess
- Self-boost after 3x repetition
```

### v0.2 (data-driven)
```
THRESHOLD failure_streak = max(2, ceil(avg_streak_before_fix * 0.8))
THRESHOLD critic_reassess = max(1, ceil(historical_false_alarm_rate * invocations))
THRESHOLD self_boost = appears(pattern) >= 2 AND metric(relevant_kpi) < target(kpi)
```

Thresholds computed from `docs/metrics.jsonl`, not hardcoded.

## Scoring (machine-native)

### v0.1 (human school grades)
```
A (90+), B (75+), C (60+), D (40+), F (<40)
```

### v0.2 (efficiency vector)
```
SCORE = [task_velocity, token_efficiency, protocol_compliance, self_correction_rate, evolution_rate]
```

No single number. No letter grade. A 5-dimensional vector that the system optimizes along whichever axis has the most room for improvement.

Example:
```
[0.85, 0.72, 1.0, 0.90, 0.60]
       ^^^^                ^^^^
       lowest → next session focuses on token efficiency and evolution
```

## Token budget

| Format | Avg request tokens | Avg response tokens | Total |
|--------|-------------------|--------------------:|------:|
| Prose | 65 | 98 | 163 |
| MIL v0.1 | 45 | 40 | 85 |
| MIL v0.2 | 8 | 6 | 14 |

Target: **91% reduction vs prose, 84% vs v0.1** on message overhead. The saved tokens go to context (tool reads).

## Migration

v0.2 is not a replacement — it's an optimization layer. Agents that understand v0.2 use it. Agents that don't fall back to v0.1. The compliance auto-tuner handles the transition.

```
if (agent.understands_v02) → minimal pointer format
else if (agent.understands_v01) → MIL v0.1 with fields
else → prose fallback
```
