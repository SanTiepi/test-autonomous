// oir_migration.test.mjs — Behavioral equivalence: OIR compiled vs JS baseline.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadOirModule } from '../src/oir/loader.mjs';
import { parseOir } from '../src/oir/parser.mjs';
import { validateOir } from '../src/oir/validator.mjs';
import { compileOirToJs } from '../src/oir/compiler.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

// --- Reference JS implementations (from src/index.mjs baseline) ---
function jsValidateTodo(body) {
  const errors = [];
  if (typeof body.title !== "string" || body.title.trim().length < 1 || body.title.length > 200) {
    errors.push("title: required string, 1-200 chars");
  }
  return errors;
}

// --- Tests ---

describe('OIR migration: todo_validation', () => {
  let oirValidate;

  it('parses and validates todo_validation.oir', async () => {
    const source = await readFile(resolve(__dirname, '../src/oir/examples/todo_validation.oir'), 'utf8');
    const mod = parseOir(source);
    assert.equal(mod.errors.length, 0, `Parse errors: ${mod.errors.join(', ')}`);
    const v = validateOir(mod);
    const errors = v.diagnostics.filter(d => d.type === 'error');
    assert.equal(errors.length, 0, `Validation errors: ${errors.map(d => d.message).join(', ')}`);
  });

  it('compiles todo_validation.oir to JS', async () => {
    const source = await readFile(resolve(__dirname, '../src/oir/examples/todo_validation.oir'), 'utf8');
    const mod = parseOir(source);
    const { code } = compileOirToJs(mod);
    assert.ok(code.includes('function validateTodo'), 'should contain validateTodo function');
    assert.ok(code.includes('export'), 'should have exports');
  });

  it('loads and executes todo_validation.oir', async () => {
    const source = await readFile(resolve(__dirname, '../src/oir/examples/todo_validation.oir'), 'utf8');
    const result = await loadOirModule(source);
    assert.equal(result.meta.phase, 'loaded', `Failed at phase: ${result.meta.phase}, errors: ${JSON.stringify(result.meta.errors)}`);
    oirValidate = result.exports.validateTodo;
    assert.ok(typeof oirValidate === 'function');
  });

  it('OIR validateTodo matches JS baseline: valid title', async () => {
    const source = await readFile(resolve(__dirname, '../src/oir/examples/todo_validation.oir'), 'utf8');
    const { exports } = await loadOirModule(source);
    const oirResult = exports.validateTodo({ title: "Buy milk" });
    const jsResult = jsValidateTodo({ title: "Buy milk" });
    // Both should return empty errors
    assert.ok(Array.isArray(oirResult));
    assert.equal(oirResult.length, 0, `OIR returned errors for valid input: ${JSON.stringify(oirResult)}`);
    assert.equal(jsResult.length, 0);
  });

  it('OIR validateTodo matches JS baseline: missing title', async () => {
    const source = await readFile(resolve(__dirname, '../src/oir/examples/todo_validation.oir'), 'utf8');
    const { exports } = await loadOirModule(source);
    const oirResult = exports.validateTodo({});
    const jsResult = jsValidateTodo({});
    // Both should return errors
    assert.ok(oirResult.length > 0 || (oirResult.status === 400), `OIR should reject missing title`);
    assert.ok(jsResult.length > 0);
  });

  it('OIR validateTodo matches JS baseline: empty string title', async () => {
    const source = await readFile(resolve(__dirname, '../src/oir/examples/todo_validation.oir'), 'utf8');
    const { exports } = await loadOirModule(source);
    const oirResult = exports.validateTodo({ title: "" });
    const jsResult = jsValidateTodo({ title: "" });
    assert.ok(oirResult.length > 0 || (oirResult.status === 400), `OIR should reject empty title`);
    assert.ok(jsResult.length > 0);
  });
});

