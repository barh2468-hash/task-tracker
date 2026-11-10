import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { transformSync } from 'esbuild';
import { filterEnabledNotifications } from '../_shared/notificationPreferences.js';

const source = transformSync(readFileSync(new URL('./index.ts', import.meta.url), 'utf8')
  .replace(/^import .*?;\s*/gm, ''), { loader: 'ts' }).code;

function fixture({ settings: overrides = {}, disabled = [], attendanceError = null } = {}) {
  const settings = {
    enabled: true, first_reminder_time: '07:30:00', repeat_after_minutes: 15,
    escalation_after_minutes: 30, weekdays: [0, 1, 2, 3, 4], ...overrides,
  };
  const profiles = [
    { id: 'missing', full_name: 'Missing Worker', role: 'field_worker' },
    { id: 'present', full_name: 'Present Worker', role: 'field_worker' },
    ...['manager', 'admin', 'drafter', 'office_worker', 'viewer', 'demo'].map((role) => ({
      id: role, full_name: role, role,
    })),
  ];
  const sessions = [{ worker_id: 'present', attendance_date: '2026-11-10' }];
  const notifications = [];
  const pushes = [];
  const queries = [];
  let now;
  let handler;
  const db = {
    from(table) {
      const filters = [];
      let inserted;
      const query = {
        select() { return this; },
        eq(key, value) { filters.push((row) => row[key] === value); return this; },
        in(key, values) { filters.push((row) => values.includes(row[key])); return this; },
        gte(key, value) { filters.push((row) => row[key] >= value); return this; },
        insert(row) { inserted = row; return this; },
        async single() { return { data: settings }; },
        async maybeSingle() {
          const result = await this;
          return { ...result, data: result.data[0] || null };
        },
        then(resolve, reject) {
          queries.push(table);
          if (inserted) {
            notifications.push({ ...inserted, id: String(notifications.length),
              created_at: now, delivery_enabled: !disabled.includes(inserted.recipient_id), is_read: false });
            return Promise.resolve({ error: null }).then(resolve, reject);
          }
          const rows = {
            profiles, attendance_sessions: sessions, notifications,
            notification_preferences: disabled.map((user_id) => ({ user_id, category: 'attendance_reminders', enabled: false })),
            push_subscriptions: profiles.map(({ id }) => ({ id, user_id: id, endpoint: id, p256dh: 'key', auth: 'key' })),
          }[table];
          assert.ok(rows, `Unexpected table: ${table}`);
          return Promise.resolve({ data: rows.filter((row) => filters.every((filter) => filter(row))),
            error: table === 'attendance_sessions' ? attendanceError : null }).then(resolve, reject);
        },
      };
      return query;
    },
  };
  class Clock extends Date {
    constructor(...args) { super(...(args.length ? args : [now])); }
  }
  new Function('createClient', 'webpush', 'filterEnabledNotifications', 'Deno', 'Date', 'console', source)(
    () => db,
    { setVapidDetails() {}, async sendNotification(subscription, payload) {
      pushes.push({ recipient: subscription.endpoint, ...JSON.parse(payload) });
    } },
    filterEnabledNotifications,
    { env: { get: (key) => key === 'APP_URL' ? 'https://maya-tasks.online' : 'fixture' },
      serve: (fn) => { handler = fn; } }, Clock, { error() {} },
  );
  return {
    notifications, pushes, sessions, queries,
    async invoke(time, { date = '2026-11-10', secret = 'fixture', method = 'POST', offset = '+02:00' } = {}) {
      now = `${date}T${time}:00${offset}`;
      return handler(new Request('https://fixture.invalid', { method, headers: { 'x-cron-secret': secret } }));
    },
  };
}

test('only missing field workers get exactly three pushes, without cron replay duplicates', async () => {
  const f = fixture();
  for (const time of ['07:25', '07:30', '07:30', '07:35', '07:45', '07:45', '08:00', '08:00', '08:05', '08:15']) {
    assert.equal((await f.invoke(time)).status, 200);
  }
  const reminders = f.pushes.filter((push) => push.tag.startsWith('attendance_reminder_'));
  assert.deepEqual(reminders.map((push) => [push.recipient, push.tag]), [
    ['missing', 'attendance_reminder_first'],
    ['missing', 'attendance_reminder_repeat'],
    ['missing', 'attendance_reminder_final'],
  ]);
  assert.ok(reminders.every((push) => push.url === 'https://maya-tasks.online/app'));
  assert.equal(f.notifications.filter((notice) => notice.recipient_id === 'missing').length, 3);
  assert.deepEqual(f.pushes.filter((push) => push.tag === 'attendance_missing_escalation')
    .map((push) => push.recipient), ['manager', 'admin']);
});

