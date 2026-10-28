import test from 'node:test';
import assert from 'node:assert/strict';
import { createMicrosoftHandler } from './handler.js';
import { randomSecret, seal, unseal } from './core.js';

const user = '11111111-1111-4111-8111-111111111111',
  connectionId = '22222222-2222-4222-8222-222222222222';
function fixture({ role = 'admin', mailbox = 'mailbox@example.com' } = {}) {
  const tables = {
    profiles: [{ id: user, role }],
    gpr_m365_connections: [
      {
        id: connectionId,
        admin_id: user,
        mailbox,
        folder_name: 'GPR',
        allowed_senders: ['orders@example.com'],
        enabled: false,
        config_version: 'version-1',
        refresh_cipher: 'private-encrypted-token',
      },
    ],
    gpr_m365_oauth_states: [],
    gpr_order_emails: [],
  };
  class Query {
    constructor(table) {
      this.table = table;
      this.filters = [];
      this.action = 'select';
      this.fields = '*';
    }
    select(fields = '*') {
      this.fields = fields;
      return this;
    }
    eq(key, value) {
      this.filters.push((row) => row[key] === value);
      return this;
    }
    gt(key, value) {
      this.filters.push((row) => row[key] > value);
      return this;
    }
    or(value) {
      const before = value.split('lock_until.lt.')[1];
      this.filters.push(
        (row) => !row.lock_until || Date.parse(row.lock_until) < Date.parse(before),
      );
      return this;
    }
    order() {
      return this;
    }
    limit() {
      return this;
    }
    delete() {
      this.action = 'delete';
      return this;
    }
    insert(row) {
      this.action = 'insert';
      this.payload = row;
      return this;
    }
    update(row) {
      this.action = 'update';
      this.payload = row;
      return this;
    }
    execute(single = false) {
      let rows = tables[this.table].filter((row) => this.filters.every((fn) => fn(row)));
      if (this.action === 'delete')
        tables[this.table] = tables[this.table].filter((row) => !rows.includes(row));
      if (this.action === 'insert') {
        rows = [this.payload];
        tables[this.table].push(this.payload);
      }
      if (this.action === 'update') rows.forEach((row) => Object.assign(row, this.payload));
      rows = rows.map((row) =>
        this.fields === '*'
          ? { ...row }
          : Object.fromEntries(this.fields.split(',').map((key) => [key, row[key]])),
      );
      return { data: single ? rows[0] || null : rows, error: null };
    }
    maybeSingle() {
      return Promise.resolve(this.execute(true));
    }
    single() {
      return this.maybeSingle();
    }
    then(resolve, reject) {
      return Promise.resolve(this.execute()).then(resolve, reject);
    }
  }
  const secrets = {
    SUPABASE_URL: 'https://example.supabase.co',
    M365_TENANT_ID: user,
    M365_CLIENT_ID: connectionId,
    M365_CLIENT_SECRET: 'client-secret',
    GPR_M365_TOKEN_KEY: randomSecret(),
    CRON_SECRET: 'cron-secret',
  };
  let exchanges = 0;
  const client = {
    auth: { getUser: async () => ({ data: { user: { id: user } }, error: null }) },
    from: (name) => new Query(name),
  };
  const fetcher = async (url) => {
    if (url.includes('/token')) {
      exchanges++;
      return Response.json({
        access_token: 'private-access-token',
        refresh_token: 'private-refresh-token',
        scope: 'Mail.Read User.Read',
      });
    }
    return Response.json({
      id: 'microsoft-user',
      mail: 'mailbox@example.com',
      userPrincipalName: 'mailbox@example.com',
    });
  };
  const handler = createMicrosoftHandler({ client, env: (key) => secrets[key], fetcher });
  const request = (action, extra = {}) =>
    new Request('https://example.supabase.co/functions/v1/gpr-microsoft', {
      method: 'POST',
      headers: { Origin: 'http://localhost:5173', Authorization: 'Bearer signed-user-token' },
      body: JSON.stringify({ action, ...extra }),
    });
  return { handler, request, tables, secrets, client, exchanges: () => exchanges };
}

