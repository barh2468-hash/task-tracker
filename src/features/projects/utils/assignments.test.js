import assert from 'node:assert/strict';
import test from 'node:test';
import { getProjectAssignmentChanges, getProjectTeamAssignments, isProjectAssignedTo, hasProjectAssignment } from './assignments.js';

const project = {
  assigned_to: 'lead',
  project_workers: [
    { worker_id: 'worker', profiles: { role: 'field_worker', full_name: 'עובד' } },
    { worker_id: 'manager', profiles: { role: 'manager', full_name: 'מנהל' } },
    { worker_id: 'admin', profiles: { role: 'admin', full_name: 'מנהל ראשי' } },
    { worker_id: 'drafter', profiles: { role: 'drafter', full_name: 'שרטט' } },
  ],
};

test('a primary assignee or any additional assignee counts as an assignment', () => {
  assert.equal(hasProjectAssignment({ assigned_to: 'lead' }), true);
  assert.equal(hasProjectAssignment({ assigned_to: null, project_workers: [{ worker_id: 'drafter' }] }), true);
  assert.equal(hasProjectAssignment({ assigned_to: null, project_workers: [] }), false);
  assert.equal(hasProjectAssignment({ project_workers: [{}] }), false);
  assert.equal(hasProjectAssignment(undefined), false);
});

test('reopening and saving a team with managers preserves every assignment without repeat notifications', () => {
  const selection = getProjectTeamAssignments(project).map((row) => row.worker_id);
  assert.deepEqual(selection, ['worker', 'manager', 'admin']);
  assert.deepEqual(getProjectAssignmentChanges(project, selection), {
    addedExtraWorkers: [], removedAssignmentIds: [], addedAssignmentIds: [],
  });
});

test('changing additional managers preserves dedicated drafters and adds each new member once', () => {
  assert.deepEqual(getProjectAssignmentChanges(project, ['worker', 'admin', 'new-manager', 'new-manager']), {
    addedExtraWorkers: ['new-manager'],
    removedAssignmentIds: ['manager'],
    addedAssignmentIds: ['new-manager'],
  });
});

test('an editable manager with a legacy drafter name can be removed from the team', () => {
  const legacyProject = {
    project_workers: [
      { worker_id: 'legacy-manager', profiles: { role: 'manager', full_name: 'דודי דה פלאצי' } },
      project.project_workers[3],
    ],
  };
  assert.deepEqual(getProjectAssignmentChanges(legacyProject, []), {
    addedExtraWorkers: [], removedAssignmentIds: ['legacy-manager'], addedAssignmentIds: [],
  });
});

test('my projects includes additional managers and excludes unrelated or missing users', () => {
  for (const userId of ['lead', 'worker', 'manager', 'admin']) assert.equal(isProjectAssignedTo(project, userId), true);
  for (const userId of ['unrelated', undefined, '']) assert.equal(isProjectAssignedTo(project, userId), false);
});
