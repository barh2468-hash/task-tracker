import test from 'node:test';
import assert from 'node:assert/strict';
import { createClientUser } from './client-users.js';
import { clientLoginEmail, clientUsernameFromEmail, normalizeClientUsername, resolveLoginIdentifier } from '../_shared/client-login.js';

function fixture({ existing = false, createError = false, profileError = false } = {}) {
  const calls = [];
  const client = {
    from: () => ({
      select() { return this; }, eq() { return this; },
      maybeSingle: async () => ({ data: existing ? { id: 'existing' } : null }),
      insert(payload) { calls.push(['profile', payload]); return { select: () => ({ single: async () => ({ data: payload, error: profileError ? new Error('failed') : null }) }) }; },
    }),
    auth: { admin: {
      createUser: async (payload) => { calls.push(['create', payload]); return { data: { user: createError ? null : { id: 'new-user' } }, error: createError ? new Error('failed') : null }; },
      deleteUser: async (id) => { calls.push(['cleanup', id]); return {}; },
    } },
  };
  return { calls, client };
}

test('username aliases normalize consistently and ordinary email login is preserved', () => {
  assert.equal(normalizeClientUsername(' Maya-Client '), 'maya-client');
  assert.equal(clientLoginEmail('Maya-Client'), 'maya-client@clients.maya.invalid');
  assert.equal(clientUsernameFromEmail('maya-client@clients.maya.invalid'), 'maya-client');
  assert.equal(clientUsernameFromEmail('staff@example.com'), null);
  assert.equal(resolveLoginIdentifier(' Staff@example.com '), 'Staff@example.com');
  assert.equal(resolveLoginIdentifier('MAYA-CLIENT'), clientLoginEmail('maya-client'));
  for (const value of ['', 'ab', 'has space', '../admin', 'x'.repeat(49), null, {}]) assert.equal(normalizeClientUsername(value), null);
});

test('client creation generates a strong password, confirms only its internal identifier and fixes the read-only role', async () => {
  const f = fixture();
  const result = await createClientUser(f.client, { username: 'maya-client', role: 'admin', password: 'chosen' });
  assert.equal(result.username, 'maya-client');
  assert.match(result.password, /^Mc7![a-f0-9]{32}$/);
  assert.equal(f.calls[0][1].email_confirm, true);
  assert.equal(f.calls[0][1].password, result.password);
  assert.equal(f.calls[1][1].role, 'demo');
  assert.equal(result.profile.account_status, 'active');
  assert.equal(Object.hasOwn(f.calls[0][1].user_metadata, 'role'), false);
});

test('duplicates and invalid names cannot reset existing accounts or create credentials', async () => {
  const f = fixture({ existing: true });
  await assert.rejects(createClientUser(f.client, { username: 'maya-client' }), /clientLogin.exists/);
  assert.equal(f.calls.length, 0);
  await assert.rejects(createClientUser(f.client, { username: 'bad name' }), /clientLogin.invalidUsername/);
  assert.equal(f.calls.length, 0);
});

test('profile failures clean up the new Auth user without returning the password', async () => {
  const f = fixture({ profileError: true });
  await assert.rejects(createClientUser(f.client, { username: 'maya-client' }), /clientLogin.createError/);
  assert.deepEqual(f.calls.at(-1), ['cleanup', 'new-user']);
  const failed = fixture({ createError: true });
  await assert.rejects(createClientUser(failed.client, { username: 'maya-client' }), /clientLogin.createError/);
  assert.equal(failed.calls.length, 1);
});