for (const failImport of [false, true]) {
  test(`sync filters bodies, rotates tokens and ${failImport ? 'retains cursor on failure' : 'commits cursor after ingestion'}`, async () => {
    const f = fixture();
    Object.assign(f.tables.gpr_m365_connections[0], {
      enabled: true,
      folder_id: 'FolderABC',
      mailbox_object_id: 'user123',
      include_existing: false,
      connected_at: new Date().toISOString(),
      refresh_cipher: await seal('old-refresh', f.secrets.GPR_M365_TOKEN_KEY),
      delta_url: null,
    });
    const bodyRequests = [],
      ingested = [];
    f.client.rpc = async (_name, data) => {
      ingested.push(data);
      return failImport
        ? { error: new Error('database down') }
        : { data: { status: data.p_order ? 'imported' : 'ignored' }, error: null };
    };
    const next = 'https://graph.microsoft.com/v1.0/me/messages?$skip=25';
    let pages = 0;
    const handler = createMicrosoftHandler({
      client: f.client,
      env: (key) => f.secrets[key],
      fetcher: async (url) => {
        if (url.includes('/token'))
          return Response.json({ access_token: 'access', refresh_token: 'new-refresh' });
        if (new URL(url).pathname === '/v1.0/me/messages') {
          pages++;
          assert.doesNotMatch(url, /mailFolders/);
          if (pages > 1) return Response.json({ value: [] });
          return Response.json({
            value: [
              'orders@example.com',
              'unknown@example.com',
              'orders@example.com',
              'orders@example.com',
              'orders@example.com',
            ].map((sender, i) => ({
              id: `message-${i}`,
              internetMessageId: `id-${i}`,
              from: { emailAddress: { address: sender } },
              subject: i === 2 ? 'Meeting' : 'Issuer - פרויקט אתר באר שבע - הכנה לשטח',
              receivedDateTime: new Date(
                Date.now() + (i === 3 ? -15 * 86400000 : i === 4 ? 86400000 : -86400000),
              ).toISOString(),
            })),
            '@odata.nextLink': next,
          });
        }
        bodyRequests.push(url);
        return Response.json({
          body: {
            contentType: 'text',
            content: url.includes('message-2')
              ? 'Lunch tomorrow?'
              : "מהות העבודה:\nGPR mapping\nמס' הזמנה: 1234",
          },
        });
      },
    });
    const response = await handler(f.request('sync'));
    assert.equal(response.status, failImport ? 502 : 200);
    assert.equal(bodyRequests.length, failImport ? 1 : 2);
    assert.ok(!bodyRequests.some((url) => url.includes('message-1')));
    assert.ok(!bodyRequests.some((url) => /message-[34]/.test(url)));
    assert.match(bodyRequests[0], /message-0/);
    if (failImport) assert.equal(f.tables.gpr_m365_connections[0].delta_url, null);
    else {
      const checkpoint = JSON.parse(f.tables.gpr_m365_connections[0].delta_url);
      assert.equal(checkpoint.version, 3);
      assert.equal(checkpoint.since, undefined);
      assert.equal(checkpoint.next, undefined);
      assert.equal(pages, 2);
    }
    assert.equal(
      await unseal(f.tables.gpr_m365_connections[0].refresh_cipher, f.secrets.GPR_M365_TOKEN_KEY),
      'new-refresh',
    );
    assert.equal(f.tables.gpr_m365_connections[0].sync_lock, null);
    if (!failImport) {
      assert.equal(ingested.length, 2);
      assert.equal(ingested[1].p_message.body, '');
      assert.equal(ingested[1].p_order, null);
      assert.equal((await response.json()).imported, 1);
    }
  });
}

