import test from 'node:test';
import assert from 'node:assert/strict';
import { buildOverviewAttention, getOverviewActivity } from './overview.js';

const daysAgo = (days) => new Date(Date.now() - days * 86400000).toISOString();
const project = (id, fields = {}) => ({
  id,
  status: 'בעבודה בשטח',
  assigned_to: 'worker',
  updated_at: daysAgo(0),
  ...fields,
});

test('follow-up groups issues by project, excludes archive and orders by oldest update', () => {
  const projects = [
    project('healthy'),
    project('medium', { updated_at: daysAgo(5) }),
    project('task', {
      assigned_to: null,
      updated_at: daysAgo(10),
      project_tasks: [{ title: 'Follow up', created_at: daysAgo(20), is_done: false }],
    }),
    project('work', { work_sessions: [{ started_at: daysAgo(1), ended_at: null }] }),
    project('archive', { is_archived: true, assigned_to: null }),
  ];
  const result = buildOverviewAttention(projects);
  assert.deepEqual(
    result.map((item) => item.project.id),
    ['task', 'medium', 'work'],
  );
  assert.equal(result[0].type, 'old_task');
  assert.equal(result[0].issueCount, 3);
  assert.equal(result[0].ageValue, 20);
  assert.equal(result[0].ageUnit, 'days');
  assert.equal(result[2].ageUnit, 'hours');
  assert.ok(result[2].ageValue >= 24);
  assert.deepEqual(buildOverviewAttention([]), []);
});

test('an unassigned project age explicitly refers to creation, not assignment duration', () => {
  const result = buildOverviewAttention([
    project('unassigned', { assigned_to: null, created_at: daysAgo(12) }),
    project('unknown-date', { assigned_to: null }),
  ]);
  const created = result.find((item) => item.project.id === 'unassigned');
  assert.equal(created.ageUnit, 'created');
  assert.equal(created.ageValue, 12);
  assert.equal(result.find((item) => item.project.id === 'unknown-date').ageValue, undefined);
});

test('activity shows the four newest actual status changes for accessible projects', () => {
  const statuses = ['בעבודה בשטח', 'עבר לשרטוט'];
  const changes = Array.from({ length: 6 }, (_, index) => ({
    id: String(index),
    project_id: 'visible',
    created_at: daysAgo(index),
    old_status: statuses[0],
    new_status: statuses[1],
  }));
  const skipped = [
    { ...changes[0], id: 'hidden', project_id: 'hidden' },
    { ...changes[0], id: 'work-start', new_status: 'התחלת עבודה' },
    { ...changes[0], id: 'same-status', old_status: statuses[1] },
    { ...changes[0], id: 'bad-date', created_at: 'invalid' },
  ];
  const result = getOverviewActivity(
    [...skipped, ...changes.toReversed()],
    [project('visible')],
    statuses,
  );
  assert.deepEqual(
    result.map((item) => item.id),
    ['0', '1', '2', '3'],
  );
  assert.ok(result.every((item) => item.project.id === 'visible'));
  assert.deepEqual(getOverviewActivity(changes, [], statuses), []);
});
