import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { transformSync } from 'esbuild';
import { ClientUserError, createClientUser } from './client-users.js';

const requesterId = '11111111-1111-4111-8111-111111111111';
const targetId = '22222222-2222-4222-8222-222222222222';
const source = transformSync(readFileSync(new URL('./index.ts', import.meta.url), 'utf8')
  .replace(/^import .*?;\s*/gm, ''), { loader: 'ts' }).code;

function fixture({ role = 'admin', signedIn = true, rpcError = null } = {}) {
  let handler;
  const calls = [];
  const client = {
    auth: { getUser: async () => ({ data: { user: signedIn ? { id: requesterId } : null } }) },
    from: () => ({ select: () => ({ eq: (_field, id) => ({ maybeSingle: async () => ({
      data: id === requesterId ? { id, role, email: 'admin@example.com' }
        : { id, role: 'field_worker', email: 'worker@example.com', full_name: 'Worker' },
    }) }) }) }),
    rpc: async (name, payload) => { calls.push({ name, payload }); return { error: rpcError }; },
  };
  new Function('createClient', 'Deno', 'ClientUserError', 'createClientUser', source)(() => client, {
    env: { get: () => 'fixture' }, serve: (fn) => { handler = fn; },
  }, ClientUserError, createClientUser);
  return {
    calls,
    invoke: (payload) => handler(new Request('https://fixture.invalid', {
      method: 'POST', headers: { Authorization: 'Bearer fixture', 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete-user', userId: targetId, confirmation: 'worker@example.com', ...payload }),
    })),
  };
}

test('client account creation is unavailable to anonymous users, clients and other staff roles', async () => {
  for (const settings of [{ role: 'manager' }, { role: 'field_worker' }, { role: 'demo' }, { signedIn: false }]) {
    const f = fixture(settings);
    const response = await f.invoke({ action: 'create-client-user', username: 'maya-client' });
    assert.equal(response.status, settings.signedIn === false ? 401 : 403);
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
    assert.equal(f.calls.length, 0);
  }
});
