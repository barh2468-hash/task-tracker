import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { transformSync } from 'esbuild';
import * as projectFiles from './utils/projectFiles.js';
import { uploadContinuationAttachments } from './continuationAttachments.js';
import { localeForLanguage } from '../language/locale.js';
import { isManagerRole } from '../../utils/roles.js';

const project = { id: 'project', assigned_to: 'worker', name: 'בית הלוחם', status: 'נשלח להגהה' };
const profile = { id: 'worker', role: 'field_worker', full_name: 'גרמן' };
const pdf = (name) => new File(['pdf'], name, { type: 'application/pdf' });
const report = (attachments, drawingBatchId) => ({
  workDate: '2026-11-05',
  updateType: 'correction',
  reviewImpact: 'unsure',
  summary: 'תיקונים לשרטוט',
  attachments,
  drawingBatchId,
});

function fixture(
  t,
  {
    failUpload = () => false,
    batchError = null,
    notificationError = false,
    insertError = null,
    historyError = false,
  } = {},
) {
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
  t.after(() => {
    delete navigator.onLine;
  });
  const calls = { batches: [], reads: [], uploads: [], documents: [], notifications: [] };
  const batch = {
    id: 'saved-batch',
    project_id: project.id,
    batch_number: 1,
    assigned_drafter: 'drafter',
  };
  const dependencies = {
    '../../services/api/auth.js': { getCurrentUser: async () => ({ id: 'worker' }) },
    '../../utils/roles.js': { isManagerRole },
    './utils/drafters.js': { findAssignedDrafter: () => ({ worker_id: 'drafter' }) },
    './utils/projectFiles.js': projectFiles,
    './continuationAttachments.js': { uploadContinuationAttachments },
    '../language/locale.js': { localeForLanguage },
    i18next: { language: 'he' },
    '../language/LanguageContext.jsx': {
      t: (key, options = {}) => key.replace(/{{(\w+)}}/g, (_, name) => options[name] ?? ''),
    },
    '../../services/api/drawingBatches.js': {
      insertDrawingBatch: async (payload) => {
        calls.batches.push(payload);
        return { data: batch, error: insertError };
      },
      getDrawingBatch: async (...args) => {
        calls.reads.push(args);
        return { data: batch, error: batchError };
      },
    },
    '../../services/api/storage.js': {
      safeFileName: (name) => name,
      uploadFile: async (_bucket, _path, file) => {
        calls.uploads.push(file);
        const failure = failUpload(file);
        if (failure instanceof Error) throw failure;
        return failure ? { error: { message: 'Upload failed' } } : {};
      },
      removeFiles: async () => ({}),
    },
    '../../services/api/projectDocuments.js': {
      insertProjectDocument: async (payload) => {
        calls.documents.push(payload);
        return {};
      },
    },
    '../../services/api/statusHistory.js': {
      insertStatusHistory: async () => {
        if (historyError) throw new Error('History failed');
        return {};
      },
    },
    '../notifications/api.js': {
      createManagerNotification: async (...args) => {
        if (notificationError) throw new Error('Notification failed');
        calls.notifications.push(args);
      },
      createUserNotification: async (...args) => calls.notifications.push(args),
    },
  };
  const source = transformSync(readFileSync(new URL('./api.js', import.meta.url), 'utf8'), {
    format: 'cjs',
  }).code;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', source)(
    (name) => dependencies[name] || {},
    module,
    module.exports,
  );
  return { api: module.exports, calls, batch };
}

