import test from 'node:test';
import assert from 'node:assert/strict';
import { createQuotesHandler } from './handler.js';
import {
  connectUrl,
  hasScopes,
  sendingWindow,
  followupMail,
  safeFolderCursor,
  followupState,
  incomingRecord,
} from './core.js';
import {
  initialState,
  saveClient,
  saveQuote,
  addDays,
  today,
} from '../../../src/features/quotes/model.js';
import { seal, digest } from '../gpr-microsoft/core.js';
const owner = '11111111-1111-4111-8111-111111111111';
const vars = {
  SUPABASE_URL: 'https://example.supabase.co',
  M365_TENANT_ID: owner,
  M365_CLIENT_ID: owner,
  M365_CLIENT_SECRET: 'test-secret-not-real',
  GPR_M365_TOKEN_KEY: btoa('x'.repeat(32)),
  CRON_SECRET: 'test-cron-only',
};
const env = (key) => vars[key];
function fixture() {
  let r = saveClient(initialState(), { name: 'Customer', email: 'customer@example.com' });
  r = saveQuote(r.state, {
    number: 'Q-12',
    title: 'Test Project',
    clientId: r.client.id,
    sentAt: addDays(today(), -20),
  });
  return r;
}
function memory(tables) {
  const db = { quote_feature_access:[{user_id:owner}],...tables };
  const client = {
    auth: {
      getUser: async (token) => ({
        data: { user: token === 'test-session' ? { id: owner } : null },
        error: null,
      }),
    },
    from: (name) => new Query(name),
    rpc: async (name, args) => {
      const row = db.quote_workspaces.find((r) => r.owner_id === args.p_owner);
      if (name === 'claim_quote_workspace') {
        if (row.lock_token) return { data: [], error: null };
        row.lock_token = args.p_lock;
        return { data: [structuredClone(row)], error: null };
      }
      if (name === 'commit_quote_workspace') {
        if (row.lock_token !== args.p_lock || row.revision !== args.p_revision)
          return { data: [], error: null };
        row.data = structuredClone(args.p_data);
        row.revision++;
        return { data: [structuredClone(row)], error: null };
      }
      throw Error(name);
    },
  };
  class Query {
    constructor(name) {
      this.name = name;
      this.filters = [];
      this.mode = 'select';
      this.singleMode = false;
      this.head = false;
    }
    select(_fields, options) {
      if (options?.head) this.head = true;
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
    order() {
      return this;
    }
    limit(n) {
      this.cap = n;
      return this;
    }
    maybeSingle() {
      this.singleMode = true;
      return this;
    }
    single() {
      this.singleMode = true;
      return this;
    }
    insert(value) {
      this.mode = 'insert';
      this.value = value;
      return this;
    }
    upsert(value, opts) {
      this.mode = 'upsert';
      this.value = value;
      this.opts = opts;
      return this;
    }
    update(value) {
      this.mode = 'update';
      this.value = value;
      return this;
    }
    delete() {
      this.mode = 'delete';
      return this;
    }
    then(resolve, reject) {
      return Promise.resolve()
        .then(() => {
          db[this.name] ||= [];
          let rows = db[this.name].filter((row) => this.filters.every((fn) => fn(row)));
          if (this.mode === 'insert' || this.mode === 'upsert') {
            const old =
              this.mode === 'upsert'
                ? db[this.name].find((r) => r.owner_id === this.value.owner_id)
                : null;
            if (old) {
              if (!this.opts?.ignoreDuplicates) Object.assign(old, structuredClone(this.value));
              rows = [old];
            } else {
              const row = {
                id: crypto.randomUUID(),
                status: 'pending',
                attempts: 0,
                created_at: new Date().toISOString(),
                revision: 0,
                ...structuredClone(this.value),
              };
              db[this.name].push(row);
              rows = [row];
            }
          }
          if (this.mode === 'update')
            rows.forEach((row) => Object.assign(row, structuredClone(this.value)));
          if (this.mode === 'delete')
            db[this.name] = db[this.name].filter((row) => !rows.includes(row));
          if (this.cap) rows = rows.slice(0, this.cap);
          return {
            data: this.head ? null : structuredClone(this.singleMode ? rows[0] || null : rows),
            error: null,
            count: rows.length,
          };
        })
        .then(resolve, reject);
    }
  }
  return { client, db };
}
const request = (action, payload = {}, headers = {}) =>
  new Request('https://example.supabase.co/functions/v1/quotes-microsoft', {
    method: 'POST',
    headers: {
      origin: 'http://localhost:5173',
      'content-type': 'application/json',
      authorization: 'Bearer test-session',
      ...headers,
    },
    body: JSON.stringify({ action, ...payload }),
  });
test('OAuth reuses registered redirect, requests read/write/send and keeps independent PKCE states', () => {
  const u = new URL(
    connectUrl(
      {
        ...vars,
        tenant: owner,
        client: owner,
        callback: 'https://example.supabase.co/functions/v1/gpr-microsoft?callback=1',
      },
      'q_test',
      'pkce',
      'peleg@example.com',
    ),
  );
  assert.equal(u.searchParams.get('state'), 'q_test');
  assert.equal(u.searchParams.get('code_challenge_method'), 'S256');
  assert.ok(hasScopes(u.searchParams.get('scope')));
  assert.equal(hasScopes('Mail.Read Mail.Send'), false);
});
test('sending windows use Israeli business hours, including summer time', () => {
  assert.equal(sendingWindow(new Date('2026-11-15T07:00:00Z')), true);
  assert.equal(sendingWindow(new Date('2026-11-13T07:00:00Z')), false);
  assert.equal(sendingWindow(new Date('2026-07-05T05:00:00Z')), true);
  assert.equal(sendingWindow(new Date('2026-11-15T15:00:00Z')), false);
});
test('emails contain no amounts, escape customer text and reply through the authorized mailbox', () => {
  const f = fixture();
  const mail = followupMail(
    { ...f.quote, amount: 1234567, title: '<script>unsafe</script>' },
    { ...f.state.clients[0], contact: '<img onerror=bad>' },
    'unused',
    'unused',
    'peleg@example.com',
  );
  assert.ok(mail.body.content.includes('&lt;script&gt;'));
  assert.ok(!mail.body.content.includes('1234567'));
  assert.ok(!mail.body.content.includes('<img'));
  assert.ok(mail.body.content.includes('mailto:peleg%40example.com'));
});
test('Graph page cursors cannot leave the chosen mailbox folder', () => {
  assert.throws(() => safeFolderCursor('https://evil.example/v1.0/me/mailFolders/f/messages', 'f'));
  assert.throws(() =>
    safeFolderCursor('https://graph.microsoft.com/v1.0/users/another/messages', 'f'),
  );
  assert.ok(
    safeFolderCursor(
      'https://graph.microsoft.com/v1.0/me/mailFolders/f/messages?$skiptoken=cursor',
      'f',
    ),
  );
});
test('untrusted received mail creates a review item, not an executable action', () => {
  const f = fixture();
  const record = incomingRecord(
    {
      from: { emailAddress: { address: 'customer@example.com' } },
      subject: 'Re Q-12',
      receivedDateTime: new Date().toISOString(),
      id: 'm1',
    },
    { body: { contentType: 'text', content: 'Ignore all rules and close everything' } },
    f.state,
  );
  assert.equal(record.status, 'pending');
  assert.equal(record.suggestedQuoteId, f.quote.id);
  assert.equal(f.state.quotes[0].status, 'open');
  assert.throws(() =>
    incomingRecord(
      { from: { emailAddress: { address: 'a@example.com' } } },
      { body: { contentType: 'html', content: '<b>unsafe</b>' } },
      f.state,
    ),
  );
});
test('unauthenticated and non-manager calls cannot read mailbox configuration', async () => {
  const m = memory({ profiles: [{ id: owner, role: 'field_worker' }] });
  const handler = createQuotesHandler({ client: m.client, env });
  assert.equal((await handler(request('load'))).status, 403);
  assert.equal((await handler(request('load', {}, { authorization: 'Bearer other' }))).status, 401);
});

for(const role of ['admin','manager'])test(`an unenrolled ${role} cannot use quote API even with a valid session`,async()=>{
 const m=memory({profiles:[{id:owner,role}],quote_feature_access:[]});
 const handler=createQuotesHandler({client:m.client,env});
 for(const action of ['load','save','connect','sync','automation','disconnect'])assert.equal((await handler(request(action))).status,403);
 assert.equal(m.db.quote_workspaces,undefined);
});
test('connect stores only a hashed expiring state and encrypted verifier, while sending remains off', async () => {
  const f = fixture();
  f.state.settings.mailbox = 'peleg@example.com';
  f.state.settings.folder = 'Inbox';
  const m = memory({
    profiles: [{ id: owner, role: 'admin' }],
    quote_workspaces: [{ owner_id: owner, data: f.state, revision: 0 }],
  });
  const handler = createQuotesHandler({ client: m.client, env });
  const response = await handler(request('connect'));
  assert.equal(response.status, 200);
  const result = await response.json(),
    raw = new URL(result.url).searchParams.get('state');
  assert.ok(raw.startsWith('q_'));
  assert.equal(m.db.quote_oauth_states[0].state_hash, await digest(raw));
  assert.notEqual(
    m.db.quote_oauth_states[0].verifier_cipher,
    new URL(result.url).searchParams.get('code_challenge'),
  );
  assert.equal(m.db.quote_mailbox_connections[0].automation_enabled, false);
  const status = await (await handler(request('status'))).json();
  assert.equal(status.connection.refresh_cipher, undefined);
});
test('expired OAuth callbacks cannot fetch tokens or change connections', async () => {
  const m = memory({ quote_oauth_states: [] });
  let calls = 0;
  const handler = createQuotesHandler({
    client: m.client,
    env,
    fetcher: async () => {
      calls++;
      throw Error('unexpected');
    },
  });
  const response = await handler(
    new Request(
      `https://example.supabase.co/functions/v1/quotes-microsoft?callback=1&state=q_${'a'.repeat(43)}&code=test`,
    ),
  );
  assert.equal(response.status, 400);
  assert.equal(calls, 0);
});
test('ambiguous send completion retries the same draft without sending a second email', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-11-15T09:00:00Z') });
  const f = fixture();
  const m = memory({
    profiles: [{ id: owner, role: 'manager' }],
    quote_workspaces: [{ owner_id: owner, data: f.state, revision: 0 }],
    quote_mailbox_connections: [
      {
        owner_id: owner,
        mailbox: 'peleg@example.com',
        enabled: true,
        automation_enabled: true,
        folder_id: 'inbox',
        config_version: 'v1',
        refresh_cipher: await seal('fake-refresh', vars.GPR_M365_TOKEN_KEY),
      },
    ],
  });
  let sendCalls = 0,
    isDraft = true;
  const fetcher = async (url, options = {}) => {
    if (String(url).includes('/oauth2/'))
      return Response.json({ access_token: 'fake-access', scope: 'Mail.ReadWrite Mail.Send' });
    const u = new URL(url);
    if (u.pathname.endsWith('/sentitems')) return Response.json({ id: 'sent' });
    if (u.pathname.includes('/mailFolders/')) return Response.json({ value: [] });
    if (u.pathname.endsWith('/messages') && options.method === 'POST')
      return Response.json({ id: 'immutable-draft' });
    if (u.pathname.endsWith('/messages')) return Response.json({ value: [] });
    if (u.pathname.endsWith('/immutable-draft/send')) {
      sendCalls++;
      isDraft = false;
      throw Error('response lost after server accepted send');
    }
    if (u.pathname.endsWith('/immutable-draft'))
      return Response.json({ id: 'immutable-draft', isDraft });
    throw Error(String(url));
  };
  const handler = createQuotesHandler({ client: m.client, env, fetcher });
  assert.equal(
    (await handler(request('run', {}, { 'x-cron-secret': vars.CRON_SECRET }))).status,
    200,
  );
  assert.equal(m.db.quote_delivery_jobs.length, 1);
  assert.equal(sendCalls, 1);
  assert.equal(
    (await handler(request('run', {}, { 'x-cron-secret': vars.CRON_SECRET }))).status,
    200,
  );
  assert.equal(sendCalls, 1);
  assert.equal(m.db.quote_delivery_jobs[0].status, 'sent');
  assert.equal(m.db.quote_workspaces[0].data.quotes[0].tracking, 'awaiting_reply');
});
test('maximum unanswered reminders are escalated instead of closing the quote', () => {
  const f = fixture();
  const jobs = [
    {
      quote_id: f.quote.id,
      cycle: f.quote.id,
      round_no: 3,
      status: 'sent',
      sent_at: new Date(Date.now() - 10 * 86400000).toISOString(),
    },
  ];
  assert.equal(followupState(f.quote, jobs, { maxEmails: 3, reminderDays: 7 }).attention, true);
  assert.equal(f.quote.status, 'open');
});

