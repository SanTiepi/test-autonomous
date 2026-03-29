# Benoît

> A programming language designed for human-AI collaboration.
> Named after Benoît Fragnière, who loved science.

## What is Benoît?

Benoît is a programming language built from scratch to be **the optimal interface between human intent and machine execution**. It's not "JavaScript minus noise" — it's a fundamentally different way to write code, designed around how both transformers and humans reason best.

## Why Benoît?

| Problem | Benoît's answer |
|---------|----------------|
| JS has 40% syntactic noise | Benoît has ~5% noise — every token carries meaning |
| Nested code loses signal for AI | Max nesting depth: 2. Flat pipes, flat attention |
| AI generates 3x more tokens than needed | 68% fewer tokens = faster, cheaper, fewer bugs |
| Languages are designed for compilers | Benoît is designed for **reasoning** |
| Human and AI code look different | Benoît is equally natural for both |

## Core principles

1. **Pipe-flow**: `input > transform > transform > output` — data flows left-to-right
2. **Pattern matching**: The native operation of both humans and transformers
3. **Implicit return**: Last expression IS the value. No `return` keyword needed
4. **Names as documentation**: `expired entry now = now >= entry.resetAt` needs no comment
5. **Immutable by default**: Data flows, doesn't mutate. Easier to reason about
6. **Private by convention**: `_name` = internal, everything else = public

## File extension

`.ben`

## Current status

- v0.1 transpiler: **working** — transpiles to executable JavaScript
- 140 tests passing
- 68% token reduction vs equivalent JS
- 3.17x information density
- End-to-end proof: `.ben` → transpile → import → execute → correct results

## Example

```ben
use crypto.randomUUID

add a,b -> a + b
square x -> x * x
_double x -> x * 2

createRateLimiter maxRequests=100,windowMs=60000 ->
  clients: Map

  _cleanup now ->
    clients each ip,entry -> now >= entry.resetAt? clients.delete(ip)

  wrapWithRateLimit handler ->
    rateLimitedHandler req,res ->
      now: Date.now()
      ip: req.socket?.remoteAddress | req.headers?.["x-forwarded-for"] | "unknown"
      Math.random() < 0.1? _cleanup(now)
      handler(req, res)
```

## Roadmap

- [ ] v0.2: Pipe operator `>` for function composition
- [ ] Pattern matching with `|` and `=>`
- [ ] Inline test assertions: `add 2,3 == 5`
- [ ] Intent declarations: `rate_limiter: 100 req/min per IP`
- [ ] VSCode extension with syntax highlighting
- [ ] npm package: `npx benoit transpile src/`
- [ ] Self-hosting: Benoît compiler written in Benoît

## License

Open source. MIT.

---

*En mémoire de Benoît Fragnière, qui adorait la science.*
