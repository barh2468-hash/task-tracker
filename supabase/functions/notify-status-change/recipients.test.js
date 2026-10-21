import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { transformSync } from 'esbuild';
import { getStatusEmailRecipients } from './recipients.js';
import { notifyReviewApprovedDrafters } from './notifications.js';

const drafter = { id: 'drafter', role: 'drafter', full_name: "רוג'אן דאהר", email: 'drafter@example.com' };
const manager = { role: 'manager', email: 'manager@example.com' };

function fixture({ managers = [manager], workers = [drafter], status = 'עבר לשרטוט', assignmentError = null, accessible = true, pushFails = false, notificationFailsFor = null, emailFails = false } = {}) {
  const queries = [];
  const emails = [];
  const notifications = [], pushes = [];
  const client = {
    async rpc(name, payload) {
      assert.equal(name, 'create_user_notification');
      if (payload.p_user_id === notificationFailsFor) return { error: new Error('Notification unavailable') };
      notifications.push(payload);
      return { data: 'notification-id' };
    },
    functions: { async invoke(name, { body }) {
      assert.equal(name, 'send-push-notification');
      assert.ok(notifications.some((n) => n.p_user_id === body.recipientUserId && n.p_title === body.title));
      pushes.push(body);
      return pushFails ? { error: new Error('Push unavailable') } : { data: { ok: true } };
    } },
    auth: { async getUser() { return { data: { user: { id: 'field-worker' } } }; } },
    from(table) {
      const query = { table, filters: [] };
      queries.push(query);
      const builder = {
        select() { return this; },
        eq(key, value) { query.filters.push([key, value]); return this; },
        in() { return this; }, not() { return this; },
        order() { return this; }, limit() { return this; },
        maybeSingle() { query.single = true; return this; },
        then(resolve, reject) {
          const data = table === 'profiles'
            ? query.single ? { id: 'field-worker', role: 'field_worker', full_name: 'Worker' } : managers
            : table === 'projects' ? accessible ? { id: 'project', status } : null
            : table === 'project_workers' ? workers.map((profiles) => ({ profiles }))
            : null;
          return Promise.resolve({ data, error: table === 'project_workers' ? assignmentError : null }).then(resolve, reject);
        },
      };
      return builder;
    },
  };
  return { client, queries, emails, status, notifications, pushes, emailFails };
}

test('drafting emails go to the assigned drafter and managers without requiring assignment', async () => {
  const f = fixture();
  const result = await getStatusEmailRecipients(f.client, 'project', f.status);
  assert.deepEqual(result.recipients, ['manager@example.com', 'drafter@example.com']);
  assert.equal(result.awaitingDrafterAssignment, false);
  assert.deepEqual(f.queries.find((q) => q.table === 'project_workers').filters, [['project_id', 'project']]);
});

test('without an assigned drafter, managers still receive the assignment request', async () => {
  const f = fixture({ workers: [{ role: 'field_worker', email: 'field@example.com' }] });
  const result = await getStatusEmailRecipients(f.client, 'project', f.status);
  assert.deepEqual(result.recipients, ['manager@example.com']);
  assert.equal(result.awaitingDrafterAssignment, true);
});

test('other statuses keep management recipients and do not query drafter assignments', async () => {
  const f = fixture({ status: 'בעבודה בשטח' });
  const result = await getStatusEmailRecipients(f.client, 'project', f.status);
  assert.deepEqual(result.recipients, ['manager@example.com']);
  assert.equal(result.isDrafting, false);
  assert.equal(result.awaitingDrafterAssignment, false);
  assert.equal(f.queries.some((q) => q.table === 'project_workers'), false);
});

test('a drafter receives drafting mail even without a manager email', async () => {
  const f = fixture({ managers: [] });
  assert.deepEqual((await getStatusEmailRecipients(f.client, 'project', f.status)).recipients, ['drafter@example.com']);
});

