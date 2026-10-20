import test from 'node:test';
import assert from 'node:assert/strict';
import { getWorkerCellGroups, updateWorkerGroup } from './rowGroups.js';

test('merges consecutive leaders while keeping different assistants and every task', () => {
  const rows = [
    { id: '1', leader: 'Idan', helpers: 'Ohad', work: 'First project' },
    { id: '2', leader: 'Idan', helpers: '', work: 'Second project' },
    { id: '3', leader: 'Idan', helpers: '', work: 'Third project' },
    { id: '4', leader: 'Ilan', helpers: '', work: 'Night project' },
  ];
  const groups = getWorkerCellGroups(rows);
  assert.equal(groups[0].leader.span, 1);
  assert.equal(groups[0].leader.solo, false);
  assert.equal(groups[1].leader.span, 2);
  assert.equal(groups[2].leader.start, 1);
  assert.equal(groups[1].leader.solo, true);
  assert.equal(groups[0].helpers.span, 1);
  assert.equal(groups[1].helpers.span, 2);
  const updated = updateWorkerGroup(rows, groups[0].leader.rowIds, 'leader', 'New leader');
  assert.deepEqual(updated.map((row) => row.leader), ['New leader', 'Idan', 'Idan', 'Ilan']);
  assert.deepEqual(updated.map((row) => row.work), rows.map((row) => row.work));
  assert.equal(rows[0].leader, 'Idan');
});

test('solo work spans the crew columns for every follow-up task without filling in an assistant', () => {
  const rows = ['First task', 'Night task', 'Last task'].map((work, index) => ({
    id: String(index), leader: 'עידן', helpers: '', work,
  }));
  const groups = getWorkerCellGroups(rows);
  assert.equal(groups[0].leader.solo, true);
  assert.equal(groups[0].leader.span, 3);
  assert.deepEqual(groups[0].leader.rowIds, ['0', '1', '2']);
  assert.ok(groups.every((group) => group.helpers.solo));
  const withHelpers = updateWorkerGroup(rows, groups[0].helpers.rowIds, 'helpers', 'Helper A, Helper B');
  assert.equal(getWorkerCellGroups(withHelpers)[0].leader.solo, false);
  assert.deepEqual(withHelpers.map((row) => row.work), rows.map((row) => row.work));
  assert.ok(rows.every((row) => row.helpers === ''));
  assert.equal(getWorkerCellGroups(updateWorkerGroup(withHelpers, ['0', '1', '2'], 'helpers', ''))[0].leader.solo, true);
});

test('does not merge separate occurrences, blank leaders or assistants of different leaders', () => {
  const rows = ['Idan', 'Ilan', 'Idan', '', ''].map((leader, id) => ({ id, leader, helpers: 'Ohad' }));
  assert.ok(getWorkerCellGroups(rows).every((group) => group.leader.span === 1 && group.helpers.span === 1));
});

test('recognizes a unique first name as the same registered worker without rewriting names', () => {
  const rows = [{ id: '1', leader: 'עידן' }, { id: '2', leader: 'עידן שטיינברג' }];
  const workers = [{ id: 'idan', full_name: 'עידן שטיינברג' }];
  assert.equal(getWorkerCellGroups(rows, workers)[0].leader.span, 2);
  assert.equal(rows[0].leader, 'עידן');
  assert.equal(getWorkerCellGroups(rows, [...workers, { id: 'other', full_name: 'עידן אחר' }])[0].leader.span, 1);
});

test('changing merged assistants updates only their task range', () => {
  const rows = [
    { id: '1', leader: 'A', helpers: 'B', projectId: 'first' },
    { id: '2', leader: 'A', helpers: 'B', projectId: 'second' },
    { id: '3', leader: 'A', helpers: 'C', projectId: 'third' },
  ];
  const groups = getWorkerCellGroups(rows);
  const next = updateWorkerGroup(rows, groups[0].helpers.rowIds, 'helpers', 'D, E');
  assert.deepEqual(next.map((row) => row.helpers), ['D, E', 'D, E', 'C']);
  assert.deepEqual(next.map((row) => row.projectId), ['first', 'second', 'third']);
});
