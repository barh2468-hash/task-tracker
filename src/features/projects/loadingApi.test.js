import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { transformSync } from 'esbuild';
import { isManagerRole } from '../../utils/roles.js';

function loadingApi(projectsApi) {
  const source = transformSync(readFileSync(new URL('./api.js', import.meta.url), 'utf8'), { format: 'cjs' }).code;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', source)((name) => {
    if (name === '../../services/api/projects.js') return projectsApi;
    if (name === '../../services/api/auth.js') return { getCurrentUser: () => { throw new Error('Redundant auth read'); } };
    if (name === '../../utils/roles.js') return { isManagerRole };
    return {};
  }, module, module.exports);
  return module.exports;
}

test('managers load with the authenticated profile without a second auth network request', async () => {
  const api = loadingApi({ getProjectsForManager: async () => ({ data: [{ id: 'project' }] }) });
  for (const role of ['manager', 'admin']) assert.deepEqual(await api.getProjects({ id: 'user', role }), [{ id: 'project' }]);
});

test('worker and drafter assignment errors propagate instead of looking like an empty list', async () => {
  const error = { code: '57014', message: 'timeout' };
  const api = loadingApi({ getProjectIdsForWorker: async () => ({ error }) });
  for (const role of ['field_worker', 'drafter']) {
    await assert.rejects(api.getProjects({ id: 'user', role }), (received) => received === error);
  }
});

test('field workers retain lead and extra assignment filters and server denials propagate', async () => {
  let filters;
  const error = { code: '42501' };
  const api = loadingApi({
    getProjectIdsForWorker: async () => ({ data: [{ project_id: 'extra' }] }),
    getProjectsByAssignmentOr: async (value) => { filters = value; return { error }; },
  });
  await assert.rejects(api.getProjects({ id: 'worker', role: 'field_worker' }), (received) => received === error);
  assert.deepEqual(filters, ['assigned_to.eq.worker', 'id.in.(extra)']);
});
