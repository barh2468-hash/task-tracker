import test from 'node:test';
import assert from 'node:assert/strict';
import { getPlanProjectChoices, resolvePlanWorker } from './projectChoices.js';

const workers = [
  { id: 'raz', full_name: 'רז ינאי' },
  { id: 'bar-a', full_name: 'בר חדידא\r\n' },
  { id: 'bar-b', full_name: 'בר מרחב' },
  { id: 'ilan', full_name: 'אילן ברנמן' },
  { id: 'il', full_name: 'איל ברנמן' },
  { id: 'angela', full_name: 'Angela Example' },
  { full_name: 'רז' },
  { full_name: 'שם מהאקסל בלבד' },
];
const projects = [
  { id: 'lead-project', name: 'Assigned as lead', assigned_to: 'raz' },
  { id: 'extra-project', name: 'Assigned as additional worker', assigned_to: 'bar-a', project_workers: [{ worker_id: 'raz' }] },
  { id: 'unrelated', name: 'Another worker', assigned_to: 'ilan' },
  { id: 'archived', name: 'Archived', assigned_to: 'raz', is_archived: true },
  { id: 'unassigned', name: 'Unassigned' },
  { id: 'workbook-only', name: 'Imported from workbook, no system assignment' },
];

test('full names and unique first names resolve to the real system worker', () => {
  assert.equal(resolvePlanWorker('רז', workers).worker.id, 'raz');
  assert.equal(resolvePlanWorker('  בר   חדידא  ', workers).worker.id, 'bar-a');
  assert.equal(resolvePlanWorker('ANGELA EXAMPLE', workers).worker.id, 'angela');
  assert.equal(resolvePlanWorker('איל', workers).worker.id, 'il');
  assert.equal(resolvePlanWorker('אילן', workers).worker.id, 'ilan');
});

test('ambiguous, unknown and blank names never choose an arbitrary worker', () => {
  assert.equal(resolvePlanWorker('בר', workers).status, 'ambiguous');
  assert.equal(resolvePlanWorker('', workers).status, 'missing');
  assert.equal(resolvePlanWorker('שם מהאקסל בלבד', workers).status, 'unknown');
  assert.equal(resolvePlanWorker('רז, אילן', workers).status, 'unknown');
  assert.equal(resolvePlanWorker('רז ינ', workers).status, 'unknown');
  const sameName = [...workers, { id: 'second-raz', full_name: 'רז ינאי' }];
  assert.equal(resolvePlanWorker('רז ינאי', sameName).status, 'ambiguous');
  assert.equal(resolvePlanWorker('רז', sameName).status, 'ambiguous');
});

test('choices include primary and additional assignments and exclude all other projects', () => {
  assert.deepEqual(getPlanProjectChoices('רז', workers, projects).projects.map((project) => project.id), ['lead-project', 'extra-project']);
  assert.deepEqual(getPlanProjectChoices('אילן', workers, projects).projects.map((project) => project.id), ['unrelated']);
  for (const name of ['', 'לא מוכר', 'בר', 'שם מהאקסל בלבד']) {
    assert.deepEqual(getPlanProjectChoices(name, workers, projects).projects, []);
  }
  assert.deepEqual(getPlanProjectChoices('איל', workers, projects).projects, []);
});

test('changing the worker or live assignments recalculates the choices without altering plan data', () => {
  const row = { leader: 'רז', work: 'משימה מהאקסל', notes: 'הערה מקורית' };
  const snapshot = structuredClone(row);
  assert.equal(getPlanProjectChoices(row.leader, workers, projects).projects.length, 2);
  const reassigned = projects.map((project) => project.id === 'lead-project' ? { ...project, assigned_to: 'ilan' } : project);
  assert.deepEqual(getPlanProjectChoices(row.leader, workers, reassigned).projects.map((project) => project.id), ['extra-project']);
  assert.deepEqual(row, snapshot);
  assert.equal(getPlanProjectChoices('רז', [...workers, workers[0]], [...projects, projects[0]]).projects.length, 2);
});
