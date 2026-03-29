import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseOir } from '../src/oir/parser.mjs';
import { validateOir } from '../src/oir/validator.mjs';

function validate(source) {
  return validateOir(parseOir(source));
}

describe('validateOir', () => {
  it('accepts a valid module', () => {
    const r = validate(`
mod mymod v1
exp greet
blk greet (name) -> (msg)
  lit msg "hello"
  ret msg
`);
    assert.equal(r.valid, true);
    assert.equal(r.diagnostics.filter(d => d.type === 'error').length, 0);
  });

  it('rejects missing module declaration', () => {
    // No mod line at all → parser error + validator catches empty id
    const mod = parseOir('blk f () -> ()\n  ret');
    assert.ok(mod.errors.length > 0, 'parser should report missing mod');
    const v = validateOir(mod);
    assert.equal(v.valid, false);
  });

  it('rejects export referencing non-existent block', () => {
    const r = validate(`
mod m v1
exp nonexistent
blk actual () -> ()
  ret
`);
    assert.equal(r.valid, false);
    assert.ok(r.diagnostics.some(d => d.message.includes('nonexistent')));
  });

  it('rejects branch to non-existent label', () => {
    const r = validate(`
mod m v1
exp f
blk f () -> ()
  brt t0 :missing_label
  ret
`);
    assert.equal(r.valid, false);
    assert.ok(r.diagnostics.some(d => d.message.includes('missing_label')));
  });

  it('rejects unknown instruction op', () => {
    const r = validate(`
mod m v1
exp f
blk f () -> ()
  fakeopcode t0 t1
  ret
`);
    assert.equal(r.valid, false);
    assert.ok(r.diagnostics.some(d => d.message.includes('fakeopcode')));
  });

  it('accepts valid labels and branches', () => {
    const r = validate(`
mod m v1
exp f
blk f (x) -> (r)
  brt x :yes
  lit r "no"
  ret r
:yes
  lit r "yes"
  ret r
`);
    assert.equal(r.valid, true);
  });

  it('warns about unused blocks', () => {
    const r = validate(`
mod m v1
exp f
blk f () -> ()
  ret
blk orphan () -> ()
  ret
`);
    assert.ok(r.diagnostics.some(d => d.type === 'warning' && d.message.includes('orphan')));
  });

  it('accepts blocks called by other blocks', () => {
    const r = validate(`
mod m v1
exp main
blk main () -> (r)
  call r helper
  ret r
blk helper () -> (r)
  lit r 42
  ret r
`);
    assert.equal(r.valid, true);
    // helper is called, not orphan
    assert.ok(!r.diagnostics.some(d => d.message.includes('helper') && d.type === 'warning'));
  });

  it('rejects call to non-existent block', () => {
    const r = validate(`
mod m v1
exp f
blk f () -> (r)
  call r ghost
  ret r
`);
    assert.equal(r.valid, false);
    assert.ok(r.diagnostics.some(d => d.message.includes('ghost')));
  });

  it('rejects duplicate labels in same block', () => {
    const r = validate(`
mod m v1
exp f
blk f () -> ()
  br :dup
:dup
  ret
:dup
  ret
`);
    assert.equal(r.valid, false);
    assert.ok(r.diagnostics.some(d => d.message.includes('Duplicate label')));
  });
});