for (const checkInAfter of ['07:30', '07:45']) {
  test(`checking in after ${checkInAfter} stops all later reminders and escalation`, async () => {
    const f = fixture();
    for (const time of ['07:30', '07:45', '08:00']) {
      await f.invoke(time);
      if (time === checkInAfter) f.sessions.push({ worker_id: 'missing', attendance_date: '2026-11-10' });
    }
    assert.equal(f.pushes.length, checkInAfter === '07:30' ? 1 : 2);
    assert.ok(f.pushes.every((push) => push.recipient === 'missing'));
  });
}

test('a previous-day check-in does not suppress today’s reminders', async () => {
  const f = fixture();
  f.sessions.push({ worker_id: 'missing', attendance_date: '2026-11-09' });
  await f.invoke('07:45');
  assert.deepEqual(f.pushes.map((push) => push.recipient), ['missing']);
});

test('08:00 start sends reminders at 08:00, 08:15 and 08:30 only', async () => {
  const f = fixture({ settings: { first_reminder_time: '08:00:00' } });
  await f.invoke('07:30');
  await f.invoke('07:45');
  assert.equal(f.pushes.length, 0);
  for (const [time, type] of [
    ['08:00', 'attendance_reminder_first'],
    ['08:15', 'attendance_reminder_repeat'],
    ['08:30', 'attendance_reminder_final'],
  ]) {
    await f.invoke(time);
    assert.equal(f.pushes.filter((push) => push.recipient === 'missing').at(-1).tag, type);
  }
  await f.invoke('08:45');
  assert.equal(f.pushes.filter((push) => push.recipient === 'missing').length, 3);
});

test('disabled worker reminders do not suppress a coinciding manager escalation', async () => {
  const f = fixture({ disabled: ['missing'] });
  const response = await f.invoke('08:00');
  assert.equal((await response.json()).phases.length, 2);
  assert.deepEqual(f.pushes.map((push) => push.recipient), ['manager', 'admin']);
});

test('configured repeat intervals and overlapping second reminders remain independent', async () => {
  const f = fixture({ settings: { repeat_after_minutes: 30 } });
  for (const time of ['07:30', '08:00', '08:30']) await f.invoke(time);
  assert.deepEqual(f.pushes.filter((push) => push.recipient === 'missing').map((push) => push.tag), [
    'attendance_reminder_first', 'attendance_reminder_repeat', 'attendance_reminder_final',
  ]);
  assert.equal(f.pushes.filter((push) => push.tag === 'attendance_missing_escalation').length, 2);
});

test('disabled schedules, non-workdays and out-of-window runs create no reminders', async () => {
  for (const [options, time, invocation] of [
    [{ settings: { enabled: false } }, '07:30', {}],
    [{}, '07:30', { date: '2026-11-14' }],
    [{}, '07:29', {}], [{}, '07:35', {}], [{}, '08:05', {}],
  ]) {
    const f = fixture(options);
    assert.equal((await f.invoke(time, invocation)).status, 200);
    assert.equal(f.notifications.length, 0);
    assert.equal(f.pushes.length, 0);
  }
});

test('summer and winter use the existing Israel local schedule', async () => {
  for (const invocation of [{}, { date: '2026-07-07', offset: '+03:00' }]) {
    const f = fixture();
    await f.invoke('08:00', invocation);
    assert.ok(f.pushes.some((push) => push.tag === 'attendance_reminder_final'));
  }
});

test('failed attendance lookup sends no reminders', async () => {
  const f = fixture({ attendanceError: new Error('offline') });
  assert.equal((await f.invoke('08:00')).status, 500);
  assert.equal(f.notifications.length, 0);
  assert.equal(f.pushes.length, 0);
});

test('cron authentication and POST method are still required', async () => {
  const f = fixture();
  assert.equal((await f.invoke('08:00', { secret: 'wrong' })).status, 401);
  assert.equal((await f.invoke('08:00', { secret: '' })).status, 401);
  assert.equal((await f.invoke('08:00', { method: 'GET' })).status, 405);
  assert.equal(f.queries.length, 0);
  assert.equal(f.pushes.length, 0);
});
