import test from 'node:test';
import assert from 'node:assert/strict';
import { createPlanRow, samePlanRows } from './localPlans.js';
import { loadPublication, publishPlan, validatePublication } from './publishedPlans.js';

const record = { plan_date: '2026-10-20', rows: [createPlanRow({ leader: 'Worker' })], roster_names: ['Worker'], version: 2, published_at: '2026-10-20T12:00:00Z' };
test('database JSON property order and workbook metadata do not mark an unchanged draft as changed', () => {
  const row = record.rows[0];
  const serverRow = Object.fromEntries(Object.entries(row).reverse());
  assert.equal(samePlanRows([{ ...row, sourceRow: 7 }], [serverRow]), true);
  assert.equal(samePlanRows([row], [{ ...serverRow, notes: 'Changed' }]), false);
});
function clientWith(result) {
  const calls = [];
  const query = Object.fromEntries(['from', 'select', 'eq', 'insert', 'update'].map((method) => [method, (...args) => { calls.push([method, ...args]); return query; }]));
  query.maybeSingle = async () => result;
  return { client: query, calls };
}

test('loads a dated publication and allows a date with no publication', async () => {
  const { client, calls } = clientWith({ data: record, error: null });
  assert.deepEqual(await loadPublication(record.plan_date, client), record);
  assert.ok(calls.some((call) => call[0] === 'eq' && call[1] === 'plan_date' && call[2] === record.plan_date));
  assert.equal(await loadPublication(record.plan_date, clientWith({ data: null, error: null }).client), null);
});

test('rejects corrupt snapshots rather than showing an incomplete schedule', () => {
  assert.throws(() => validatePublication({ ...record, rows: [{ id: 'broken' }] }), /invalid/);
  assert.throws(() => validatePublication({ ...record, rows: [record.rows[0], record.rows[0]] }), /invalid/);
  assert.throws(() => validatePublication({ ...record, roster_names: [42] }), /invalid/);
});

test('publication updates include the loaded version and preserve every row value', async () => {
  const { client, calls } = clientWith({ data: record, error: null });
  await publishPlan({ date: record.plan_date, rows: record.rows, rosterNames: record.roster_names, userId: 'manager', version: 1 }, client);
  assert.ok(calls.some((call) => call[0] === 'eq' && call[1] === 'version' && call[2] === 1));
  assert.deepEqual(calls.find((call) => call[0] === 'update')[1].rows, record.rows);
});

test('stale updates and concurrent first publications are conflicts', async () => {
  const values = { date: record.plan_date, rows: record.rows, rosterNames: record.roster_names, userId: 'manager', version: 1 };
  await assert.rejects(publishPlan(values, clientWith({ data: null, error: null }).client), /conflict/);
  await assert.rejects(publishPlan({ ...values, version: undefined }, clientWith({ data: null, error: { code: '23505' } }).client), /conflict/);
});

test('network and permission failures do not report successful publication', async () => {
  const failure = new Error('permission denied');
  await assert.rejects(loadPublication(record.plan_date, clientWith({ data: null, error: failure }).client), /permission denied/);
  await assert.rejects(publishPlan({ date: record.plan_date, rows: record.rows }, clientWith({ data: null, error: failure }).client), /permission denied/);
});
