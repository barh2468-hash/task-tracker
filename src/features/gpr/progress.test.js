import test from 'node:test';
import assert from 'node:assert/strict';
import { progressPatch, requirementProgress } from './progress.js';
import { GPR_STATUSES, isOpenOrder } from './model.js';

test('GPR stages follow the requested workflow and scanning/interpretation remain open', () => {
  assert.deepEqual(GPR_STATUSES, [
    'new',
    'scheduled',
    'scanning',
    'interpretation',
    'clarification',
    'completed',
    'cancelled',
  ]);
  for (const value of GPR_STATUSES) {
    assert.deepEqual(progressPatch({}, { type: 'status', value }), { status: value });
    assert.equal(isOpenOrder({ status: value }), !['completed', 'cancelled'].includes(value));
  }
  assert.throws(() => progressPatch({}, { type: 'status', value: 'approval' }));
});

const order = {
  id: 'one',
  status: 'scheduled',
  source_email: 'Original mail',
  notes: 'My notes',
  requirements: [
    { key: 'crew', done: false, detail: '  Preserve this note  ' },
    { key: 'plan', done: true, detail: 'Received from sender' },
  ],
};

test('checking and undoing one action preserves notes, other actions and original email', () => {
  const original = structuredClone(order);
  const patch = progressPatch(order, { type: 'requirement', key: 'crew', done: true });
  assert.deepEqual(Object.keys(patch), ['requirements']);
  assert.equal(patch.requirements[0].detail, order.requirements[0].detail);
  assert.equal(patch.requirements[1].done, true);
  assert.deepEqual(order, original);
  const changed = { ...order, ...patch };
  assert.deepEqual(requirementProgress(changed), { done: 2, total: 2, percent: 100 });
  const undone = {
    ...changed,
    ...progressPatch(changed, { type: 'requirement', key: 'crew', done: false }),
  };
  assert.deepEqual(undone, original);
});

test('completing or reopening work never falsely completes checklist items', () => {
  assert.deepEqual(progressPatch(order, { type: 'status', value: 'completed' }), {
    status: 'completed',
  });
  const completed = { ...order, ...progressPatch(order, { type: 'status', value: 'completed' }) };
  assert.deepEqual(completed.requirements, order.requirements);
  assert.deepEqual(requirementProgress(completed), { done: 1, total: 2, percent: 50 });
  assert.deepEqual(progressPatch(completed, { type: 'status', value: 'new' }), { status: 'new' });
  assert.deepEqual(requirementProgress({ requirements: [] }), { done: 0, total: 0, percent: 0 });
});

test('unknown actions, statuses and non-boolean check values cannot generate update payloads', () => {
  for (const change of [
    { type: 'status', value: 'unknown' },
    { type: 'requirement', key: 'unknown', done: true },
    { type: 'requirement', key: 'crew', done: 'false' },
    { type: 'email', value: 'replace' },
  ]) {
    assert.throws(() => progressPatch(order, change));
  }
});
