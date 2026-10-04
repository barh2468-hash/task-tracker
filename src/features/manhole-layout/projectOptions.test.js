import assert from 'node:assert/strict';
import test from 'node:test';
import { getSheetProjectOptions } from './projectOptions.js';

const projects = [
  { id: 'primary', name: 'פרויקט ראשי', assigned_to: 'worker-a', reference_number: '7000002' },
  { id: 'shared', name: 'פרויקט משותף', assigned_to: 'worker-b', project_workers: [{ worker_id: 'worker-a' }], reference_number: '7000001' },
  { id: 'other', name: 'פרויקט של עובד אחר', assigned_to: 'worker-b' },
  { id: 'archived', name: 'פרויקט בארכיון', assigned_to: 'worker-a', is_archived: true },
  { id: 'unassigned', name: 'פרויקט ללא שיוך' },
];

test('field workers receive primary and additional assignments, excluding other workers and archive', () => {
  assert.deepEqual(getSheetProjectOptions(projects, 'worker-a', 'field_worker').map(project => project.id), ['shared', 'primary']);
  assert.deepEqual(getSheetProjectOptions(projects, 'worker-b', 'field_worker').map(project => project.id), ['shared', 'other']);
  assert.deepEqual(getSheetProjectOptions(projects, 'worker-c', 'field_worker'), []);
});

test('managers see all active accessible projects, without exposing assignment or contact details to the frame', () => {
  const options = getSheetProjectOptions(projects, 'manager', 'manager');
  assert.equal(options.length, 4);
  for (const option of options) assert.deepEqual(Object.keys(option), ['id', 'name', 'label']);
  assert.deepEqual(projects.map(project => project.id), ['primary', 'shared', 'other', 'archived', 'unassigned']);
});

test('missing auth profile produces no projects and duplicate names retain distinct project identities', () => {
  assert.deepEqual(getSheetProjectOptions(projects, undefined, 'field_worker'), []);
  assert.deepEqual(getSheetProjectOptions(projects, 'worker-a', undefined), []);
  const sameNames = [
    { id: 'a', name: 'אותו שם', location: 'צפון', assigned_to: 'worker-a' },
    { id: 'b', name: 'אותו שם', location: 'דרום', assigned_to: 'worker-a' },
  ];
  const options = getSheetProjectOptions(sameNames, 'worker-a', 'field_worker');
  assert.equal(new Set(options.map(project => project.id)).size, 2);
  assert.notEqual(options[0].label, options[1].label);
});
