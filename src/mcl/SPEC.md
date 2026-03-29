# MCL — Machine Code Language v0.1

> A programming language designed for LLMs to write, read, and reason about — not for humans.

## Why

Every programming language was designed for humans typing on keyboards in the 1970s-2020s. Syntax choices optimize for:
- Human readability (verbose keywords: `function`, `return`, `export`)
- Human typing speed (short operators: `+=`, `=>`, `??`)
- Human error prevention (braces, semicolons, type annotations)

None of these matter for LLMs. What matters:
- **Token density** — fewer tokens per unit of logic
- **Reasoning clarity** — structure that helps the model think, not parse
- **Diff locality** — changes are small and don't cascade
- **Self-evidence** — code that doesn't need comments

## Design Principles

1. **1 concept = 1 token** (or as close as possible)
2. **Implicit over explicit** when unambiguous (no `return`, no `export default`)
3. **Structure over syntax** — indentation and position convey meaning, not symbols
4. **Names are semantic** — the name IS the documentation
5. **Transpiles to JS** — MCL is a reasoning language, JS is the execution target

## Syntax

### Functions
```
JS:   export function createRateLimiter({ maxRequests = 100, windowMs = 60000 } = {}) {
MCL:  createRateLimiter maxRequests=100 windowMs=60000 ->
```

- Name first (it's what matters)
- Parameters inline with defaults
- `->` signals "this produces something"
- No braces. Indentation defines scope.
- Exported by default. `_` prefix = private.

### Variables
```
JS:   const clients = new Map();
MCL:  clients: Map
```

- Name: Type. That's it.
- Mutable by default (LLMs track state better than humans think)
- `!` suffix = immutable: `pi!: 3.14159`

### Conditionals
```
JS:   if (!entry || now >= entry.resetAt) { entry = { count: 0, resetAt: now + windowMs }; }
MCL:  entry expired? -> entry = {count:0 resetAt:now+windowMs}
```

- `?` = condition test
- No `if` keyword — the `?` IS the conditional
- No braces — single-line for simple cases

### Loops
```
JS:   for (const [ip, entry] of clients) { if (now >= entry.resetAt) clients.delete(ip); }
MCL:  clients each ip,entry -> entry.resetAt<=now? clients.del ip
```

- `each` = iterate
- Inline condition with `?`

### Maps/Objects
```
JS:   { count: 0, resetAt: now + windowMs }
MCL:  {count:0 resetAt:now+windowMs}
```

- No commas. Space-separated.
- No quotes on keys.

### Closures / Higher-order
```
JS:   return function wrapWithRateLimit(handler) { return async function(req, res) { ... } }
MCL:  -> wrap handler ->async req,res ->
```

- `->` chains naturally
- `async` is an annotation, not a keyword wrapping the function

### Error handling
```
JS:   try { ... } catch (e) { ... }
MCL:  attempt -> ... fail e -> ...
```

- `attempt`/`fail` instead of `try`/`catch`
- Still indentation-scoped

## Token Comparison

### rate_limiter.mjs — JS vs MCL

JS (52 lines, ~180 tokens):
```javascript
import { randomUUID } from "node:crypto";
export function createRateLimiter({ maxRequests = 100, windowMs = 60000, maxClients = 10000 } = {}) {
  const clients = new Map();
  function getClientIp(req) {
    return req.socket?.remoteAddress || req.headers?.["x-forwarded-for"] || "unknown";
  }
  // ... 40 more lines
}
```

MCL (~25 lines, ~90 tokens):
```
use crypto.randomUUID

createRateLimiter maxRequests=100 windowMs=60000 maxClients=10000 ->
  clients: Map

  _clientIp req -> req.socket?.remoteAddress | req.headers.x-forwarded-for | "unknown"

  _cleanup now -> clients each ip,entry -> entry.resetAt<=now? clients.del ip

  _evictOldest -> clients.keys.next.value? clients.del it

  -> wrap handler ->async req,res ->
    now: Date.now
    ip: _clientIp req

    random<0.1? _cleanup now

    entry: clients.get ip
    entry expired? ->
      !entry & clients.size>=maxClients? _evictOldest
      entry = {count:0 resetAt:now+windowMs}
      clients.set ip entry

    entry.count++

    entry.count>maxRequests? ->
      retryAfter: ceil((entry.resetAt-now)/1000)
      res.writeHead 429 {"content-type":"application/json" "retry-after":str(retryAfter)}
      res.end json({error:"Too many requests" retryAfter})
      <-

    handler req res
```

**Estimated savings: ~50% fewer tokens for identical logic.**

## Transpilation

MCL → JS is straightforward:
- Add `export` to non-`_` prefixed functions
- Add `const`/`let` to variable declarations
- Convert `->` to `function` / `=>`
- Add braces and semicolons
- Convert `?` to `if`
- Convert `each` to `for...of`

The transpiler is a simple line-by-line rewriter, not a complex parser.

## What MCL is NOT

- NOT a replacement for JavaScript in production
- NOT meant for humans to read (though it's not illegible)
- It's the language Claude thinks in, transpiled to JS for execution
- It's how agents communicate code changes: "change line 15 to `entry.count>maxRequests?`" is clearer than the JS equivalent

## Next Steps

1. Build a tokenizer comparison tool (MCL vs JS vs Python for same logic)
2. Build the MCL → JS transpiler
3. Rewrite one module in MCL, transpile, verify tests still pass
4. Measure: does writing in MCL reduce errors? Faster implementation?
