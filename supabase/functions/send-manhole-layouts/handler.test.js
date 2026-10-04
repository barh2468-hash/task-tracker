import test from 'node:test';
import assert from 'node:assert/strict';
import { createLayoutEmailHandler, validateEmailPayload, buildLayoutEmail, MAX_EMAIL_BYTES } from './handler.js';
const userId = '11111111-1111-4111-8111-111111111111';
const projectId = '22222222-2222-4222-8222-222222222222';
const sheetId = '33333333-3333-4333-8333-333333333333';
const requestId = '44444444-4444-4444-8444-444444444444';
const payload = () => ({ requestId, layoutIds: [sheetId], recipients: ['test@example.com'], subject: 'בדיקת פרישה', message: '<script>untrusted</script>' });
const row = () => ({ id: sheetId, project_id: projectId, created_by: userId, project_name: 'פרויקט <בדיקה>', manhole_number: '03', file_name: 'שוחה 3.pdf', pdf_path: `${projectId}/${userId}/${sheetId}/report.pdf`, pdf_size: 20 });
function fixture({ records = [row()], authError = null, smtpError = false, reserveError = null, pdf = '%PDF-1.7 sample', reservation = null } = {}) {
  let saved = reservation, sent = [], downloads = 0;
  const userClient = {
    auth: { getUser: async () => ({ data: { user: authError ? null : { id: userId } }, error: authError }) },
    from: () => ({ select: () => ({ in: async () => ({ data: records, error: null }) }) }),
    storage: { from: bucket => { assert.equal(bucket, 'manhole-layouts'); return { download: async () => { downloads++; return { data: new Blob([pdf]), error: null }; } }; } },
  };
  const admin = {
    rpc: async (_name, values) => {
      if (reserveError) return { data: null, error: reserveError };
      if (saved) return { data: { ...saved, existing: true }, error: null };
      saved = { id: values.request_id, user_id: values.actor_id, request_hash: values.payload_hash, status: 'pending' };
      return { data: { ...saved, existing: false }, error: null };
    },
    from: () => ({ update: changes => ({ eq: async () => { saved = { ...saved, ...changes }; return { error: null }; } }) }),
  };
  const handler = createLayoutEmailHandler({
    env: name => name === 'SUPABASE_SERVICE_ROLE_KEY' ? 'service' : 'test',
    createClient: (_url, key) => key === 'service' ? admin : userClient,
    sendEmail: async email => { sent.push(email); if (smtpError) throw new Error('SMTP timeout'); return { accepted: email.to, rejected: [], messageId: 'test-message' }; },
  });
  const invoke = (data = payload(), authenticated = true) => handler(new Request('https://example.com/send', { method: 'POST', headers: authenticated ? { Authorization: 'Bearer test' } : {}, body: JSON.stringify(data) }));
  return { invoke, sent, state: () => saved, downloads: () => downloads };
}
test('email payload rejects header injection, malformed recipients and unbounded attachment lists', () => {
  assert.throws(() => validateEmailPayload({ ...payload(), subject: 'Subject\r\nBcc: other@example.com' }));
  assert.throws(() => validateEmailPayload({ ...payload(), recipients: ['Name <test@example.com>'] }));
  assert.throws(() => validateEmailPayload({ ...payload(), layoutIds: Array(6).fill(sheetId) }));
  const email = buildLayoutEmail(payload(), [row()], []);
  assert.ok(email.html.includes('&lt;script&gt;'));
  assert.ok(!email.html.includes('<script>'));
  assert.ok(email.text.includes('<script>'));
});
test('unauthenticated and inaccessible layouts cannot reserve, download or send email', async () => {
  const anon = fixture(); assert.equal((await anon.invoke(payload(), false)).status, 401); assert.equal(anon.sent.length, 0);
  const inaccessible = fixture({ records: [] }); assert.equal((await inaccessible.invoke()).status, 403); assert.equal(inaccessible.state(), null); assert.equal(inaccessible.downloads(), 0);
});
test('authenticated mail attaches saved PDFs and an identical retry never sends twice', async () => {
  const f = fixture(); const first = await f.invoke();
  assert.equal(first.status, 200); assert.equal((await first.json()).ok, true);
  assert.equal(f.sent[0].attachments[0].filename, 'שוחה 3.pdf');
  assert.equal(new TextDecoder().decode(f.sent[0].attachments[0].content), '%PDF-1.7 sample');
  assert.equal((await f.invoke()).status, 200); assert.equal(f.sent.length, 1); assert.equal(f.downloads(), 1);
  assert.equal((await f.invoke({ ...payload(), recipients: ['different@example.com'] })).status, 409); assert.equal(f.sent.length, 1);
});
test('oversized attachments and server rate limits fail before SMTP', async () => {
  const large = fixture({ records: [{ ...row(), pdf_size: MAX_EMAIL_BYTES + 1 }] });
  assert.equal((await large.invoke()).status, 413); assert.equal(large.sent.length, 0);
  const limited = fixture({ reserveError: { message: 'mail_rate_limited' } });
  assert.equal((await limited.invoke()).status, 429); assert.equal(limited.sent.length, 0);
});
test('SMTP uncertainty is recorded and a retry does not duplicate the message', async () => {
  const f = fixture({ smtpError: true });
  assert.equal((await f.invoke()).status, 503); assert.equal(f.state().status, 'unknown');
  assert.equal((await f.invoke()).status, 409); assert.equal(f.sent.length, 1);
});
test('invalid stored PDF fails without sending', async () => {
  const invalid = fixture({ pdf: '<html>not a PDF</html>' });
  assert.equal((await invalid.invoke()).status, 503); assert.equal(invalid.state().status, 'failed'); assert.equal(invalid.sent.length, 0);
});
test('a pending reservation never starts a second SMTP operation', async () => {
  const normalized = validateEmailPayload(payload());
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(normalized)));
  const hash = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
  const f = fixture({ reservation: { id: requestId, user_id: userId, request_hash: hash, status: 'pending', created_at: new Date().toISOString() } });
  assert.equal((await f.invoke()).status, 409); assert.equal(f.sent.length, 0); assert.equal(f.downloads(), 0);
});
test('same-name PDF versions receive distinct attachment names', async () => {
  const secondId = '55555555-5555-4555-8555-555555555555';
  const secondRow = { ...row(), id: secondId, pdf_path: `${projectId}/${userId}/${secondId}/report.pdf` };
  const f = fixture({ records: [row(), secondRow] });
  assert.equal((await f.invoke({ ...payload(), layoutIds: [sheetId, secondId] })).status, 200);
  assert.deepEqual(f.sent[0].attachments.map(attachment => attachment.filename), ['שוחה 3.pdf', 'שוחה 3 (2).pdf']);
});
