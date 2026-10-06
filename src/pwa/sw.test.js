import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const source = await readFile(new URL('./sw.js', import.meta.url), 'utf8');
const origin = 'https://maya.example';
const html = (body) => new Response(body, { headers: { 'content-type': 'text/html' } });

function worker({ revision = 'current', storage = new Map(), fetch = async () => html('current'), installError } = {}) {
  const handlers = new Map();
  const calls = { skipped: 0, claimed: 0, precached: [] };
  const key = (request) => new URL(typeof request === 'string' ? request : request.url, origin).href;
  const caches = {
    async open(name) {
      if (!storage.has(name)) storage.set(name, new Map());
      const entries = storage.get(name);
      return {
        async addAll(requests) {
          calls.precached.push(...requests);
          if (installError) throw installError;
          for (const request of requests) entries.set(key(request), html(revision));
        },
        async match(request) { return entries.get(key(request))?.clone(); },
        async put(request, response) { entries.set(key(request), response.clone()); },
      };
    },
    async keys() { return [...storage.keys()]; },
    async delete(name) { return storage.delete(name); },
    // Deliberately no global match(): old shells must never be consulted.
  };
  vm.runInNewContext(source, {
    self: {
      __WB_MANIFEST: [{ url: 'index.html', revision }, { url: 'assets/app.js', revision: null }],
      location: { origin },
      addEventListener: (type, handler) => handlers.set(type, handler),
      skipWaiting: async () => { calls.skipped++; },
      clients: { claim: async () => { calls.claimed++; } },
    },
    caches, fetch, Request, URL, console,
  });
  return {
    calls, storage,
    async dispatch(type, request) {
      const pending = [];
      let response;
      handlers.get(type)({
        request,
        waitUntil: (promise) => pending.push(promise),
        respondWith: (promise) => { response = promise; },
      });
      const result = await response;
      await Promise.all(pending);
      return result;
    },
  };
}

const navigation = { method: 'GET', mode: 'navigate', url: `${origin}/app/projects?project=123` };

test('a new release installs fresh files before activating and removes only previous Maya shells', async () => {
  const app = worker({ storage: new Map([['maya-app-shell-v1', new Map()], ['unrelated', new Map()]]) });
  await app.dispatch('install');
  assert.equal(app.calls.skipped, 1);
  assert.ok(app.calls.precached.every((request) => request.cache === 'reload'));
  await app.dispatch('activate');
  assert.equal(app.calls.claimed, 1);
  assert.deepEqual([...app.storage.keys()], ['unrelated', 'maya-app-shell-v2-current']);
});

test('a failed precache does not skip the working worker', async () => {
  const app = worker({ installError: new Error('offline') });
  await assert.rejects(app.dispatch('install'), /offline/);
  assert.equal(app.calls.skipped, 0);
});

test('online project navigation bypasses HTTP cache and saves fresh HTML for offline navigation', async () => {
  let offline = false;
  const app = worker({ fetch: async (request, options) => {
    assert.equal(request, navigation);
    assert.equal(options.cache, 'no-store');
    if (offline) throw new Error('offline');
    return html('fresh shell');
  } });
  await app.dispatch('install');
  assert.equal(await (await app.dispatch('fetch', navigation)).text(), 'fresh shell');
  offline = true;
  assert.equal(await (await app.dispatch('fetch', navigation)).text(), 'fresh shell');
});

test('older worker writes cannot replace the current release offline shell', async () => {
  const storage = new Map();
  const old = worker({ revision: 'old', storage, fetch: async () => html('stale shell') });
  const current = worker({ storage, fetch: async () => { throw new Error('offline'); } });
  await old.dispatch('install');
  await current.dispatch('install');
  await old.dispatch('fetch', navigation);
  assert.equal(await (await current.dispatch('fetch', navigation)).text(), 'current');
});

test('asset lookups ignore legacy caches and use the current release cache', async () => {
  const request = new Request(`${origin}/icon.png`);
  let fetched = 0;
  const app = worker({
    storage: new Map([['legacy-workbox', new Map([[request.url, new Response('old icon')]])]]),
    fetch: async () => { fetched++; return new Response('new icon'); },
  });
  assert.equal(await (await app.dispatch('fetch', request)).text(), 'new icon');
  assert.equal(await (await app.dispatch('fetch', request)).text(), 'new icon');
  assert.equal(fetched, 1);
});

test('server errors and non-HTML responses do not corrupt the offline shell', async () => {
  for (const response of [new Response('server error', { status: 503 }), new Response('{}')]) {
    let offline = false;
    const app = worker({ fetch: async () => {
      if (offline) throw new Error('offline');
      return response;
    } });
    await app.dispatch('install');
    await app.dispatch('fetch', navigation);
    offline = true;
    assert.equal(await (await app.dispatch('fetch', navigation)).text(), 'current');
  }
});
