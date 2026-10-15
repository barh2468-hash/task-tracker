import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const source = (await readFile(new URL('./api.js', import.meta.url), 'utf8'))
  .replace(/^import[\s\S]*?;\r?\n/gm, '').replace(/^export /gm, '');

function fixture({ owned = true, permission = 'granted', lookupError, saveError, deleteError } = {}) {
  const calls = { subscribed: 0, unsubscribed: 0, saved: [], deleted: [] };
  const subscription = (endpoint) => ({
    endpoint, toJSON: () => ({ keys: { p256dh: 'public-key', auth: 'auth-key' } }),
    async unsubscribe() { calls.unsubscribed++; return true; },
  });
  const existing = subscription('https://push.example/existing');
  const fresh = subscription('https://push.example/fresh');
  const context = {
    window: { atob }, navigator: { userAgent: 'Test browser' }, Notification: { permission },
    getCurrentUser: async () => ({ id: 'current-user' }),
    getPushSubscriptionByEndpoint: async () => ({ data: owned ? { id: 'own-registration' } : null, error: lookupError }),
    upsertPushSubscription: async (row) => { calls.saved.push(row); return { error: saveError }; },
    deletePushSubscriptionByEndpoint: async (endpoint) => { calls.deleted.push(endpoint); return { error: deleteError }; },
  };
  vm.runInNewContext(`${source}\nglobalThis.api = { subscribePush, unsubscribePush, isPushSubscribed };`, context);
  return {
    api: context.api, calls,
    registration: { pushManager: {
      async getSubscription() { return existing; },
      async subscribe(options) { assert.equal(options.userVisibleOnly, true); calls.subscribed++; return fresh; },
    } },
  };
}

test('notification status requires both device permission and this account registration', async () => {
  for (const options of [{ owned: false }, { permission: 'denied' }]) {
    const f = fixture(options);
    assert.equal(await f.api.isPushSubscribed(f.registration), false);
  }
  const own = fixture();
  assert.equal(await own.api.isPushSubscribed(own.registration), true);
});

test('enabling an owned registration preserves its endpoint and refreshes this account registration', async () => {
  const f = fixture();
  const result = await f.api.subscribePush(f.registration);
  assert.equal(result.endpoint, 'https://push.example/existing');
  assert.equal(f.calls.subscribed, 0);
  assert.equal(f.calls.unsubscribed, 0);
  assert.equal(f.calls.saved[0].user_id, 'current-user');
});

test('shared-browser account changes create a fresh endpoint instead of taking another account registration', async () => {
  const f = fixture({ owned: false });
  const result = await f.api.subscribePush(f.registration);
  assert.equal(f.calls.unsubscribed, 1);
  assert.equal(f.calls.subscribed, 1);
  assert.equal(result.endpoint, 'https://push.example/fresh');
  assert.equal(f.calls.saved[0].endpoint, result.endpoint);
  assert.equal(f.calls.saved[0].user_id, 'current-user');
});

test('a temporary registration lookup failure preserves the existing subscription', async () => {
  const f = fixture({ lookupError: new Error('offline') });
  await assert.rejects(f.api.subscribePush(f.registration), /offline/);
  assert.equal(f.calls.unsubscribed, 0);
  assert.equal(f.calls.saved.length, 0);
});

test('registration failures are surfaced so the UI cannot claim notifications were enabled', async () => {
  const f = fixture({ saveError: new Error('registration failed') });
  await assert.rejects(f.api.subscribePush(f.registration), /registration failed/);
});

test('a failed server-side disable preserves the browser subscription and reports the error', async () => {
  const f = fixture({ deleteError: new Error('offline') });
  await assert.rejects(f.api.unsubscribePush(f.registration), /offline/);
  assert.equal(f.calls.unsubscribed, 0);
});

test('disabling removes the server registration before unsubscribing the device', async () => {
  const f = fixture();
  await f.api.unsubscribePush(f.registration);
  assert.deepEqual(f.calls.deleted, ['https://push.example/existing']);
  assert.equal(f.calls.unsubscribed, 1);
});
