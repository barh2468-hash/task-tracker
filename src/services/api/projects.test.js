import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { transformSync } from 'esbuild';
import { hydrateProjectTasks } from './projectGraph.js';
import { readProjectPages } from './readProjectPages.js';

function apiFixture({ failHistory = false, withoutReports = false, failWorkSessions = false } = {}) {
  const calls = [];
  const rows = {
    projects: [{ id: 'project', name: 'שם שהוזן' }],
    project_tasks: [{ id: 'task', project_id: 'project', latest_report_id: withoutReports ? null : 'new' }],
    project_task_reports: withoutReports ? [] : [
      { id: 'old', task_id: 'task', project_id: 'project', summary: 'Earlier user text' },
      { id: 'new', task_id: 'task', project_id: 'project', summary: 'Latest user text' },
      { id: 'unrelated', task_id: 'hidden', project_id: 'hidden' },
    ],
    work_sessions: [
      ...Array.from({ length: 145 }, (_, index) => ({ id: `session-${index}`, project_id: 'project',
        end_note: `Original note ${index}`, profiles: { full_name: 'Reporter' } })),
      { id: 'unrelated-session', project_id: 'hidden', end_note: 'Private note' },
    ],
  };
  const supabase = { from(table) {
    const filters = [];
    let fields;
    const response = () => {
      calls.push({ table, fields, filters: [...filters] });
      if (failWorkSessions && table === 'work_sessions') return { error: { code: '42501' }, status: 403 };
      if (failHistory && table === 'project_task_reports' && filters.some(([op]) => op === 'eq'))
        return { error: { code: '57014' }, status: 500 };
      return { data: (rows[table] || []).filter((row) => filters.every(([op, field, value]) =>
        op === 'eq' ? row[field] === value : value.includes(row[field]))) };
    };
    return { select(value) { fields = value; return this; }, order() { return this; },
      in(field, values) { filters.push(['in', field, values]); return this; },
      eq(field, value) { filters.push(['eq', field, value]); return this; },
      async range(from, to) { const result = response(); return result.error ? result : { ...result, data: result.data.slice(from, to + 1) }; },
      then(resolve, reject) { return Promise.resolve(response()).then(resolve, reject); },
    };
  } };
  const source = transformSync(readFileSync(new URL('./projects.js', import.meta.url), 'utf8'), { format: 'cjs' }).code;
  const module = { exports: {} };
  const imports = { '../supabase.js': { supabase }, './drawingBatches.js': { getDrawingBatches: async () => ({ data: [] }) },
    './readProjectPages.js': { readProjectPages }, './projectGraph.js': { hydrateProjectTasks } };
  new Function('require', 'module', 'exports', source)((name) => {
    assert.ok(name in imports, name);
    return imports[name];
  }, module, module.exports);
  return { api: module.exports, calls };
}

test('project lists read only latest reports; opening a project retrieves full isolated history', async () => {
  const { api, calls } = apiFixture();
  const projects = await api.getProjectsForManager();
  assert.equal(projects.data[0].name, 'שם שהוזן');
  assert.deepEqual(projects.data[0].project_tasks[0].project_task_reports.map((r) => r.id), ['new']);
  assert.ok(!calls.find((call) => call.table === 'projects').fields.includes('project_tasks'));
  assert.deepEqual(calls.find((call) => call.table === 'project_task_reports').filters, [['in', 'id', ['new']]]);
  const assets = await api.getProjectAssets('project');
  assert.deepEqual(assets.project_task_reports.map((r) => r.id), ['old', 'new']);
  assert.ok(!assets.project_task_reports.some((r) => r.id === 'unrelated'));
});

test('lists with no report pointers skip report requests', async () => {
  const { api, calls } = apiFixture({ withoutReports: true });
  const result = await api.getProjectsForManager();
  assert.deepEqual(result.data[0].project_tasks[0].project_task_reports, []);
  assert.ok(!calls.some((call) => call.table === 'project_task_reports'));
});

test('failure to read full report history rejects project details rather than implying empty history', async () => {
  const { api } = apiFixture({ failHistory: true });
  await assert.rejects(api.getProjectAssets('project'), (error) => error.code === '57014');
});

test('opening a project loads every page of its work sessions with current notes and reporter names', async () => {
  const { api, calls } = apiFixture();
  await api.getProjectsForManager();
  assert.ok(!calls.some((call) => call.table === 'work_sessions'));
  const assets = await api.getProjectAssets('project');
  assert.equal(assets.work_sessions.length, 145);
  assert.equal(assets.work_sessions[144].end_note, 'Original note 144');
  assert.equal(assets.work_sessions[0].profiles.full_name, 'Reporter');
  const reads = calls.filter((call) => call.table === 'work_sessions');
  assert.equal(reads.length, 2);
  assert.ok(reads.every((call) => call.fields.includes('profiles:worker_id(full_name)')));
  assert.ok(reads.every((call) => JSON.stringify(call.filters) === JSON.stringify([['eq', 'project_id', 'project']])));
});

test('a denied work session query cannot produce a misleading empty project report', async () => {
  const { api } = apiFixture({ failWorkSessions: true });
  await assert.rejects(api.getProjectAssets('project'), (error) => error.code === '42501');
});
