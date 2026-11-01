import test from 'node:test';
import assert from 'node:assert/strict';
import { demoProjectPath, getDemoRoute, getDemoStats, selectDemoProjects } from './workspace.js';

const projects = [
  {
    project_id: 'approved',
    title: 'Original project Ω',
    location: 'Athens',
    summary: 'An approved solution',
    demo_case_studies: [{ id: 'case' }],
  },
  { project_id: 'other', title: 'פרויקט מקורי', summary: '', demo_case_studies: [] },
];

test('the case-study view shows only approved projects that actually have case studies', () => {
  assert.deepEqual(
    selectDemoProjects(projects, { onlyCases: true }).map((row) => row.project_id),
    ['approved'],
  );
  assert.deepEqual(selectDemoProjects(projects, { query: '  ATHENS ' }), [projects[0]]);
  assert.deepEqual(selectDemoProjects(projects, { query: 'פרויקט' }), [projects[1]]);
  assert.deepEqual(selectDemoProjects(projects, { query: 'unknown' }), []);
  assert.deepEqual(getDemoStats(projects), { total: 2, caseStudies: 1 });
});

test('project links preserve the case-study view, escape identifiers and resolve overview separately', () => {
  const path = demoProjectPath('id&view=overview', true);
  assert.deepEqual(getDemoRoute(path), { view: 'cases', projectId: 'id&view=overview' });
  assert.deepEqual(getDemoRoute('/app/overview?project=unapproved'), {
    view: 'overview',
    projectId: null,
  });
  assert.deepEqual(getDemoRoute('/app/projects'), { view: 'projects', projectId: null });
});
