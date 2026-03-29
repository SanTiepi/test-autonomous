import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadOirModule } from '../src/oir/loader.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TODO_CRUD_SOURCE = readFileSync(
  join(__dirname, '..', 'src', 'oir', 'examples', 'todo_crud.oir'), 'utf8'
);

describe('OIR searchTodos', () => {
  it('pipeline loads todo_crud with searchTodos exported', async () => {
    const { exports: exp, meta } = await loadOirModule(TODO_CRUD_SOURCE);
    assert.equal(meta.phase, 'loaded');
    assert.equal(meta.errors.length, 0);
    assert.equal(typeof exp.searchTodos, 'function');
  });

  it('finds todos by case-insensitive title substring', async () => {
    const { exports: exp } = await loadOirModule(TODO_CRUD_SOURCE);

    exp.createTodo({ title: 'Buy groceries' });
    exp.createTodo({ title: 'Walk the dog' });
    exp.createTodo({ title: 'buy birthday gift' });

    const result = exp.searchTodos('buy');
    assert.equal(result.status, 200);
    assert.ok(Array.isArray(result.data));
    assert.equal(result.data.length, 2);

    const titles = result.data.map(t => t.title);
    assert.ok(titles.includes('Buy groceries'));
    assert.ok(titles.includes('buy birthday gift'));
  });

  it('returns empty array when no todos match', async () => {
    const { exports: exp } = await loadOirModule(TODO_CRUD_SOURCE);

    const result = exp.searchTodos('xyznonexistent');
    assert.equal(result.status, 200);
    assert.ok(Array.isArray(result.data));
    assert.equal(result.data.length, 0);
  });
});
