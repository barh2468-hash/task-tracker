import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { transformSync } from 'esbuild';
import * as preferences from '../_shared/notificationPreferences.js';

const source = transformSync(readFileSync(new URL('./index.ts', import.meta.url), 'utf8'), {
  loader: 'ts',
  format: 'cjs',
}).code;
function setup({ disabled = [], deliveryEnabled = true, preferenceError = null } = {}) {
  let handler;
  const sent = [];
  const notifications = ['a', 'b'].map((id) => ({
    recipient_id: id,
    type: 'work_started',
    title: 'Event',
    body: 'Body',
    created_by: 'actor',
    delivery_enabled: deliveryEnabled,
    is_read: false,
    created_at: new Date().toISOString(),
  }));
  const tables = {
    profiles: [
      { id: 'actor', role: 'manager' },
      { id: 'a', role: 'manager' },
      { id: 'b', role: 'admin' },
    ],
    notifications,
    notification_preferences: disabled.map(([user_id, category]) => ({
      user_id,
      category,
      enabled: false,
    })),
    push_subscriptions: ['a', 'b'].map((id) => ({
      id,
      user_id: id,
      endpoint: id,
      p256dh: 'key',
      auth: 'auth',
    })),
  };
  const admin = {
    from(table) {
      let rows = tables[table];
      const result = () => ({
        data: rows,
        error: table === 'notification_preferences' ? preferenceError : null,
      });
      const query = {
        select() {
          return query;
        },
        eq(key, value) {
          rows = rows.filter((row) => row[key] === value);
          return query;
        },
        in(key, values) {
          rows = rows.filter((row) => values.includes(row[key]));
          return query;
        },
        gte(key, value) {
          rows = rows.filter((row) => row[key] >= value);
          return query;
        },
        async maybeSingle() {
          return { data: rows[0], error: null };
        },
        then(resolve, reject) {
          return Promise.resolve(result()).then(resolve, reject);
        },
      };
      return query;
    },
  };
  const user = { ...admin, auth: { getUser: async () => ({ data: { user: { id: 'actor' } } }) } };
  let clients = 0;
  new Function('require', 'Deno', source)(
    (name) => {
      if (name.startsWith('https://'))
        return { createClient: () => (clients++ === 0 ? user : admin) };
      if (name.startsWith('npm:'))
        return {
          setVapidDetails() {},
          async sendNotification(subscription) {
            sent.push(subscription.endpoint);
          },
        };
      if (name === './chat.js')
        return {
          unreadChatCount: async () => 0,
          resolveChatNotification: async () => ({
            title: 'Chat',
            body: 'Message',
            recipientIds: ['a', 'b'],
            url: '/app/chat',
          }),
        };
      if (name === '../_shared/notificationPreferences.js') return preferences;
      throw new Error(`Unexpected import: ${name}`);
    },
    {
      env: { get: () => 'test-value' },
      serve(callback) {
        handler = callback;
      },
    },
  );
  return {
    sent,
    async call(payload = {}) {
      const response = await handler(
        new Request('https://example.test/push', {
          method: 'POST',
          headers: { Authorization: 'Bearer test', 'Content-Type': 'application/json' },
          body: JSON.stringify({
            recipientRole: 'manager',
            title: 'Event',
            body: 'Body',
            ...payload,
          }),
        }),
      );
      return { status: response.status, body: await response.json() };
    },
  };
}

test('Push handler excludes disabled recipients using the stored event type, not caller input', async () => {
  const f = setup({ disabled: [['a', 'work_started']] });
  const response = await f.call({ type: 'work_ended' });
  assert.equal(response.body.sent, 1);
  assert.deepEqual(f.sent, ['b']);
});
test('Push handler does not replay suppressed events when preferences are re-enabled', async () => {
  const f = setup({ deliveryEnabled: false });
  assert.equal((await f.call()).body.sent, 0);
  assert.deepEqual(f.sent, []);
});
test('chat Push handler respects account-wide chat preferences', async () => {
  const f = setup({ disabled: [['a', 'chat']] });
  assert.equal((await f.call({ chatMessageId: 'message' })).body.sent, 1);
  assert.deepEqual(f.sent, ['b']);
});
