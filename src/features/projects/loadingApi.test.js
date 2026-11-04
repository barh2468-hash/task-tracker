import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { transformSync } from 'esbuild';
import { isManagerRole } from '../../utils/roles.js';

function loadingApi(projectsApi, offlineStore = {}) {
  const source = transformSync(readFileSync(new URL('./api.js', import.meta.url), 'utf8'), { format: 'cjs' }).code;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', source)((name) => {
    if (name === '../../services/api/projects.js') return projectsApi;
    if (name === '../../services/offlineStore.js') return offlineStore;
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

test('full project details are cached per account and remain available offline', async (context) => {
  const assets = { project_task_reports: [{ id: 'older', summary: 'Original notes' }],
    work_sessions: [{ id: 'session', end_note: 'Current work note', profiles: { full_name: 'Reporter' } }] };
  const cache = new Map();
  let reads = 0;
  const api = loadingApi({ getProjectAssets: async () => { reads += 1; return assets; } }, {
    cacheOfflineData: async (key, value) => cache.set(key, value),
    getOfflineData: async (key) => cache.get(key),
  });
  assert.equal(await api.getProjectAssets('project', 'account-a'), assets);
  await Promise.resolve();
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });
  context.after(() => { delete navigator.onLine; });
  assert.equal(await api.getProjectAssets('project', 'account-a'), assets);
  await assert.rejects(api.getProjectAssets('project', 'account-b'), /unavailable/);
  assert.equal(reads, 1);
});

test('an unavailable device cache cannot discard valid online report history', async () => {
  const assets = { project_task_reports: [{ id: 'report' }] };
  const api = loadingApi({ getProjectAssets: async () => assets }, {
    cacheOfflineData: async () => { throw new Error('Device full'); },
  });
  assert.equal(await api.getProjectAssets('project', 'account'), assets);
  await Promise.resolve();
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
