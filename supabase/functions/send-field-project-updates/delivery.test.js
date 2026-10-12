import test from 'node:test';
import assert from 'node:assert/strict';
import { deliverFieldUpdate, escapeEmailHtml } from './delivery.js';

function fixture({ sent = false, pushFails = false, rejected = false, missingEmail = false } = {}) {
  const job = { id: 'event', claim_token: 'claim', recipient_id: 'worker', project_id: 'project', title: '<פרויקט>', body: 'a & b', email_sent_at: sent ? '2026-10-12' : null };
  const marks = [], mails = [];
  let pushes = 0;
  return {
    job, marks, mails, pushes: () => pushes,
    args: { job, appUrl: 'https://maya.example', client: {
      from() { return { select() { return this; }, eq() { return this; }, async single() { return { data: { email: missingEmail ? null : 'worker@example.com', full_name: 'Worker' } }; } }; },
      async rpc(_name, payload) { marks.push(payload); return {}; },
    }, async sendEmail(mail) { mails.push(mail); return { accepted: rejected ? [] : ['worker@example.com'], rejected: rejected ? ['worker@example.com'] : [] }; }, async sendPush() { pushes++; if (pushFails) throw new Error('Push unavailable'); } },
  };
}
test('SMTP success is persisted before Push; delivered event is finished', async () => {
  const f = fixture();
  assert.equal((await deliverFieldUpdate(f.args)).ok, true);
  assert.equal(f.marks[0].p_email_sent, true); assert.equal(f.marks[0].p_done, false);
  assert.equal(f.marks[1].p_done, true);
  assert.deepEqual(f.mails[0].to, ['worker@example.com']);
  assert.match(f.mails[0].html, /&lt;פרויקט&gt;/);
});
test('Push retries never resend previously accepted email', async () => {
  const first = fixture({ pushFails: true });
  assert.equal((await deliverFieldUpdate(first.args)).ok, false);
  assert.equal(first.marks.at(-1).p_email_sent, true);
  const retry = fixture({ sent: true });
  assert.equal((await deliverFieldUpdate(retry.args)).ok, true);
  assert.equal(retry.mails.length, 0); assert.equal(retry.pushes(), 1);
});
test('rejected or missing mail stays pending without sending Push', async () => {
  for (const flags of [{ rejected: true }, { missingEmail: true }]) {
    const f = fixture(flags);
    assert.equal((await deliverFieldUpdate(f.args)).ok, false);
    assert.equal(f.pushes(), 0); assert.equal(f.marks.at(-1).p_done, false); assert.equal(f.marks.at(-1).p_email_sent, false);
  }
  assert.equal(escapeEmailHtml('"<a>&'), '&quot;&lt;a&gt;&amp;');
});