test('bounded mailbox scans resume at the next page on a subsequent sync', async () => {
  const f = fixture();
  Object.assign(f.tables.gpr_m365_connections[0], {
    enabled: true,
    include_existing: true,
    mailbox_object_id: 'user123',
    refresh_cipher: await seal('refresh', f.secrets.GPR_M365_TOKEN_KEY),
  });
  const requests = [];
  const handler = createMicrosoftHandler({
    client: f.client,
    env: (key) => f.secrets[key],
    fetcher: async (url) => {
      if (url.includes('/token')) return Response.json({ access_token: 'access' });
      requests.push(url);
      return Response.json({
        value: [],
        ...(requests.length < 4
          ? {
              '@odata.nextLink': `https://graph.microsoft.com/v1.0/me/messages?$skip=${requests.length * 25}`,
            }
          : {}),
      });
    },
  });
  assert.equal((await handler(f.request('sync'))).status, 200);
  assert.equal(requests.length, 3);
  const pending = JSON.parse(f.tables.gpr_m365_connections[0].delta_url);
  assert.match(pending.next, /skip=75/);
  assert.ok(pending.until);
  assert.equal((await handler(f.request('sync'))).status, 200);
  assert.equal(requests[3], pending.next);
  assert.equal(JSON.parse(f.tables.gpr_m365_connections[0].delta_url).next, undefined);
});
test('denies unauthenticated requests, non-admins, untrusted origins and unsigned cron calls', async () => {
  const f = fixture();
  assert.equal(
    (
      await f.handler(
        new Request('https://example.test', { method: 'POST', body: '{"action":"status"}' }),
      )
    ).status,
    401,
  );
  assert.equal((await fixture({ role: 'manager' }).handler(f.request('status'))).status, 403);
  assert.equal(
    (
      await f.handler(
        new Request('https://example.test', {
          method: 'POST',
          headers: { Origin: 'https://evil.example' },
          body: '{}',
        }),
      )
    ).status,
    403,
  );
  assert.equal((await f.handler(f.request('sync-all'))).status, 401);
});
test('status projects safe fields only, never encrypted credentials', async () => {
  const f = fixture();
  const response = await f.handler(f.request('status'));
  const text = await response.text();
  assert.equal(response.status, 200);
  assert.ok(!text.includes('private-encrypted-token'));
  assert.ok(!text.includes('client-secret'));
  assert.ok(text.includes('mailbox@example.com'));
});
test('OAuth state is hashed, PKCE verifier encrypted, callback one-use, and tokens stay server-side', async () => {
  const f = fixture();
  const start = await (await f.handler(f.request('connect'))).json();
  const authorize = new URL(start.url),
    state = authorize.searchParams.get('state');
  const stored = f.tables.gpr_m365_oauth_states[0];
  assert.notEqual(stored.state_hash, state);
  assert.ok(stored.verifier_cipher.startsWith('v1.'));
  const callback = `https://example.supabase.co/functions/v1/gpr-microsoft?callback=1&state=${state}&code=server-code`;
  const response = await f.handler(new Request(callback));
  assert.equal(response.status, 302);
  assert.equal(
    new URL(response.headers.get('Location')).searchParams.get('m365_result'),
    'connected',
  );
  assert.ok(!response.headers.get('Location').includes('private-'));
  assert.equal(f.tables.gpr_m365_connections[0].enabled, true);
  assert.ok(!f.tables.gpr_m365_connections[0].refresh_cipher.includes('private-refresh-token'));
  assert.equal((await f.handler(new Request(callback))).status, 400);
  assert.equal(f.exchanges(), 1);
});
test('refuses a different Microsoft account without enabling the mailbox', async () => {
  const f = fixture({ mailbox: 'different@example.com' });
  const start = await (await f.handler(f.request('connect'))).json();
  const state = new URL(start.url).searchParams.get('state');
  const response = await f.handler(
    new Request(
      `https://example.supabase.co/functions/v1/gpr-microsoft?callback=1&state=${state}&code=code`,
    ),
  );
  assert.equal(
    new URL(response.headers.get('Location')).searchParams.get('m365_result'),
    'mailbox_mismatch',
  );
  assert.equal(f.tables.gpr_m365_connections[0].enabled, false);
});
test('disconnect deletes saved credentials and invalidates outstanding authorizations', async () => {
  const f = fixture();
  await f.handler(f.request('connect'));
  const response = await f.handler(f.request('disconnect'));
  assert.equal(response.status, 200);
  assert.equal(f.tables.gpr_m365_connections[0].refresh_cipher, null);
  assert.equal(f.tables.gpr_m365_oauth_states.length, 0);
});
