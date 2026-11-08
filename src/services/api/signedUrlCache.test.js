import test from 'node:test';
import assert from 'node:assert/strict';
import { createSignedUrlCache } from './signedUrlCache.js';

const response = (url = 'signed') => ({ data: { signedUrl: url }, error: null });
function deferred() {
  let resolve;
  const promise = new Promise((yes) => { resolve = yes; });
  return { promise, resolve };
}

test('duplicate pending calls and repeat renders reuse one signing request', async () => {
  let calls = 0;
  const pending = deferred();
  const cache = createSignedUrlCache({ sign: () => { calls += 1; return pending.promise; } });
  const first = cache.get('files', 'plan.pdf');
  assert.equal(cache.get('files', 'plan.pdf'), first);
  await Promise.resolve();
  assert.equal(calls, 1);
  pending.resolve(response());
  await first;
  for (let i = 0; i < 50; i += 1) assert.equal(await cache.get('files', 'plan.pdf'), await first);
  assert.equal(calls, 1);
});

test('all panels together have at most three signing requests in flight', async () => {
  let active = 0, maximum = 0;
  const pending = [];
  const cache = createSignedUrlCache({ sign: async () => {
    active += 1;
    maximum = Math.max(maximum, active);
    const item = deferred();
    pending.push(item);
    await item.promise;
    active -= 1;
    return response();
  } });
  const requests = Array.from({ length: 30 }, (_, i) => cache.get('files', `${i}.pdf`));
  for (let i = 0; i < 30; i += 1) {
    while (!pending[i]) await new Promise((resolve) => setImmediate(resolve));
    assert.ok(active <= 3);
    pending[i].resolve();
  }
  await Promise.all(requests);
  assert.equal(maximum, 3);
});

test('short-lived URLs renew before expiry and slow signing does not extend their lifetime', async () => {
  let now = 0, calls = 0;
  const cache = createSignedUrlCache({ now: () => now, sign: async () => {
    calls += 1;
    now += 1000;
    return response(`url-${calls}`);
  } });
  const first = await cache.get('files', 'plan.pdf', 60);
  assert.equal(first.data.signedUrl, 'url-1');
  assert.equal(first.expiresAt, 54000);
  now = 53999;
  assert.equal((await cache.get('files', 'plan.pdf', 60)).data.signedUrl, 'url-1');
  now = 54000;
  assert.equal((await cache.get('files', 'plan.pdf', 60)).data.signedUrl, 'url-2');
});

test('view/download options and buckets stay separate, failures are retryable', async () => {
  let calls = 0, fail = true;
  const cache = createSignedUrlCache({ sign: async (...args) => {
    calls += 1;
    if (fail) throw new Error('temporary outage');
    return response(JSON.stringify(args));
  } });
  assert.equal((await cache.get('files', 'plan.pdf')).error.message, 'temporary outage');
  fail = false;
  const view = await cache.get('files', 'plan.pdf');
  const download = await cache.get('files', 'plan.pdf', 3600, { download: 'Original name.pdf' });
  const other = await cache.get('private', 'plan.pdf');
  assert.notEqual(view.data.signedUrl, download.data.signedUrl);
  assert.notEqual(view.data.signedUrl, other.data.signedUrl);
  assert.equal(calls, 4);
});

test('sign-out discards cached, active and queued results before another account loads files', async () => {
  const pending = deferred();
  let calls = 0;
  const cache = createSignedUrlCache({ concurrency: 1, sign: async () => {
    calls += 1;
    if (calls === 1) return pending.promise;
    return response('other-account');
  } });
  const oldActive = cache.get('files', 'old.pdf');
  const oldQueued = cache.get('files', 'queued.pdf');
  await Promise.resolve();
  cache.clear();
  const fresh = cache.get('files', 'old.pdf');
  pending.resolve(response('old-account'));
  assert.equal((await oldActive).error.name, 'AbortError');
  assert.equal((await oldQueued).error.name, 'AbortError');
  assert.equal((await fresh).data.signedUrl, 'other-account');
  assert.equal(calls, 2);
});

test('deleting or replacing a file invalidates active requests and both URL variants', async () => {
  let calls = 0;
  const cache = createSignedUrlCache({ sign: async () => response(`url-${++calls}`) });
  await cache.get('files', 'plan.pdf');
  await cache.get('files', 'plan.pdf', 3600, { download: true });
  await cache.get('files', 'unchanged.pdf');
  cache.invalidate('files', ['plan.pdf']);
  assert.equal((await cache.get('files', 'plan.pdf')).data.signedUrl, 'url-4');
  assert.equal((await cache.get('files', 'plan.pdf', 3600, { download: true })).data.signedUrl, 'url-5');
  assert.equal((await cache.get('files', 'unchanged.pdf')).data.signedUrl, 'url-3');
  assert.equal(calls, 5);
});

test('memory cache stays bounded without evicting pending work', async () => {
  let calls = 0;
  const cache = createSignedUrlCache({ maxEntries: 2, sign: async () => response(`url-${++calls}`) });
  await cache.get('files', 'a');
  await cache.get('files', 'b');
  await cache.get('files', 'c');
  await cache.get('files', 'c');
  assert.equal(calls, 3);
  await cache.get('files', 'a');
  assert.equal(calls, 4);
});
