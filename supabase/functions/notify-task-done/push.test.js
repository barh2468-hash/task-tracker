import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deliverTaskReportPush } from './push.js';
function fixture({ disabled = false, read = false, expired = false } = {}) {
  const deleted = [],
    sent = [];
  const client = {
    from: (table) => {
      let count = false,
        remove = false;
      const query = {
        select: (_fields, options) => {
          count = Boolean(options?.count);
          return query;
        },
        eq: () => query,
        in: () => query,
        delete: () => {
          remove = true;
          return query;
        },
        maybeSingle: async () => ({
          data: {
            id: 'notice',
            recipient_id: 'recipient',
            type: 'task_done',
            delivery_enabled: !disabled,
            is_read: read,
          },
        }),
        then: (resolve) => {
          if (remove) deleted.push(table);
          return Promise.resolve({
            data:
              table === 'push_subscriptions'
                ? [{ id: 'sub', endpoint: 'https://push.example.com', p256dh: 'key', auth: 'auth' }]
                : [],
            count: count ? 3 : null,
          }).then(resolve);
        },
      };
      return query;
    },
  };
  const sendPush = async (_subscription, body) => {
    if (expired) throw { statusCode: 410 };
    sent.push(JSON.parse(body));
  };
  return { client, sendPush, deleted, sent };
}
const job = {
  notification_id: 'notice',
  recipient_id: 'recipient',
  report_id: 'report',
  project_name: 'Project',
  worker_name: 'Worker',
  report: {
    project_id: 'project',
    language: 'en',
    outcome: 'partial',
    summary: 'One pipe measured',
    request_title: 'Original request',
  },
};
test('report Push targets the saved notice and deep-links to the task history', async () => {
  const f = fixture();
  await deliverTaskReportPush(job, { ...f, configured: true });
  assert.equal(f.sent.length, 1);
  assert.match(f.sent[0].title, /Partially completed/);
  assert.equal(f.sent[0].tag, 'task-report-report');
  assert.match(f.sent[0].url, /tab=tasks/);
  assert.equal(f.sent[0].badgeCount, 3);
});
test('disabled or read notifications do not produce Push', async () => {
  for (const options of [{ disabled: true }, { read: true }]) {
    const f = fixture(options);
    await deliverTaskReportPush(job, { ...f, configured: true });
    assert.equal(f.sent.length, 0);
  }
});
test('expired Push subscriptions are removed without blocking delivery', async () => {
  const f = fixture({ expired: true });
  await deliverTaskReportPush(job, { ...f, configured: true });
  assert.deepEqual(f.deleted, ['push_subscriptions']);
});
