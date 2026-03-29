# OIR v1 — Opaque Intermediate Representation

## Format

Text-based, line-oriented, imperative. Not for humans. Each line is one instruction.

## Module Structure

```
mod <id> v<version>
exp <name> [<name> ...]
st <name>:<type> [<name>:<type> ...]

blk <id> (<inputs>) -> (<outputs>) [!<effect> ...]
  <instruction>
  <instruction>
  ...

test <description>
  <instruction>
  ...
```

## Types

Primitives: `str`, `num`, `bool`, `nil`, `obj`, `arr`, `map`, `any`

## Instructions

### Data
- `lit <dst> <value>` — load literal into register
- `get <dst> <src> <key>` — get property from object/map
- `set <dst> <key> <val>` — set property on object/map
- `obj <dst> <k1>:<v1> [<k2>:<v2> ...]` — create object
- `arr <dst> [<v1> <v2> ...]` — create array
- `mov <dst> <src>` — copy register
- `len <dst> <src>` — get length/size

### Logic
- `eq <dst> <a> <b>` — equality test
- `neq <dst> <a> <b>` — inequality test
- `gt <dst> <a> <b>` — greater than
- `lt <dst> <a> <b>` — less than
- `not <dst> <src>` — boolean negation
- `is <dst> <src> <type>` — type check (str/num/bool/nil/obj/arr)
- `and <dst> <a> <b>` — logical and
- `or <dst> <a> <b>` — logical or

### Control Flow
- `br <label>` — unconditional branch
- `brt <cond> <label>` — branch if truthy
- `brf <cond> <label>` — branch if falsy
- `:<label>` — label (target for branches)
- `ret [<reg>]` — return from block
- `call <dst> <block_id> [<args>]` — call another block

### Host Effects (closed set)
- `st_get <dst> <store> <key>` — read from state store
- `st_set <store> <key> <val>` — write to state store
- `st_del <store> <key>` — delete from state store
- `st_has <dst> <store> <key>` — check existence in store
- `st_vals <dst> <store>` — get all values from store
- `now <dst>` — current timestamp
- `uuid <dst>` — generate unique id
- `emit <dst> <status> <data>` — produce output {status, data}
- `call_mod <dst> <mod_id> <block_id> [<args>]` — cross-module call

### String/Math
- `trim <dst> <src>` — trim whitespace
- `add <dst> <a> <b>` — add/concat
- `sub <dst> <a> <b>` — subtract
- `mul <dst> <a> <b>` — multiply
- `cat <dst> <parts...>` — concatenate strings

## Test Syntax

```
test "description"
  <setup instructions>
  assert_eq <a> <b>
  assert_true <a>
  assert_emit <status> <pattern>
```

## Example: Todo Validation

```
mod todo_validation v1
exp validateTodo
st todos:map

blk validateTodo (body) -> (result errors)
  get t0 body "title"
  is t1 t0 str
  brt t1 :has_title
  lit errors "title: required string, 1-200 chars"
  emit r0 400 errors
  ret r0
:has_title
  trim t2 t0
  len t3 t2
  lt t4 t3 1
  brt t4 :bad_len
  gt t5 t3 200
  brt t5 :bad_len
  br :ok
:bad_len
  lit errors "title: required string, 1-200 chars"
  emit r0 400 errors
  ret r0
:ok
  obj result id:nil title:t2 completed:false
  mov result result
  ret result

test "rejects missing title"
  obj body
  call r0 validateTodo body
  assert_emit 400 "title"

test "accepts valid title"
  obj body title:"Buy milk"
  call r0 validateTodo body
  assert_emit nil nil
```