test('failed attachments retain the saved batch and retry only failed files without duplicate batches', async (t) => {
  const good = pdf('שמור.pdf'),
    bad = pdf('תיקונים.pdf');
  let fail = true;
  const { api, calls, batch } = fixture(t, { failUpload: (file) => file === bad && fail });
  const first = await api.submitContinuationReport(project, report([good, bad]), profile);
  assert.equal(first.ok, false);
  assert.equal(first.drawingBatch.id, batch.id);
  assert.deepEqual(first.failedAttachments, [bad]);
  assert.equal(calls.notifications.length, 0);
  assert.equal(calls.documents.length, 1);
  fail = false;
  const second = await api.submitContinuationReport(
    project,
    report(first.failedAttachments, batch.id),
    profile,
  );
  assert.equal(second.ok, true);
  assert.equal(calls.batches.length, 1);
  assert.deepEqual(calls.reads, [[project.id, batch.id]]);
  assert.deepEqual(calls.uploads, [good, bad, bad]);
  assert.deepEqual(
    calls.documents.map((doc) => doc.drawing_batch_id),
    [batch.id, batch.id],
  );
  assert.deepEqual(
    calls.documents.map((doc) => doc.file_name),
    ['שמור.pdf', 'תיקונים.pdf'],
  );
});

test('a thrown upload error preserves its File and continues uploading other selected files', async (t) => {
  const bad = pdf('bad.pdf'),
    good = pdf('good.pdf');
  const { api, calls } = fixture(t, {
    failUpload: (file) => file === bad && new Error('Network failed'),
  });
  const result = await api.submitContinuationReport(project, report([bad, good]), profile);
  assert.equal(result.ok, false);
  assert.deepEqual(result.failedAttachments, [bad]);
  assert.equal(calls.documents[0].file_name, good.name);
});

test('invalid or oversized attachments fail before a batch is created', async (t) => {
  const { api, calls } = fixture(t);
  for (const file of [
    new File([], 'empty.pdf'),
    new File(['text'], 'notes.txt'),
    { name: 'large.pdf', type: 'application/pdf', size: projectFiles.MAX_PROJECT_FILE_SIZE + 1 },
  ]) {
    const result = await api.submitContinuationReport(project, report([file]), profile);
    assert.equal(result.ok, false);
    assert.ok(result.reasonKey);
  }
  assert.equal(calls.batches.length, 0);
  assert.equal(calls.uploads.length, 0);
});

test('a retry denied by the project-scoped batch read cannot upload or create another batch', async (t) => {
  const { api, calls } = fixture(t, { batchError: { message: 'Not found' } });
  const result = await api.submitContinuationReport(
    project,
    report([pdf('plan.pdf')], 'other-batch'),
    profile,
  );
  assert.equal(result.ok, false);
  assert.deepEqual(calls.reads, [[project.id, 'other-batch']]);
  assert.equal(calls.batches.length, 0);
  assert.equal(calls.uploads.length, 0);
});

test('reports without optional files still succeed and notification failures do not lose saved files', async (t) => {
  const { api, calls } = fixture(t, { notificationError: true });
  t.mock.method(console, 'warn', () => {});
  assert.equal((await api.submitContinuationReport(project, report([]), profile)).ok, true);
  assert.equal(
    (await api.submitContinuationReport(project, report([pdf('plan.pdf')]), profile)).ok,
    true,
  );
  assert.equal(calls.documents.length, 1);
});

test('an uncertain batch insert recovers the same draft UUID under the current project', async (t) => {
  const { api, calls } = fixture(t, { insertError: { message: 'Response timed out' } });
  const result = await api.submitContinuationReport(
    project,
    { ...report([pdf('plan.pdf')]), requestId: 'stable-draft-id' },
    profile,
  );
  assert.equal(result.ok, true);
  assert.equal(calls.batches[0].id, 'stable-draft-id');
  assert.deepEqual(calls.reads, [[project.id, 'stable-draft-id']]);
  assert.equal(calls.documents.length, 1);
});

test('a history write failure after the file is saved does not mark that file for re-upload', async (t) => {
  const { api, calls } = fixture(t, { historyError: true });
  t.mock.method(console, 'warn', () => {});
  const result = await api.submitContinuationReport(project, report([pdf('plan.pdf')]), profile);
  assert.equal(result.ok, true);
  assert.equal(result.failedAttachments, undefined);
  assert.equal(calls.documents.length, 1);
  assert.equal(calls.uploads.length, 1);
});
