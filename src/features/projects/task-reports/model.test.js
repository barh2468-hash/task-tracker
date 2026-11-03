import test from 'node:test';
import assert from 'node:assert/strict';
import { validateTaskReport, latestTaskReport, tasksWithReportHistory } from './model.js';
import { heTaskReports, enTaskReports, elTaskReports } from './translations.js';

const report = {
  outcome: 'completed',
  summary: 'הקו נמדד במלואו',
  next_steps: '',
  ready_for_drafting: false,
  files: [],
  document_ids: [],
};

test('open project history preserves earlier reports, the latest pointer and pending offline reports', () => {
  const pending = { id: 'queued', task_id: 'task', pending_sync: true, summary: 'User text unchanged' };
  const latest = { id: 'latest', task_id: 'task', created_at: '2026-11-03' };
  const tasks = [{ id: 'task', latest_report_id: 'queued', project_task_reports: [latest, pending] }, { id: 'empty' }];
  const old = { id: 'old', task_id: 'task', created_at: '2026-11-01' };
  const merged = tasksWithReportHistory(tasks, [old, latest, { id: 'other', task_id: 'hidden' }]);
  assert.deepEqual(merged[0].project_task_reports, [old, latest, pending]);
  assert.equal(latestTaskReport(merged[0]), pending);
  assert.deepEqual(merged[1].project_task_reports, []);
  assert.equal(tasks[0].project_task_reports.length, 2);
});
test('partial and blocked reports require follow-up and cannot be mistaken for completion', () => {
  for (const outcome of ['partial', 'blocked']) {
    assert.ok(validateTaskReport({ ...report, outcome }));
    assert.equal(validateTaskReport({ ...report, outcome, next_steps: 'נדרשת פתיחת השוחה' }), '');
  }
  assert.ok(
    validateTaskReport({
      ...report,
      outcome: 'blocked',
      next_steps: 'Clarification needed',
      ready_for_drafting: true,
    }),
  );
  assert.equal(
    validateTaskReport({
      ...report,
      outcome: 'partial',
      next_steps: 'Return visit required',
      ready_for_drafting: true,
    }),
    '',
  );
  assert.ok(validateTaskReport({ ...report, summary: '    ' }));
  assert.ok(
    validateTaskReport({
      ...report,
      files: [{ file: { name: 'virus.exe', size: 100, type: 'application/x-msdownload' } }],
    }),
  );
  assert.ok(validateTaskReport({ ...report, document_ids: Array(11).fill('document') }));
});
test('latest report follows the task pointer and preserves previous reports', () => {
  const reports = [
    { id: 'first', created_at: '2026-11-01', outcome: 'completed' },
    { id: 'second', created_at: '2026-11-02', outcome: 'reopened' },
  ];
  assert.equal(
    latestTaskReport({ latest_report_id: 'second', project_task_reports: reports }).outcome,
    'reopened',
  );
  assert.equal(latestTaskReport({ project_task_reports: reports }).id, 'second');
  assert.equal(reports[0].id, 'first');
});
test('all new report labels and validation messages have complete English and Greek translations', () => {
  for (const key of Object.keys(heTaskReports)) {
    assert.ok(enTaskReports[key], key);
    assert.ok(elTaskReports[key], key);
    assert.doesNotMatch(enTaskReports[key], /[א-ת]/, key);
    assert.doesNotMatch(elTaskReports[key], /[א-ת]/, key);
    for (const match of key.matchAll(/\{\{\w+\}\}/g)) {
      assert.ok(enTaskReports[key].includes(match[0]), key);
      assert.ok(elTaskReports[key].includes(match[0]), key);
    }
  }
});