test('all assigned drafters and legacy drafter candidates receive one email per address', async () => {
  const f = fixture({ workers: [drafter, { ...drafter, email: ' DRAFTER@example.com ' },
    { role: 'manager', full_name: 'Dudi Example', email: 'legacy@example.com' }, null] });
  assert.deepEqual((await getStatusEmailRecipients(f.client, 'project', f.status)).recipients,
    ['manager@example.com', 'drafter@example.com', 'legacy@example.com']);
});

test('a missing drafter email does not falsely require reassignment', async () => {
  const f = fixture({ workers: [{ ...drafter, email: null }] });
  const result = await getStatusEmailRecipients(f.client, 'project', f.status);
  assert.deepEqual(result.recipients, ['manager@example.com']);
  assert.equal(result.awaitingDrafterAssignment, false);
});

test('assignment lookup errors fail instead of silently dropping the drafter', async () => {
  const f = fixture({ assignmentError: new Error('Database unavailable') });
  await assert.rejects(getStatusEmailRecipients(f.client, 'project', f.status), /Database unavailable/);
});

// Execute the actual Edge handler with Auth, database and SMTP doubles.
const handlerSource = transformSync(readFileSync(new URL('./index.ts', import.meta.url), 'utf8'),
  { loader: 'ts', format: 'cjs' }).code;
function handler(f) {
  let serve;
  const imports = {
    'jsr:@supabase/supabase-js@2': { createClient: () => f.client },
    '../_shared/smtp.ts': { sendEmail: async (mail) => { if (f.emailFails) throw new Error('SMTP unavailable'); f.emails.push(mail); return { accepted: mail.to }; } },
    '../_shared/status-email-theme.ts': { getStatusEmailTheme: () => ({ accent: '#123', background: '#fff', border: '#ddd', text: '#123' }) },
    './work-diary-pdf.ts': { createWorkDiaryPdf: () => { throw new Error('Unexpected PDF'); } },
    './recipients.js': { getStatusEmailRecipients },
    './notifications.js': { notifyReviewApprovedDrafters },
  };
  new Function('require', 'Deno', handlerSource)((name) => {
    assert.ok(imports[name], `Unexpected import: ${name}`);
    return imports[name];
  }, { env: { get: () => 'test-value' }, serve: (callback) => { serve = callback; } });
  return serve;
}
function request(status, oldStatus = 'נשלח להגהה') {
  return new Request('https://example.com/notify-status-change', { method: 'POST',
    headers: { Authorization: 'Bearer test', 'Content-Type': 'application/json' },
    body: JSON.stringify({ projectId: 'project', projectName: '2260519 <דרך היער>', oldStatus, newStatus: status }) });
}

test('actual handler sends drafting update to drafter without manager action text in HTML or plain text', async () => {
  const f = fixture();
  const response = await handler(f)(request(f.status));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).sentTo, 2);
  assert.equal(f.emails.length, 1);
  assert.equal(f.notifications.length, 0);
  assert.deepEqual(f.emails[0].to, ['manager@example.com', 'drafter@example.com']);
  assert.match(f.emails[0].subject, /עבר לשרטוט/);
  assert.doesNotMatch(f.emails[0].subject, /ממתין לשיוך/);
  for (const content of [f.emails[0].html, f.emails[0].text]) {
    assert.doesNotMatch(content, /נדרשת פעולת מנהל|יש להיכנס למערכת ולשייך/);
    assert.match(content, /תאריך תחילת ביצוע/);
  }
  assert.match(f.emails[0].html, /&lt;דרך היער&gt;/);
});

test('actual handler preserves manager action instructions when there is no drafter', async () => {
  const f = fixture({ workers: [] });
  assert.equal((await handler(f)(request(f.status))).status, 200);
  assert.deepEqual(f.emails[0].to, ['manager@example.com']);
  assert.match(f.emails[0].subject, /ממתין לשיוך/);
  assert.match(f.emails[0].html, /נדרשת פעולת מנהל/);
  assert.match(f.emails[0].text, /נדרשת פעולת מנהל/);
});

test('actual handler rejects inaccessible projects before resolving recipients or sending mail', async () => {
  const f = fixture({ accessible: false });
  assert.equal((await handler(f)(request(f.status))).status, 400);
  assert.equal(f.emails.length, 0);
  assert.equal(f.queries.some((q) => q.table === 'project_workers'), false);
});

