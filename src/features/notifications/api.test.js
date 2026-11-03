import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { transformSync } from 'esbuild';

function loadModule(path, imports) {
  const source = transformSync(readFileSync(new URL(path, import.meta.url), 'utf8'), {
    format: 'cjs',
  }).code;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', source)(
    (name) => {
      assert.ok(name in imports, `Unexpected import: ${name}`);
      return imports[name];
    },
    module,
    module.exports,
  );
  return module.exports;
}

test('history retrieves older rows beyond the default API cap with an extra row to detect more history', async () => {
  const calls = [];
  const rows = Array.from({ length: 1101 }, (_, index) => ({ id: index }));
  const api = loadModule('./api.js', {
    '../../services/api/notifications.js': {
      getNotifications: async (id, { offset, limit }) => {
        calls.push({ id, offset, limit });
        return { data: rows.slice(offset, offset + limit) };
      },
      getUnreadNotificationCount: async () => ({ count: 1001 }),
      getUnreadGprNotifications: async () => ({ data: [{ id: 'gpr' }] }),
    },
    '../../services/api/edgeFunctions.js': {},
  });
  const snapshot = await api.getNotificationSnapshot('user-a', true, 1040);
  assert.equal(snapshot.notifications.length, 1040);
  assert.equal(snapshot.notifications.at(-1).id, 1039);
  assert.equal(snapshot.hasMore, true);
  assert.equal(snapshot.unreadCount, 1001);
  assert.equal(snapshot.gprUnread[0].id, 'gpr');
  assert.ok(calls.every((call) => call.id === 'user-a' && call.limit <= 80));
  assert.deepEqual(calls.at(-1), { id: 'user-a', offset: 1040, limit: 1 });
  assert.equal((await api.getNotifications('user-a', 1120)).hasMore, false);
});

test('failed history loads propagate to the UI instead of pretending the inbox is empty', async () => {
  const api = loadModule('./api.js', {
    '../../services/api/notifications.js': {
      getNotifications: async () => ({ error: new Error('offline') }),
    },
    '../../services/api/edgeFunctions.js': {},
  });
  await assert.rejects(api.getNotifications('user-a'), /offline/);
});

test('large selections are updated in bounded batches and failures are returned', async () => {
  const calls = [];
  let fail = false;
  const api = loadModule('./api.js', {
    '../../services/api/notifications.js': {
      setNotificationsRead: async (ids, read, userId) => {
        calls.push({ ids, read, userId });
        return fail ? { error: new Error('denied') } : { data: ids.map((id) => ({ id })) };
      },
    },
    '../../services/api/edgeFunctions.js': {},
  });
  const ids = Array.from({ length: 1100 }, (_, index) => String(index));
  const result = await api.setNotificationsRead(ids, false, 'user-a');
  assert.deepEqual(
    result.data.map((row) => row.id),
    ids,
  );
  assert.ok(
    calls.every((call) => call.ids.length <= 80 && call.read === false && call.userId === 'user-a'),
  );
  fail = true;
  assert.equal((await api.setNotificationsRead(['one'], true, 'user-a')).error.message, 'denied');
});

test('notification queries use stable pagination and mutations are scoped to the recipient', async () => {
  const calls = [];
  const query = new Proxy(
    {},
    {
      get:
        (_target, method) =>
        (...args) => {
          calls.push([method, ...args]);
          return query;
        },
    },
  );
  const api = loadModule('../../services/api/notifications.js', {
    '../supabase.js': {
      supabase: {
        from: (table) => {
          calls.push(['from', table]);
          return query;
        },
      },
    },
  });
  api.getNotifications('user-a', { offset: 80, limit: 80 });
  assert.deepEqual(calls.slice(-5), [
    ['eq', 'recipient_id', 'user-a'],
    ['eq', 'delivery_enabled', true],
    ['order', 'created_at', { ascending: false }],
    ['order', 'id', { ascending: false }],
    ['range', 80, 159],
  ]);
  calls.length = 0;
  api.setNotificationsRead(['chosen'], false, 'user-a');
  assert.deepEqual(calls, [
    ['from', 'notifications'],
    ['update', { is_read: false }],
    ['eq', 'recipient_id', 'user-a'],
    ['in', 'id', ['chosen']],
    ['select', 'id'],
  ]);
  calls.length = 0;
  api.markAllNotificationsRead('user-b');
  assert.deepEqual(calls, [
    ['from', 'notifications'],
    ['update', { is_read: true }],
    ['eq', 'recipient_id', 'user-b'],
    ['eq', 'is_read', false],
  ]);
});

test('preference reads and saves explicitly target the signed-in account', () => {
  const calls = [];
  const query = new Proxy(
    {},
    {
      get:
        (_target, method) =>
        (...args) => {
          calls.push([method, ...args]);
          return query;
        },
    },
  );
  const api = loadModule('../../services/api/notifications.js', {
    '../supabase.js': {
      supabase: {
        from: (table) => {
          calls.push(['from', table]);
          return query;
        },
      },
    },
  });
  api.getNotificationPreferences('user-a');
  assert.deepEqual(calls, [
    ['from', 'notification_preferences'],
    ['select', 'category,enabled'],
    ['eq', 'user_id', 'user-a'],
  ]);
  calls.length = 0;
  api.saveNotificationPreference('user-a', 'work_started', false);
  assert.deepEqual(calls, [
    ['from', 'notification_preferences'],
    [
      'upsert',
      { user_id: 'user-a', category: 'work_started', enabled: false },
      { onConflict: 'user_id,category' },
    ],
    ['select', 'category,enabled'],
    ['single'],
  ]);
});
