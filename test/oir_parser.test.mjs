import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseOir } from '../src/oir/parser.mjs';

const FULL_MODULE = `
mod todo_validation v1
exp validateTodo
st todos:map

# This is a comment
-- This too

blk validateTodo (body) -> (result errors)
  get t0 body "title"
  is t1 t0 str
  brt t1 :has_title
  lit errors "title: required string"
  emit r0 400 errors
  ret r0
:has_title
  trim t2 t0
  len t3 t2
  lt t4 t3 1
  brt t4 :bad_len
  br :ok
:bad_len
  lit errors "title: too short"
  ret errors
:ok
  obj result id:nil title:t2 completed:false
  ret result

test "rejects missing title"
  obj body
  call r0 validateTodo body
  assert_emit 400 "title"
`;

describe('parseOir', () => {
  it('parses a complete module', () => {
    const mod = parseOir(FULL_MODULE);
    assert.equal(mod.id, 'todo_validation');
    assert.equal(mod.version, '1');
    assert.deepEqual(mod.exports, ['validateTodo']);
    assert.equal(mod.blocks.size, 1);
    assert.equal(mod.tests.length, 1);
    assert.equal(mod.errors.length, 0);
  });

  it('parses module header', () => {
    const mod = parseOir('mod mymod v3\nexp foo\nblk foo () -> ()\n  ret');
    assert.equal(mod.id, 'mymod');
    assert.equal(mod.version, '3');
  });

  it('parses exports', () => {
    const mod = parseOir('mod m v1\nexp a b c\nblk a () -> ()\n  ret\nblk b () -> ()\n  ret\nblk c () -> ()\n  ret');
    assert.deepEqual(mod.exports, ['a', 'b', 'c']);
  });

  it('parses state declarations', () => {
    const mod = parseOir('mod m v1\nst items:map count:num\nblk f () -> ()\n  ret');
    assert.ok(mod.state.length >= 2);
  });

  it('parses block inputs and outputs', () => {
    const mod = parseOir(FULL_MODULE);
    const blk = mod.blocks.get('validateTodo');
    assert.ok(blk);
    assert.deepEqual(blk.inputs, ['body']);
    assert.deepEqual(blk.outputs, ['result', 'errors']);
  });

  it('parses various instruction types', () => {
    const mod = parseOir(FULL_MODULE);
    const blk = mod.blocks.get('validateTodo');
    const ops = blk.instructions.map(i => i.op);
    assert.ok(ops.includes('get'), 'should have get');
    assert.ok(ops.includes('is'), 'should have is');
    assert.ok(ops.includes('brt'), 'should have brt');
    assert.ok(ops.includes('lit'), 'should have lit');
    assert.ok(ops.includes('emit'), 'should have emit');
    assert.ok(ops.includes('ret'), 'should have ret');
    assert.ok(ops.includes('trim'), 'should have trim');
    assert.ok(ops.includes('len'), 'should have len');
    assert.ok(ops.includes('obj'), 'should have obj');
    assert.ok(ops.includes('br'), 'should have br');
  });

  it('parses labels', () => {
    const mod = parseOir(FULL_MODULE);
    const blk = mod.blocks.get('validateTodo');
    const labels = blk.instructions.filter(i => i.op === 'label').map(i => i.label);
    assert.ok(labels.includes('has_title'));
    assert.ok(labels.includes('bad_len'));
    assert.ok(labels.includes('ok'));
  });

  it('parses test sections', () => {
    const mod = parseOir(FULL_MODULE);
    assert.equal(mod.tests.length, 1);
    assert.equal(mod.tests[0].description, 'rejects missing title');
    assert.ok(mod.tests[0].instructions.length >= 3);
  });

  it('skips comments and empty lines', () => {
    const mod = parseOir('# comment\n\nmod m v1\n-- another comment\nblk f () -> ()\n  ret');
    assert.equal(mod.id, 'm');
    assert.equal(mod.errors.length, 0);
  });

  it('handles quoted strings in lit', () => {
    const mod = parseOir('mod m v1\nblk f () -> ()\n  lit x "hello world"\n  ret');
    const blk = mod.blocks.get('f');
    const litInst = blk.instructions.find(i => i.op === 'lit');
    assert.ok(litInst);
    assert.ok(litInst.args.some(a => a.includes('hello world')));
  });

  it('reports error for missing mod declaration', () => {
    const mod = parseOir('blk f () -> ()\n  ret');
    assert.ok(mod.errors.length > 0);
  });

  it('parses obj with key:value pairs', () => {
    const mod = parseOir('mod m v1\nblk f () -> ()\n  obj r0 name:t1 age:42\n  ret');
    const blk = mod.blocks.get('f');
    const objInst = blk.instructions.find(i => i.op === 'obj');
    assert.ok(objInst);
    assert.ok(objInst.args.some(a => a.includes('name:')));
  });
});
