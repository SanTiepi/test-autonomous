import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { loadOirModule, replaceSemanticBlock, serializeModule } from '../src/oir/loader.mjs';

const SIMPLE_MOD = `mod simple v1
exp greet
st store:map

blk greet (name) -> (result)
  lit t0 "Hello, "
  cat r0 t0 name
  ret r0
`;

const STATEFUL_MOD = `mod counter v1
exp inc get

blk inc (key) -> (result)
  st_get t0 _counts key
  is t1 t0 nil
  brf t1 :has_val
  lit t0 0
:has_val
  add t0 t0 1
  st_set _counts key t0
  ret t0

blk get (key) -> (result)
  st_get t0 _counts key
  ret t0
`;

const INVALID_SOURCE = `this is not valid oir at all`;

const BAD_EXPORTS = `mod badmod v1
exp nonExistent

blk realBlock () -> ()
  ret
`;

describe('OIR Loader', () => {
  it('loads simple module and calls exported function', async () => {
    const { module: mod, exports: exp, meta } = await loadOirModule(SIMPLE_MOD);
    assert.ok(mod, 'module is not null');
    assert.ok(exp, 'exports is not null');
    assert.equal(meta.phase, 'loaded');
    assert.equal(meta.errors.length, 0);
    assert.equal(typeof exp.greet, 'function');
    const result = exp.greet('World');
    assert.equal(result, 'Hello, World');
  });

  it('loads module with state Map, calls twice, state persists', async () => {
    // We need to compile a stateful module that actually works
    // The stateful module uses _counts which needs to be declared as state
    const statefulSrc = `mod counter v1
exp inc

st _counts:map

blk inc (key) -> (result)
  st_get t0 _counts key
  is t1 t0 nil
  brf t1 :has_val
  lit t0 0
:has_val
  add t0 t0 1
  st_set _counts key t0
  ret t0
`;

    const { exports: exp, meta } = await loadOirModule(statefulSrc);
    assert.equal(meta.phase, 'loaded');
    assert.equal(typeof exp.inc, 'function');

    const first = exp.inc('a');
    assert.equal(first, 1, 'first call returns 1');
    const second = exp.inc('a');
    assert.equal(second, 2, 'second call returns 2');
  });

  it('returns parse error for invalid source', async () => {
    const { module: mod, exports: exp, meta } = await loadOirModule(INVALID_SOURCE);
    assert.equal(mod, null);
    assert.equal(exp, null);
    assert.equal(meta.phase, 'parse');
    assert.ok(meta.errors.length > 0, 'has parse errors');
  });

  it('returns validate error for bad exports', async () => {
    const { module: mod, exports: exp, meta } = await loadOirModule(BAD_EXPORTS);
    assert.equal(mod, null);
    assert.equal(exp, null);
    assert.equal(meta.phase, 'validate');
    assert.ok(meta.errors.length > 0, 'has validation errors');
  });

  it('replaceSemanticBlock changes a block and re-parses', async () => {
    const { module: mod } = await loadOirModule(SIMPLE_MOD);
    assert.ok(mod);

    const newBlockLines = [
      'blk greet (name) -> (result)',
      '  lit t0 "Hi, "',
      '  cat r0 t0 name',
      '  ret r0',
    ];

    const result = await replaceSemanticBlock(mod, 'greet', newBlockLines);
    assert.ok(result.module, 'replacement produced a module');
    assert.ok(result.module.blocks.has('greet'), 'greet block still exists');

    // Verify the block was actually changed
    const blk = result.module.blocks.get('greet');
    const litInst = blk.instructions.find(i => i.op === 'lit');
    assert.ok(litInst, 'has lit instruction');
    assert.ok(litInst.args[0].includes('Hi'), 'lit changed to Hi');
  });
});
