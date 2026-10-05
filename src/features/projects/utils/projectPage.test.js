import assert from 'node:assert/strict';
import test from 'node:test';
import { getProjectPage } from './projectPage.js';

const projects = Array.from({ length: 1000 }, (_, index) => ({ id: `project-${index}` }));

test('an old notification opens its target while keeping the initial render to 20 cards', () => {
  const page = getProjectPage(projects, 20, 'project-999');
  assert.equal(page.length, 20);
  assert.equal(page[0], projects[999]);
  assert.deepEqual(page.slice(1), projects.slice(0, 19));
  assert.equal(projects[0].id, 'project-0');
  assert.equal(projects[999].id, 'project-999');
});

test('repeated notification opens keep the same bounded list without duplicate targets', () => {
  for (const target of ['project-999', 'project-998', 'project-999', 'project-3']) {
    const page = getProjectPage(projects, 20, target);
    assert.equal(page[0].id, target);
    assert.equal(page.length, 20);
    assert.equal(new Set(page.map((project) => project.id)).size, 20);
  }
});

test('load more includes every project once, preserving the linked target first', () => {
  const first = getProjectPage(projects, 20, 'project-999');
  const second = getProjectPage(projects, 40, 'project-999');
  assert.deepEqual(second.slice(0, 20), first);
  const all = getProjectPage(projects, projects.length, 'project-999');
  assert.equal(all.length, projects.length);
  assert.equal(new Set(all.map((project) => project.id)).size, projects.length);
});

test('missing or inaccessible targets cannot be added to the permitted project list', () => {
  assert.deepEqual(getProjectPage(projects, 20, 'inaccessible'), projects.slice(0, 20));
  assert.deepEqual(getProjectPage([], 20, 'project-999'), []);
});

test('normal filtered lists preserve ordering when no deep-link target applies', () => {
  const filtered = projects.slice(800, 810);
  assert.deepEqual(getProjectPage(filtered, 20, null), filtered);
  assert.deepEqual(getProjectPage(projects, 20, null), projects.slice(0, 20));
  assert.deepEqual(getProjectPage(projects, 20, 'project-0'), projects.slice(0, 20));
});
