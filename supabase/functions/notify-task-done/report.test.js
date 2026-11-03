import test from 'node:test';
import assert from 'node:assert/strict';
import { taskReportEmail } from './template.js';
import { deliverTaskReport as deliver } from './delivery.js';
const deliverTaskReport = (job, services) =>
  deliver(job, { sendPush: async () => {}, ...services });
const enabledPreference = () => ({
  select: () => ({
    eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { enabled: true } }) }) }),
  }),
});
const report = {
  id: 'r',
  project_id: 'project',
  outcome: 'partial',
  request_title: 'Original <request>',
  request_description: 'תמונה 1: מדוע שני קווים?',
  summary: 'Measured first pipe\nהקו השני חסום <script>alert(1)</script>',
  next_steps: 'Need access to second pipe',
  ready_for_drafting: true,
  file_reference: 'תמונה 2',
  attachments: [{ file_name: 'סקיצה.pdf', file_path: 'project/user/file.pdf' }],
};
test('emails distinguish the request from actual results, preserve text and label partial work in all languages', () => {
  for (const [language, status, dir] of [
    ['he', 'בוצע חלקית', 'rtl'],
    ['en', 'Partially completed', 'ltr'],
    ['el', 'Μερική ολοκλήρωση', 'ltr'],
  ]) {
    const mail = taskReportEmail({
      report: { ...report, language },
      project_name: 'Project & test',
      worker_name: 'עובד',
      appUrl: 'https://example.com',
      links: [{ name: 'סקיצה.pdf', url: 'https://files.example.com/a?x=1&y=2' }],
    });
    assert.ok(mail.subject.includes(status));
    assert.ok(mail.text.includes(report.summary));
    assert.ok(mail.text.includes(report.request_description));
    assert.ok(mail.text.includes(report.next_steps));
    assert.match(mail.html, new RegExp(`lang="${language}" dir="${dir}"`));
    assert.doesNotMatch(mail.html, /<script>/);
    assert.match(mail.html, /&lt;script&gt;/);
    assert.match(mail.html, /&amp;y=2/);
    assert.match(mail.html, /project=project&amp;tab=tasks/);
    assert.match(mail.html, /MAYA TRACKER/);
    assert.match(mail.html, /max-width:640px/);
    assert.match(mail.html, /background:#0b2a55/);
    assert.match(mail.html, /background:#eef4fa/);
    assert.match(mail.html, /role="presentation"/);
    assert.ok(
      mail.text.includes(
        { he: 'כל המנהלים', en: 'All managers', el: 'Όλοι οι διαχειριστές' }[language],
      ),
    );
  }
});
test('failed email delivery remains retryable and finish calls use the claimed token', async () => {
  const finishes = [];
  let deliveries = 0;
  const client = {
    from: enabledPreference,
    storage: {
      from: () => ({
        createSignedUrl: async () => ({ data: { signedUrl: 'https://files.example.com/a' } }),
      }),
    },
    rpc: async (name, args) => {
      finishes.push({ name, args });
      return { error: null };
    },
  };
  const job = {
    report,
    report_id: 'r',
    recipient_id: 'manager',
    recipient_email: 'manager@example.com',
    claim_token: 'lease',
    project_name: 'Project',
    worker_name: 'Worker',
  };
  const failed = await deliverTaskReport(job, {
    client,
    sendEmail: async () => {
      throw new Error('SMTP down');
    },
  });
  assert.equal(failed.ok, false);
  assert.equal(finishes.at(-1).args.p_error, 'SMTP down');
  assert.equal(finishes[0].args.p_token, 'lease');
  const delivered = await deliverTaskReport(job, {
    client,
    sendEmail: async () => {
      deliveries++;
    },
  });
  assert.equal(delivered.ok, true);
  assert.equal(deliveries, 1);
  assert.equal(finishes.at(-1).args.p_error, null);
});
test('an attachment outside the project is never emailed', async () => {
  let sent = false;
  let failure;
  await deliverTaskReport(
    {
      report: { ...report, attachments: [{ file_path: 'another-project/private.pdf' }] },
      recipient_email: 'manager@example.com',
    },
    {
      client: {
        from: enabledPreference,
        rpc: async (_name, args) => {
          failure = args.p_error;
          return {};
        },
      },
      sendEmail: async () => {
        sent = true;
      },
    },
  );
  assert.equal(sent, false);
  assert.equal(failure, 'Invalid attachment path');
});

test('in-app notification switches preserve task report email delivery', async () => {
  let sent = false,
    finished;
  const query = {
    select: () => query,
    eq: () => query,
    maybeSingle: async () => ({ data: { enabled: false } }),
  };
  const result = await deliverTaskReport(
    {
      report: { ...report, attachments: [] },
      recipient_id: 'manager',
      recipient_email: 'manager@example.com',
    },
    {
      client: {
        from: () => query,
        rpc: async (_name, args) => {
          finished = args;
          return {};
        },
      },
      sendEmail: async () => {
        sent = true;
      },
    },
  );
  assert.equal(result.ok, true);
  assert.equal(sent, true);
  assert.equal(finished.p_error, null);
});

test('a removed attachment does not block the report email', async () => {
  let email;
  const result = await deliverTaskReport(
    { report, recipient_email: 'manager@example.com' },
    {
      client: {
        from: enabledPreference,
        storage: {
          from: () => ({
            createSignedUrl: async () => ({
              error: { statusCode: '404', message: 'Object not found' },
            }),
          }),
        },
        rpc: async () => ({}),
      },
      sendEmail: async (mail) => {
        email = mail;
      },
    },
  );
  assert.equal(result.ok, true);
  assert.match(email.html, /unavailable/);
  assert.doesNotMatch(email.html, /href="null"|href=""/);
});

test('retrying failed Push preserves an accepted email and never sends it again', async () => {
  let emailCount = 0;
  const checkpoints = [];
  const job = {
    report: { ...report, attachments: [] },
    report_id: 'r',
    recipient_id: 'recipient',
    recipient_email: 'manager@example.com',
    claim_token: 'lease',
  };
  const client = {
    rpc: async (_name, args) => {
      checkpoints.push(args);
      return {};
    },
  };
  const first = await deliverTaskReport(job, {
    client,
    sendPush: async () => {
      throw new Error('Push unavailable');
    },
    sendEmail: async () => {
      emailCount++;
    },
  });
  assert.equal(first.ok, false);
  assert.equal(checkpoints.at(-1).p_email_sent, true);
  assert.equal(checkpoints.at(-1).p_push_done, false);
  const second = await deliverTaskReport(
    { ...job, sent_at: 'accepted' },
    {
      client,
      sendPush: async () => {},
      sendEmail: async () => {
        emailCount++;
      },
    },
  );
  assert.equal(second.ok, true);
  assert.equal(emailCount, 1);
  assert.equal(checkpoints.at(-1).p_push_done, true);
});

test('an email failure does not repeat Push after its checkpoint', async () => {
  let pushes = 0;
  const client = { rpc: async () => ({}) };
  const job = { report: { ...report, attachments: [] }, recipient_email: 'manager@example.com' };
  assert.equal(
    (
      await deliverTaskReport(job, {
        client,
        sendPush: async () => {
          pushes++;
        },
        sendEmail: async () => {
          throw new Error('SMTP unavailable');
        },
      })
    ).ok,
    false,
  );
  assert.equal(
    (
      await deliverTaskReport(
        { ...job, push_sent_at: 'accepted' },
        {
          client,
          sendPush: async () => {
            pushes++;
          },
          sendEmail: async () => {},
        },
      )
    ).ok,
    true,
  );
  assert.equal(pushes, 1);
});
