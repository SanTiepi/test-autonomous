import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { compileOirToJs } from '../src/oir/compiler.mjs';

// Helper: create a minimal parsed module
function makeMod(overrides = {}) {
  return {
    id: 'test_mod',
    version: '1',
    exports: [],
    state: [],
    blocks: new Map(),
    tests: [],
    errors: [],
    ...overrides,
  };
}

function makeBlock(overrides = {}) {
  return {
    id: 'myBlock',
    inputs: [],
    outputs: [],
    effects: [],
    instructions: [],
    ...overrides,
  };
}

describe('OIR Compiler', () => {
  it('compiles simple block with lit and ret', () => {
    const mod = makeMod({
      exports: ['greet'],
      blocks: new Map([
        ['greet', makeBlock({
          id: 'greet',
          inputs: [],
          outputs: ['result'],
          instructions: [
            { op: 'lit', args: ['"hello"'], dst: 'r0', label: null, line: 1 },
            { op: 'ret', args: ['r0'], dst: 'r0', label: null, line: 2 },
          ],
        })],
      ]),
    });

    const { code } = compileOirToJs(mod);
    assert.ok(code.includes('function'), 'output contains function keyword');
    assert.ok(code.includes('greet'), 'output contains function name');
    assert.ok(code.includes('"hello"'), 'output contains the literal string');
    assert.ok(code.includes('return'), 'output contains return');
  });

  it('compiles block with brt + label → while/switch pattern', () => {
    const mod = makeMod({
      exports: ['check'],
      blocks: new Map([
        ['check', makeBlock({
          id: 'check',
          inputs: ['x'],
          outputs: ['r'],
          instructions: [
            { op: 'lit', args: ['true'], dst: 't0', label: null, line: 1 },
            { op: 'brt', args: ['t0', 'done'], dst: null, label: null, line: 2 },
            { op: 'lit', args: ['1'], dst: 'r0', label: null, line: 3 },
            { op: 'ret', args: ['r0'], dst: 'r0', label: null, line: 4 },
            { op: 'label', args: ['done'], dst: null, label: 'done', line: 5 },
            { op: 'lit', args: ['2'], dst: 'r0', label: null, line: 6 },
            { op: 'ret', args: ['r0'], dst: 'r0', label: null, line: 7 },
          ],
        })],
      ]),
    });

    const { code } = compileOirToJs(mod);
    assert.ok(code.includes('while'), 'output contains while');
    assert.ok(code.includes('switch'), 'output contains switch');
    assert.ok(code.includes('_loop'), 'output contains _loop label');
    assert.ok(code.includes('continue _loop'), 'output contains continue _loop');
  });

  it('compiles st_get/st_set → .get()/.set()', () => {
    const mod = makeMod({
      exports: ['storeOp'],
      state: ['myStore:map'],
      blocks: new Map([
        ['storeOp', makeBlock({
          id: 'storeOp',
          inputs: ['k', 'v'],
          outputs: [],
          instructions: [
            { op: 'st_set', args: ['k', 'v'], dst: 'myStore', label: null, line: 1 },
            { op: 'st_get', args: ['myStore', 'k'], dst: 't0', label: null, line: 2 },
            { op: 'ret', args: ['t0'], dst: 't0', label: null, line: 3 },
          ],
        })],
      ]),
    });

    const { code } = compileOirToJs(mod);
    assert.ok(code.includes('.set('), 'output contains .set()');
    assert.ok(code.includes('.get('), 'output contains .get()');
    assert.ok(code.includes('myStore'), 'output references store name');
  });

  it('compiles obj → object literal', () => {
    const mod = makeMod({
      exports: ['mkObj'],
      blocks: new Map([
        ['mkObj', makeBlock({
          id: 'mkObj',
          inputs: [],
          outputs: ['r'],
          instructions: [
            { op: 'obj', args: ['name:"alice"', 'age:30'], dst: 'r0', label: null, line: 1 },
            { op: 'ret', args: ['r0'], dst: 'r0', label: null, line: 2 },
          ],
        })],
      ]),
    });

    const { code } = compileOirToJs(mod);
    assert.ok(code.includes('name:'), 'output contains object key name');
    assert.ok(code.includes('{'), 'output contains opening brace');
    assert.ok(code.includes('}'), 'output contains closing brace');
  });

  it('compiles emit → {status, data}', () => {
    const mod = makeMod({
      exports: ['respond'],
      blocks: new Map([
        ['respond', makeBlock({
          id: 'respond',
          inputs: ['d'],
          outputs: ['r'],
          instructions: [
            { op: 'emit', args: ['200', 'd'], dst: 'r0', label: null, line: 1 },
            { op: 'ret', args: ['r0'], dst: 'r0', label: null, line: 2 },
          ],
        })],
      ]),
    });

    const { code } = compileOirToJs(mod);
    assert.ok(code.includes('status'), 'output contains status');
    assert.ok(code.includes('data'), 'output contains data');
  });

  it('compiles 2-block module → both functions in output', () => {
    const mod = makeMod({
      exports: ['main'],
      blocks: new Map([
        ['main', makeBlock({
          id: 'main',
          inputs: [],
          outputs: ['r'],
          instructions: [
            { op: 'call', args: ['helper', '1'], dst: 'r0', label: null, line: 1 },
            { op: 'ret', args: ['r0'], dst: 'r0', label: null, line: 2 },
          ],
        })],
        ['helper', makeBlock({
          id: 'helper',
          inputs: ['x'],
          outputs: ['r'],
          instructions: [
            { op: 'add', args: ['x', '10'], dst: 'r0', label: null, line: 3 },
            { op: 'ret', args: ['r0'], dst: 'r0', label: null, line: 4 },
          ],
        })],
      ]),
    });

    const { code } = compileOirToJs(mod);
    assert.ok(code.includes('export function main'), 'output contains exported main function');
    assert.ok(code.includes('function helper'), 'output contains helper function');
  });

  it('pre-declares registers with let', () => {
    const mod = makeMod({
      exports: ['fn'],
      blocks: new Map([
        ['fn', makeBlock({
          id: 'fn',
          inputs: ['x'],
          outputs: ['r'],
          instructions: [
            { op: 'lit', args: ['5'], dst: 't0', label: null, line: 1 },
            { op: 'add', args: ['x', 't0'], dst: 't1', label: null, line: 2 },
            { op: 'ret', args: ['t1'], dst: 't1', label: null, line: 3 },
          ],
        })],
      ]),
    });

    const { code } = compileOirToJs(mod);
    assert.ok(code.includes('let'), 'output contains let declaration');
    assert.ok(code.includes('t0'), 'output declares t0');
    assert.ok(code.includes('t1'), 'output declares t1');
    // x should not be in let (it's an input param)
    const letMatch = code.match(/let\s+([^;]+);/);
    assert.ok(letMatch, 'found let declaration');
    assert.ok(!letMatch[1].includes(' x'), 'input param x not in let declaration');
  });
});
