import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
const objects = new Set(),
  documents = new Set(),
  calls = [];
let userId = 'worker',
  failUpload = false;
const client = {
  functions: { invoke: () => new Promise(() => {}) },
  auth: { getUser: async () => ({ data: { user: { id: userId } } }) },
  storage: {
    from: () => ({
      upload: async (path) => {
        if (failUpload) return { error: { statusCode: '500' } };
        if (objects.has(path)) return { error: { statusCode: '409' } };
        objects.add(path);
        return {};
      },
    }),
  },
  from: () => ({
    upsert: async (row) => {
      documents.add(row.id);
      return {};
    },
  }),
  rpc: async (_name, args) => {
    calls.push(args);
    return { data: { id: args.p_report.id } };
  },
};
mock.module(new URL('./supabase.js', import.meta.url).href, { namedExports: { supabase: client } });
const { persistTaskReport } = await import('./taskReports.js');
const payload = {
  userId: 'worker',
  projectId: 'project',
  expectedReportId: null,
  report: {
    id: 'report',
    task_id: 'task',
    outcome: 'partial',
    summary: 'First pipe measured',
    next_steps: 'Return to second pipe',
    ready_for_drafting: true,
    document_ids: [],
    files: [{ id: 'document', file: new File(['PDF'], 'סקיצה.pdf', { type: 'application/pdf' }) }],
  },
};
test('offline payloads preserve blobs and stable document/report IDs across retries', async () => {
  const queued = structuredClone(payload);
  await persistTaskReport(queued);
  await persistTaskReport(queued);
  assert.equal(objects.size, 1);
  assert.equal(documents.size, 1);
  assert.equal(calls.length, 2);
  assert.deepEqual(calls[0], calls[1]);
  assert.deepEqual(calls[0].p_report.document_ids, ['document']);
  assert.equal(calls[0].p_report.summary, 'First pipe measured');
  assert.equal(calls[0].p_report.files, undefined);
});
test('a different signed-in account cannot upload or sync another workers report', async () => {
  userId = 'other';
  const count = calls.length;
  await assert.rejects(persistTaskReport(payload), /different signed-in user/);
  assert.equal(calls.length, count);
  userId = 'worker';
});
test('a failed upload cannot submit an incomplete report', async () => {
  failUpload = true;
  const count = calls.length;
  await assert.rejects(persistTaskReport(payload));
  assert.equal(calls.length, count);
  failUpload = false;
});
