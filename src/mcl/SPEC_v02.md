# MCL v0.2 — Transformer-Native Code

> Not shorter code. Different code. Structured for how transformers reason.

## v0.1 was wrong

v0.1 was "JavaScript minus syntax noise." That's lipstick on a pig. The real question:

**If a transformer had to invent a programming language from scratch, what would it look like?**

## How transformers process code

1. **Attention is flat** — deeply nested code loses signal. Transformers attend best to flat sequences where each token relates to nearby tokens.
2. **Pattern matching is native** — transformers recognize patterns instantly. Repetitive structure is cheap; novel structure is expensive.
3. **State tracking is expensive** — following mutable variables through branches costs attention. Immutable data flow is free.
4. **Names carry semantics** — the model understands `clientIpMap` better than `m`. Good names reduce reasoning cost to zero.
5. **Position matters** — early tokens in a sequence get more attention weight. Put the important thing first.

## Core design: Pipe-Flow

Everything is a pipeline. Data flows left to right, top to bottom. No nesting, no mutation, no hidden state.

### The pipe operator `>`

```
input > transform > transform > output
```

Every line is a pipe. Every function is a transform in a pipe.

### Example: rate limiter

```mcl
-- rate_limiter
-- Limits requests per IP with LRU eviction

ipBuckets : Map

clientIp req =
  req.socket.remoteAddress
  ? req.headers.x-forwarded-for
  ? "unknown"

expired entry now = now >= entry.resetAt

cleanup now =
  ipBuckets > filter key,entry > not (expired entry now)

evictOldest =
  ipBuckets.size > 0 => ipBuckets > deleteFirst

newEntry now windowMs = { count: 0, resetAt: now + windowMs }

rateCheck ip now maxRequests windowMs maxClients =
  entry = ipBuckets.get ip
  | expired entry now   => ipBuckets > maybeEvict maxClients > set ip (newEntry now windowMs) > get ip
  | entry               => entry
  | _                   => ipBuckets > maybeEvict maxClients > set ip (newEntry now windowMs) > get ip
  entry.count + 1 > maxRequests => Reject (retryAfter entry now)
  | _ => Pass

retryAfter entry now = ceil ((entry.resetAt - now) / 1000)

maybeEvict maxClients map =
  map.size >= maxClients => map > evictOldest
  | _ => map

rateLimiter maxRequests=100 windowMs=60000 maxClients=10000 =
  handler > wrapAsync req res >
    now = Date.now
    ip = clientIp req
    random < 0.1 => cleanup now
    rateCheck ip now maxRequests windowMs maxClients
    | Reject seconds => res > status 429 > json { error: "Too many requests", retryAfter: seconds }
    | Pass           => handler req res
```

## What changed from v0.1

| v0.1 | v0.2 | Why |
|------|------|-----|
| `->` (overloaded 4x) | `=` for definition, `>` for pipe, `=>` for branch | 1 symbol = 1 meaning |
| `\|` (collision with bitwise) | `\|` only for pattern matching (like Haskell/Rust) | No ambiguity |
| Mutable by default | **Immutable by default** | Transformers reason better on data flow |
| Imperative (`if/for`) | **Declarative** (`filter/map/match`) | Pattern matching > control flow |
| Indentation = scope | **Pipe = scope** — each `>` is a step | Flat sequences > deep nests |
| `_` prefix = private | No visibility — module boundary = privacy | Less convention, more structure |

## Grammar (simplified BNF)

```
program     = definition*
definition  = name params? "=" body
params      = name ("=" default)?  (space name ("=" default)?)*
body        = pipe | match | literal
pipe        = expr (">" expr)*
match       = ("|" pattern "=>" body)*
expr        = name args? | literal | "(" pipe ")"
pattern     = literal | name | "_"
literal     = number | string | record
record      = "{" (name ":" expr)* "}"
comment     = "--" text
```

## Key properties

### 1. Flat attention
Maximum nesting depth in v0.2: **2** (a match inside a pipe). JS equivalent often goes 5-8 levels deep. Every level of nesting costs transformer attention.

### 2. Left-to-right data flow
```
input > step1 > step2 > step3
```
The transformer reads this linearly. No jumping back to find where a variable was defined. The data IS the left side.

### 3. Pattern matching over conditionals
```mcl
rateCheck result
| Reject seconds => handleReject
| Pass           => handlePass
```
vs JS:
```javascript
if (result.type === 'reject') { handleReject(result.seconds); }
else if (result.type === 'pass') { handlePass(); }
```
Pattern matching is what transformers DO. It's their native operation.

### 4. Names as documentation
```mcl
expired entry now = now >= entry.resetAt
```
The function name IS the comment. No `// Check if entry has expired` needed.

### 5. Composition over mutation
```mcl
ipBuckets > maybeEvict maxClients > set ip (newEntry now windowMs) > get ip
```
Each `>` returns a new state. No `ipBuckets.set(ip, entry)` mutation. The pipe IS the transformation chain.

## Token comparison

| Metric | JS | MCL v0.1 | MCL v0.2 |
|--------|-----|----------|----------|
| Lines | 52 | 25 | 30 |
| Est. tokens | 234 | 131 | ~100 |
| Max nesting | 6 | 4 | 2 |
| Mutations | 5 | 5 | 0 |
| Noise % | ~40% | ~15% | ~5% |

## Transpilation targets

MCL v0.2 transpiles to:
- **JavaScript** (primary) — pipes become function chains, matches become switch/if
- **Python** — natural fit for the declarative style
- **Rust** — pattern matching is native, pipes map to method chains

## This is not just about tokens

The real metric is **reasoning cost per function**. A transformer reading v0.2 code:
- Sees flat pipes → attention is efficient
- Sees pattern matches → uses its strongest capability
- Sees immutable data flow → no state tracking needed
- Sees descriptive names → meaning is immediate

The hypothesis: **code written in v0.2 will produce fewer bugs when generated by an LLM**, because the language structure aligns with how the model reasons.

This is testable. Write the same logic in JS and MCL v0.2, ask Claude to find bugs in both. Measure accuracy.
