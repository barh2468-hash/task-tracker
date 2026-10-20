import test from 'node:test';
import assert from 'node:assert/strict';
import { applyProject, copyPlanRows, createPlanRow, emptyPlan, planStorageKey, readPlan, shiftPlanDate, writePlan } from './localPlans.js';
import { heWorkPlanning, enWorkPlanning, elWorkPlanning } from './translations.js';

function memoryStorage() {
  const data = new Map();
  return { getItem: (key) => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), data };
}

test('draft edits survive reload without changing the published snapshot', () => {
  const storage = memoryStorage();
  const key = planStorageKey('manager-a', '2026-10-20');
  const row = createPlanRow({ leader: 'יניב', notes: 'שם והערה מקוריים' });
  let plan = writePlan(storage, key, emptyPlan([row]));
  plan = writePlan(storage, key, { ...plan, publishedRows: structuredClone(plan.rows), publishedAt: new Date().toISOString() });
  writePlan(storage, key, { ...plan, rows: [{ ...row, notes: 'שינוי בטיוטה בלבד' }] });
  const reloaded = readPlan(storage, key);
  assert.equal(reloaded.rows[0].notes, 'שינוי בטיוטה בלבד');
  assert.equal(reloaded.publishedRows[0].notes, 'שם והערה מקוריים');
  assert.equal(reloaded.rows[0].leader, 'יניב');
  assert.equal(readPlan(storage, planStorageKey('manager-b', '2026-10-20')), null);
  assert.equal(readPlan(storage, planStorageKey('manager-a', '2026-10-21')), null);
});

test('stale tabs cannot overwrite newer local plans', () => {
  const storage = memoryStorage();
  const key = 'test';
  const stale = emptyPlan([createPlanRow({ leader: 'First' })]);
  const saved = writePlan(storage, key, stale);
  assert.throws(() => writePlan(storage, key, stale), { code: 'conflict' });
  assert.deepEqual(readPlan(storage, key), saved);
});

test('corrupt or unsupported stored data is preserved instead of replaced', () => {
  const storage = memoryStorage();
  for (const value of ['{broken', '{"version":2}', JSON.stringify({ ...emptyPlan(), rows: [null] })]) {
    storage.setItem('test', value);
    assert.throws(() => readPlan(storage, 'test'), { code: 'invalid' });
    assert.throws(() => writePlan(storage, 'test', emptyPlan()), { code: 'invalid' });
    assert.equal(storage.getItem('test'), value);
  }
});

test('storage failures are reported rather than treated as successful saves', () => {
  const blocked = { getItem() { throw Error('disabled'); } };
  assert.throws(() => readPlan(blocked, 'test'), { code: 'storage' });
  const full = { getItem: () => null, setItem() { throw Error('quota'); } };
  assert.throws(() => writePlan(full, 'test', emptyPlan()), { code: 'storage' });
});

test('copying days gives rows new identities and preserves user-entered values', () => {
  const rows = [createPlanRow({ leader: 'יוני', start: '__after__', notes: 'הערה ללא שינוי' })];
  const copy = copyPlanRows(rows);
  assert.notEqual(copy[0].id, rows[0].id);
  assert.equal(copy[0].start, '__after__');
  assert.equal(copy[0].notes, rows[0].notes);
  copy[0].notes = 'changed';
  assert.equal(rows[0].notes, 'הערה ללא שינוי');
  assert.equal(shiftPlanDate('2026-11-01', -1), '2026-10-31');
  assert.equal(shiftPlanDate('2028-03-01', -1), '2028-02-29');
  assert.equal(shiftPlanDate('2026-12-31', 1), '2027-01-01');
});

test('project selection fills details and preserves the crew and notes', () => {
  const row = createPlanRow({ leader: 'רז', helpers: 'נהוראי', notes: 'להתקשר לפני ההגעה' });
  const next = applyProject(row, { id: 'p1', name: 'Site', location: 'City', client_name: 'Client', contact_name: 'Person', contact_phone: '123' });
  assert.equal(next.work, 'Site\nCity');
  assert.equal(next.contact, 'Person\n123');
  assert.equal(next.notes, row.notes);
  assert.equal(next.helpers, row.helpers);
  assert.equal(applyProject(next, null).work, next.work);
  assert.equal(applyProject(next, null).projectId, '');
});

test('all work planning messages and interpolation tokens exist in all three languages', () => {
  const keys = Object.keys(heWorkPlanning).sort();
  for (const translations of [enWorkPlanning, elWorkPlanning]) {
    assert.deepEqual(Object.keys(translations).sort(), keys);
    for (const key of keys) {
      assert.ok(translations[key].trim());
      const tokens = (value) => [...value.matchAll(/\{\{(\w+)\}\}/g)].map((match) => match[1]).sort();
      assert.deepEqual(tokens(translations[key]), tokens(heWorkPlanning[key]), key);
    }
  }
});
