import assert from 'node:assert/strict';
import test from 'node:test';
import { readSheetValues, saveSheetValue } from './draftStorage.js';

function memoryStorage() {
  const values = new Map();
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
}

test('drafts and suggestions are isolated between signed-in users', () => {
  const storage = memoryStorage();
  saveSheetValue(storage, 'worker-a', 'maya-sheet-draft', { project: 'A', num: '03' });
  saveSheetValue(storage, 'worker-a', 'maya-projects', ['A']);
  saveSheetValue(storage, 'worker-b', 'maya-sheet-draft', { project: 'B', num: '07' });
  assert.deepEqual(readSheetValues(storage, 'worker-a'), {
    'maya-sheet-draft': { project: 'A', num: '03' }, 'maya-projects': ['A'],
  });
  assert.deepEqual(readSheetValues(storage, 'worker-b'), { 'maya-sheet-draft': { project: 'B', num: '07' } });
  assert.deepEqual(readSheetValues(storage, undefined), {});
});

test('bridge cannot write auth keys or write without a signed-in user', () => {
  const storage = memoryStorage();
  storage.setItem('auth-token', 'original');
  assert.equal(saveSheetValue(storage, 'worker-a', 'auth-token', 'replacement'), false);
  assert.equal(saveSheetValue(storage, undefined, 'maya-sheet-draft', {}), false);
  assert.equal(storage.getItem('auth-token'), 'original');
});

test('rejects malformed messages and overly large drafts', () => {
  const storage = memoryStorage();
  for (const value of [null, 'text', []]) {
    assert.equal(saveSheetValue(storage, 'worker-a', 'maya-sheet-draft', value), false);
  }
  for (const value of [{}, [42], Array(13).fill('project')]) {
    assert.equal(saveSheetValue(storage, 'worker-a', 'maya-projects', value), false);
  }
  assert.equal(saveSheetValue(storage, 'worker-a', 'maya-sheet-draft', { notes1: 'x'.repeat(200_000) }), false);
  assert.deepEqual(readSheetValues(storage, 'worker-a'), {});
});

test('storage corruption and blocked storage do not throw', () => {
  const storage = memoryStorage();
  storage.setItem('maya-sheets:worker-a:maya-sheet-draft', '{broken JSON');
  storage.setItem('maya-sheets:worker-a:maya-projects', '{"wrong":"shape"}');
  storage.setItem('maya-sheets:worker-a:maya-leaders', '[42]');
  assert.deepEqual(readSheetValues(storage, 'worker-a'), {});
  const blocked = {
    getItem() { throw new Error('storage unavailable'); },
    setItem() { throw new Error('quota exceeded'); },
  };
  assert.deepEqual(readSheetValues(blocked, 'worker-a'), {});
  assert.equal(saveSheetValue(blocked, 'worker-a', 'maya-sheet-draft', {}), false);
});
