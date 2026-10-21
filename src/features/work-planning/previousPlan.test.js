import test from 'node:test';
import assert from 'node:assert/strict';
import { copyPreviousPlan } from './previousPlan.js';
import { createPlanRow, emptyPlan, planStorageKey, readPlan, writePlan } from './localPlans.js';

function storageFor(plan, date = '2026-10-20') {
  const values = new Map(plan ? [[planStorageKey('manager', date), JSON.stringify(plan)]] : []);
  return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
}
const row = createPlanRow({ leader: 'עידן', work: 'עבודת לילה', helpers: '', start: '__after__', projectId: 'project', notes: 'All details stay unchanged' });
const values = { date: '2026-10-21', storageScope: 'manager' };

test('a fresh device copies yesterday from the shared publication with the full roster and fresh row identities', async () => {
  const publication = { rows: [row], roster_names: ['עידן', 'רז ינאי'] };
  const source = await copyPreviousPlan({ ...values, storage: { getItem() { throw Error('must not read local data'); } },
    loadPublished: async (date) => { assert.equal(date, '2026-10-20'); return publication; } });
  assert.notEqual(source.rows[0].id, row.id);
  assert.deepEqual({ ...source.rows[0], id: row.id }, row);
  assert.deepEqual(source.rosterNames, publication.roster_names);
  source.rosterNames.pop();
  source.rows[0].notes = 'Changed in today’s draft';
  assert.equal(publication.rows[0].notes, row.notes);
  assert.equal(publication.roster_names.length, 2);
});

test('a stale local draft never overrides yesterday’s published company plan', async () => {
  const source = await copyPreviousPlan({ ...values, storage: storageFor(emptyPlan([{ ...row, notes: 'Unpublished local edit' }])),
    loadPublished: async () => ({ rows: [row], roster_names: ['עידן'] }) });
  assert.equal(source.rows[0].notes, row.notes);
});

test('an unpublished local plan remains available when no shared plan exists', async () => {
  const local = { ...emptyPlan([row]), rosterNames: ['עידן'] };
  const source = await copyPreviousPlan({ ...values, storage: storageFor(local), loadPublished: async () => null });
  assert.equal(source.rows[0].work, row.work);
  assert.deepEqual(source.rosterNames, local.rosterNames);
  assert.equal((await copyPreviousPlan({ ...values, storage: storageFor(local) })).rows[0].work, row.work);
});

test('local publication fallback and missing dates keep their distinct results', async () => {
  const local = { ...emptyPlan(), publishedRows: [row] };
  assert.equal((await copyPreviousPlan({ ...values, storage: storageFor(local) })).rows.length, 1);
  assert.equal(await copyPreviousPlan({ ...values, storage: storageFor(null), loadPublished: async () => null }), null);
});

test('network errors are surfaced instead of being reported as missing plans or copying stale drafts', async () => {
  const storage = storageFor(emptyPlan([{ ...row, notes: 'Stale' }]));
  await assert.rejects(copyPreviousPlan({ ...values, storage, loadPublished: async () => { throw Error('offline'); } }), /offline/);
  assert.equal(readPlan(storage, planStorageKey('manager', '2026-10-20')).rows[0].notes, 'Stale');
});

test('the copied roster survives local saves and later edits without modifying yesterday', async () => {
  const storage = storageFor(emptyPlan([row]));
  const copied = await copyPreviousPlan({ ...values, storage, loadPublished: async () => ({ rows: [row], roster_names: ['עידן', 'רז ינאי'] }) });
  const key = planStorageKey('manager', values.date);
  let plan = writePlan(storage, key, { ...emptyPlan(), ...copied });
  plan = writePlan(storage, key, { ...plan, rows: [{ ...plan.rows[0], notes: 'Today only' }] });
  assert.deepEqual(readPlan(storage, key).rosterNames, ['עידן', 'רז ינאי']);
  assert.equal(readPlan(storage, planStorageKey('manager', '2026-10-20')).rows[0].notes, row.notes);
  assert.throws(() => writePlan(storage, key, { ...plan, rosterNames: [42] }), { code: 'invalid' });
});

test('the source date follows civil calendar boundaries', async () => {
  for (const [date, previous] of [['2026-11-01', '2026-10-31'], ['2028-03-01', '2028-02-29'], ['2027-01-01', '2026-12-31']]) {
    await copyPreviousPlan({ ...values, date, storage: storageFor(null), loadPublished: async (requested) => {
      assert.equal(requested, previous); return null;
    } });
  }
});