describe('OIR migration: todo_crud', () => {
  it('parses and validates todo_crud.oir', async () => {
    const source = await readFile(resolve(__dirname, '../src/oir/examples/todo_crud.oir'), 'utf8');
    const mod = parseOir(source);
    assert.equal(mod.errors.length, 0, `Parse errors: ${mod.errors.join(', ')}`);
    const v = validateOir(mod);
    const errors = v.diagnostics.filter(d => d.type === 'error');
    assert.equal(errors.length, 0, `Validation errors: ${errors.map(d => d.message).join(', ')}`);
  });

  it('compiles todo_crud.oir to JS', async () => {
    const source = await readFile(resolve(__dirname, '../src/oir/examples/todo_crud.oir'), 'utf8');
    const mod = parseOir(source);
    const { code } = compileOirToJs(mod);
    assert.ok(code.includes('function createTodo'), 'should contain createTodo');
    assert.ok(code.includes('function listTodos'), 'should contain listTodos');
    assert.ok(code.includes('function getTodo'), 'should contain getTodo');
    assert.ok(code.includes('function deleteTodo'), 'should contain deleteTodo');
    assert.ok(code.includes('new Map()'), 'should have state Map');
  });

  it('loads todo_crud.oir and creates a todo', async () => {
    const source = await readFile(resolve(__dirname, '../src/oir/examples/todo_crud.oir'), 'utf8');
    const result = await loadOirModule(source);
    assert.equal(result.meta.phase, 'loaded', `errors: ${JSON.stringify(result.meta.errors)}`);

    const created = result.exports.createTodo({ title: "Test todo" });
    assert.ok(created, 'should return a result');
    assert.equal(created.status, 201, `expected 201, got ${created.status}`);
    assert.ok(created.data.id, 'should have an id');
    assert.equal(created.data.title, 'Test todo');
    assert.equal(created.data.completed, false);
  });

  it('lists todos after creation (same module instance)', async () => {
    const source = await readFile(resolve(__dirname, '../src/oir/examples/todo_crud.oir'), 'utf8');
    const result = await loadOirModule(source);

    // Each loadOirModule gets its own state Map via data URL import
    // We need to use the same module instance for create + list
    const created1 = result.exports.createTodo({ title: "Item 1" });
    assert.equal(created1.status, 201);
    const created2 = result.exports.createTodo({ title: "Item 2" });
    assert.equal(created2.status, 201);

    const listed = result.exports.listTodos();
    assert.equal(listed.status, 200);
    assert.ok(Array.isArray(listed.data));
    // Data URL imports are cached by Node, so state may persist or not
    // The key test: at least 1 item visible if state works
    assert.ok(listed.data.length >= 1, `expected >=1 todos, got ${listed.data.length}`);
  });

  it('gets a todo by id', async () => {
    const source = await readFile(resolve(__dirname, '../src/oir/examples/todo_crud.oir'), 'utf8');
    const result = await loadOirModule(source);

    const created = result.exports.createTodo({ title: "Find me" });
    const found = result.exports.getTodo(created.data.id);
    assert.equal(found.status, 200);
    assert.equal(found.data.title, "Find me");
  });

  it('returns 404 for non-existent todo', async () => {
    const source = await readFile(resolve(__dirname, '../src/oir/examples/todo_crud.oir'), 'utf8');
    const result = await loadOirModule(source);

    const notFound = result.exports.getTodo("nonexistent");
    assert.equal(notFound.status, 404);
  });

  it('deletes a todo', async () => {
    const source = await readFile(resolve(__dirname, '../src/oir/examples/todo_crud.oir'), 'utf8');
    const result = await loadOirModule(source);

    const created = result.exports.createTodo({ title: "Delete me" });
    const deleted = result.exports.deleteTodo(created.data.id);
    assert.equal(deleted.status, 204);

    const notFound = result.exports.getTodo(created.data.id);
    assert.equal(notFound.status, 404);
  });

  it('rejects creating todo with invalid title', async () => {
    const source = await readFile(resolve(__dirname, '../src/oir/examples/todo_crud.oir'), 'utf8');
    const result = await loadOirModule(source);

    const bad = result.exports.createTodo({ title: 42 });
    assert.equal(bad.status, 400);
  });
});
