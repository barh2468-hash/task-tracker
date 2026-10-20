import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { importWorkbookPlan } from './importWorkbookPlan.js';
import { createPlanRow, emptyPlan, planColumns, planStorageKey, readPlan, writePlan } from './localPlans.js';

const workbook = JSON.parse(readFileSync(new URL('./october-20-work-plan.json', import.meta.url), 'utf8'));
function memoryStorage() {
  const data = new Map();
  return { getItem: (key) => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), data };
}

test('imports every source row into draft and published plan, retaining complete contacts and notes', () => {
  const storage = memoryStorage();
  const saved = importWorkbookPlan(storage, 'local', workbook);
  assert.equal(saved.rows.length, 26);
  assert.deepEqual(saved.rows.map((row) => row.sourceRow), Array.from({ length: 26 }, (_, i) => i + 3));
  for (const row of workbook.rows) {
    const actual = saved.rows.find((item) => item.sourceRow === row.sourceRow);
    for (const column of planColumns) assert.equal(actual[column], row[column], `${row.sourceRow}:${column}`);
  }
  assert.deepEqual(saved.publishedRows, workbook.rows);
  assert.equal(saved.sourceWorkbook.sha256, workbook.source.sha256);
  assert.equal(saved.rows.find((row) => row.sourceRow === 15).start, '01:00');
  assert.equal(saved.rows.find((row) => row.sourceRow === 8).contact, "ג'ימי- 0542228491");
  assert.ok(saved.rows.find((row) => row.sourceRow === 24).notes.endsWith('לאחר מכן תצטרף לאוהד.'));
  saved.rows[0].notes = 'changed';
  assert.equal(saved.publishedRows[0].notes, '');
  assert.equal(workbook.rows[0].notes, '');
});

test('merged source cells retain the right leader and helpers for all follow-up jobs', () => {
  for (const sourceRow of [13, 14, 15]) {
    const row = workbook.rows.find((item) => item.sourceRow === sourceRow);
    assert.equal(row.leader, 'עידן');
    assert.equal(row.helpers, '');
  }
  assert.equal(workbook.rows.find((row) => row.sourceRow === 18).leader, 'בר');
  assert.equal(workbook.rows.find((row) => row.sourceRow === 18).helpers, 'חיים');
  assert.equal(workbook.rows.find((row) => row.sourceRow === 21).leader, 'מיכאל');
  assert.equal(workbook.rows.find((row) => row.sourceRow === 21).helpers, 'שקד');
});

test('replacing an existing date keeps the complete previous local plan in a backup', () => {
  const storage = memoryStorage();
  const key = planStorageKey('local', workbook.source.date);
  const previous = writePlan(storage, key, emptyPlan([createPlanRow({ notes: 'User edit before import' })]));
  importWorkbookPlan(storage, 'local', workbook);
  assert.deepEqual(readPlan(storage, `${key}:before-workbook-import`), previous);
  assert.equal(readPlan(storage, key).rows.length, 26);
  assert.equal(readPlan(storage, planStorageKey('another-user', workbook.source.date)), null);
  assert.equal(readPlan(storage, planStorageKey('local', '2026-10-21')), null);
});

test('a backup failure leaves the saved plan untouched', () => {
  const storage = memoryStorage();
  const key = planStorageKey('local', workbook.source.date);
  const previous = writePlan(storage, key, emptyPlan([createPlanRow({ leader: 'Original' })]));
  const set = storage.setItem;
  storage.setItem = (name, value) => {
    if (name.endsWith(':before-workbook-import')) throw Error('quota');
    set(name, value);
  };
  assert.throws(() => importWorkbookPlan(storage, 'local', workbook), { code: 'storage' });
  assert.deepEqual(readPlan(storage, key), previous);
});