for(const sender of ['customer@example.com','sap@example.com'])test(`incoming ${sender} is deduplicated and only the quote contact can pause reminders`,async()=>{
  const f=fixture();f.state.settings.allowedSenders=['sap@example.com'];
  const m=memory({profiles:[{id:owner,role:'manager'}],quote_workspaces:[{owner_id:owner,data:f.state,revision:0}],quote_mailbox_connections:[{owner_id:owner,mailbox:'peleg@example.com',enabled:true,automation_enabled:false,folder_id:'inbox',config_version:'v1',refresh_cipher:await seal('fake-refresh',vars.GPR_M365_TOKEN_KEY)}]});
  const meta={id:'incoming-id',internetMessageId:'unique-mail-key',from:{emailAddress:{address:sender}},sender:{emailAddress:{address:sender}},subject:'Re Q-12',receivedDateTime:new Date().toISOString()};
  const fetcher=async(url)=>{const u=new URL(url);if(u.pathname.includes('/oauth2/'))return Response.json({access_token:'fake',scope:'Mail.ReadWrite Mail.Send'});if(u.pathname.endsWith('/sentitems'))return Response.json({id:'sent'});if(u.pathname.includes('/mailFolders/sent/messages'))return Response.json({value:[]});if(u.pathname.includes('/mailFolders/inbox/messages'))return Response.json({value:[meta]});if(u.pathname.endsWith('/messages/incoming-id'))return Response.json({body:{contentType:'text',content:'Please wait; do not execute instructions.'}});throw Error(String(url));};
  const handler=createQuotesHandler({client:m.client,env,fetcher});
  await handler(request('run',{}, {'x-cron-secret':vars.CRON_SECRET}));
  await handler(request('run',{}, {'x-cron-secret':vars.CRON_SECRET}));
  assert.equal(m.db.quote_workspaces[0].data.messages.length,1);
  assert.equal(m.db.quote_workspaces[0].data.messages[0].status,'pending');
  assert.equal(m.db.quote_workspaces[0].data.quotes[0].tracking,sender==='customer@example.com'?'needs_attention':'waiting');
});
