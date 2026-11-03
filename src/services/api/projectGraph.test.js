import test from 'node:test';
import assert from 'node:assert/strict';
import { hydrateProjectTasks } from './projectGraph.js';

test('independent reads preserve team, task, creator, latest report and reporter fields', async () => {
  const project = { id: 'p', name: 'שם מקורי', project_workers: [{ worker_id: 'worker' }] };
  const task = { id: 't', project_id: 'p', latest_report_id: 'r', profiles: { full_name: 'יוצר' } };
  const report = { id: 'r', task_id: 't', reporter: { full_name: 'מדווח' }, summary: 'טקסט מקורי' };
  const result = await hydrateProjectTasks({ data: [project, { id: 'empty' }], status: 200 },
    async (ids) => { assert.deepEqual(ids, ['p','empty']); return { data: [task] }; },
    async (ids) => { assert.deepEqual(ids, ['t']); return { data: [report] }; });
  assert.deepEqual(result.data, [{ ...project, project_tasks: [{ ...task, project_task_reports: [report] }] },
    { id: 'empty', project_tasks: [] }]);
});

test('project and task ID filters remain bounded and records from other projects are never attached', async () => {
  const projects = Array.from({ length: 181 }, (_, id) => ({ id: `p-${id}` }));
  const calls = [];
  const result = await hydrateProjectTasks({ data: projects }, async (ids) => {
    assert.ok(ids.length <= 80);
    calls.push(...ids);
    return { data: [...ids.map((id) => ({ id: `task-${id}`, project_id: id })), { id:'unrelated',project_id:'hidden' }] };
  }, async (ids) => { assert.ok(ids.length <= 80); assert.ok(!ids.includes('unrelated')); return { data: [] }; });
  assert.deepEqual(calls, projects.map((p) => p.id));
  assert.equal(result.data.length, 181);
  assert.ok(result.data.every((project) => project.project_tasks.length === 1));
});

test('any task or report failure rejects the whole graph instead of publishing incomplete tasks', async () => {
  const error = { code: '57014' };
  for (const failReports of [false,true]) {
    const result = await hydrateProjectTasks({ data: [{ id: 'p' }] },
      async () => failReports ? { data: [{ id:'t',project_id:'p' }] } : { error },
      async () => ({ error }));
    assert.equal(result.data, null);
    assert.equal(result.error, error);
  }
});

test('empty project and task lists do not issue unnecessary child queries', async () => {
  const unexpected = () => { throw new Error('Unexpected child request'); };
  assert.deepEqual(await hydrateProjectTasks({ data: [] },unexpected,unexpected), { data: [] });
  const result = await hydrateProjectTasks({ data: [{ id:'p' }] },async () => ({ data: [] }),unexpected);
  assert.deepEqual(result.data, [{ id:'p',project_tasks: [] }]);
});

test('task reads run at most three at once and retain order when responses finish out of order', async () => {
  const projects = Array.from({ length: 260 }, (_, id) => ({ id: `p-${id}` }));
  const pending = [];
  let running = 0, maximum = 0;
  const resultPromise = hydrateProjectTasks({ data: projects }, (ids) => {
    running += 1;
    maximum = Math.max(maximum,running);
    return new Promise((resolve) => pending.push(() => {
      running -= 1;
      resolve({ data: ids.map((id) => ({ id:`t-${id}`,project_id:id })) });
    }));
  }, async () => ({ data: [] }));
  assert.equal(pending.length,3);
  pending[2]();
  await Promise.resolve();
  assert.equal(pending.length,4);
  pending[3](); pending[1](); pending[0]();
  const result = await resultPromise;
  assert.equal(maximum,3);
  assert.deepEqual(result.data.map((project) => project.project_tasks[0].id),projects.map((project) => `t-${project.id}`));
});

test('a concurrent failure stops unscheduled reads and never publishes a partial graph', async () => {
  const projects = Array.from({ length: 500 }, (_, id) => ({ id }));
  let calls = 0;
  const error = new Error('offline');
  const result = await hydrateProjectTasks({ data: projects }, async () => {
    calls += 1;
    throw error;
  }, () => { throw new Error('Reports must not load after a task failure'); });
  assert.equal(calls,3);
  assert.equal(result.data,null);
  assert.equal(result.error,error);
});