test('review approval sends mail, in-app notification and Push to the assigned drafter', async () => {
  const f = fixture({ status: 'עבר לבקרה' });
  const response = await handler(f)(request(f.status));
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).drafterNotifications, { created: 1, failed: 0, pushFailed: 0 });
  assert.deepEqual(f.emails[0].to, ['manager@example.com', 'drafter@example.com']);
  assert.match(f.emails[0].subject, /עבר לבקרה/);
  assert.equal(f.notifications.length, 1);
  assert.equal(f.notifications[0].p_type, 'project_review_approved');
  assert.equal(f.notifications[0].p_user_id, 'drafter');
  assert.equal(f.notifications[0].p_project_id, 'project');
  assert.match(f.notifications[0].p_body, /נשלח להגהה/);
  assert.match(f.notifications[0].p_body, /עבר לבקרה/);
  assert.equal(f.pushes.length, 1);
  assert.equal(f.pushes[0].recipientUserId, 'drafter');
  assert.equal(f.pushes[0].url, '/app/projects?project=project');
});

test('review approval without a drafter preserves manager mail and sends no drafter notifications', async () => {
  const f = fixture({ workers: [], status: 'עבר לבקרה' });
  assert.equal((await handler(f)(request(f.status))).status, 200);
  assert.deepEqual(f.emails[0].to, ['manager@example.com']);
  assert.equal(f.notifications.length, 0);
  assert.equal(f.pushes.length, 0);
});

test('missing email addresses do not prevent in-app notification and Push', async () => {
  const f = fixture({ managers: [], workers: [{ ...drafter, email: null }], status: 'עבר לבקרה' });
  const response = await handler(f)(request(f.status));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).sentTo, 0);
  assert.equal(f.emails.length, 0);
  assert.equal(f.notifications.length, 1);
  assert.equal(f.pushes.length, 1);
});

test('Push failure preserves in-app notification and email delivery', async () => {
  const f = fixture({ status: 'עבר לבקרה', pushFails: true });
  const response = await handler(f)(request(f.status));
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).drafterNotifications, { created: 1, failed: 0, pushFailed: 1 });
  assert.equal(f.notifications.length, 1);
  assert.equal(f.emails.length, 1);
});

test('one failed notification does not stop other assigned drafters or emails', async () => {
  const f = fixture({ status: 'עבר לבקרה', notificationFailsFor: 'drafter',
    workers: [drafter, { ...drafter, id: 'second-drafter', email: 'second@example.com' }] });
  const response = await handler(f)(request(f.status));
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).drafterNotifications, { created: 1, failed: 1, pushFailed: 0 });
  assert.deepEqual(f.emails[0].to, ['manager@example.com', 'drafter@example.com', 'second@example.com']);
  assert.equal(f.pushes[0].recipientUserId, 'second-drafter');
});

test('SMTP failure does not erase or prevent in-app notification and Push', async () => {
  const f = fixture({ status: 'עבר לבקרה', emailFails: true });
  assert.equal((await handler(f)(request(f.status))).status, 400);
  assert.equal(f.notifications.length, 1);
  assert.equal(f.pushes.length, 1);
});

test('review approval notifications require a persisted control status and a review transition', async () => {
  const f = fixture({ status: 'בעבודה בשטח' });
  assert.equal((await handler(f)(request('עבר לבקרה'))).status, 200);
  assert.equal(f.notifications.length, 0);
  const other = fixture({ status: 'עבר לבקרה' });
  assert.equal((await handler(other)(request(other.status, 'עבר לשרטוט'))).status, 200);
  assert.equal(other.notifications.length, 0);
});

test('duplicate drafter assignments create one notification and one Push', async () => {
  const f = fixture({ status: 'עבר לבקרה', workers: [drafter, drafter] });
  assert.equal((await handler(f)(request(f.status))).status, 200);
  assert.equal(f.notifications.length, 1);
  assert.equal(f.pushes.length, 1);
});
