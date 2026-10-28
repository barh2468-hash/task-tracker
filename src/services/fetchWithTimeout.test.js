import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchWithTimeout } from './fetchWithTimeout.js';

function pendingFetch(t) {
  return t.mock.method(
    globalThis,
    'fetch',
    (_input, init) =>
      new Promise((_resolve, reject) => {
        init.signal.addEventListener('abort', () => reject(init.signal.reason), { once: true });
      }),
  );
}

test('GPR synchronization can run past seven seconds but times out at ninety seconds', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const mocked = pendingFetch(t);
  let outcome = 'pending';
  const result = fetchWithTimeout('https://example.supabase.co/functions/v1/gpr-microsoft', {
    method: 'POST',
    body: JSON.stringify({ action: 'sync' }),
  }).then(
    () => {
      outcome = 'success';
    },
    (error) => {
      outcome = error.message;
    },
  );
  t.mock.timers.tick(7000);
  await Promise.resolve();
  assert.equal(outcome, 'pending');
  t.mock.timers.tick(83000);
  await result;
  assert.equal(outcome, 'Request timed out');
  assert.equal(mocked.mock.callCount(), 1);
});

for (const [path, action] of [
  ['/rest/v1/projects', 'sync'],
  ['/functions/v1/gpr-microsoft', 'status'],
  ['/functions/v1/another-function', 'sync'],
]) {
  test(`ordinary POST ${path} (${action}) retains seven-second timeout and no retry`, async (t) => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const mocked = pendingFetch(t);
    const result = fetchWithTimeout(`https://example.supabase.co${path}`, {
      method: 'POST',
      body: JSON.stringify({ action }),
    });
    const rejected = assert.rejects(result, /Request timed out/);
    t.mock.timers.tick(7000);
    await rejected;
    assert.equal(mocked.mock.callCount(), 1);
  });
}

test('caller cancellation aborts a GPR sync immediately', async (t) => {
  pendingFetch(t);
  const controller = new AbortController();
  const result = fetchWithTimeout('https://example.supabase.co/functions/v1/gpr-microsoft', {
    method: 'POST',
    body: '{"action":"sync"}',
    signal: controller.signal,
  });
  const rejected = assert.rejects(result, /Cancelled by caller/);
  controller.abort(new Error('Cancelled by caller'));
  await rejected;
});

test('GET requests still retry a transient failure once', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let count = 0;
  t.mock.method(globalThis, 'fetch', async () => {
    if (++count === 1) throw new Error('Temporary network failure');
    return Response.json({ ok: true });
  });
  const result = fetchWithTimeout('https://example.supabase.co/rest/v1/projects');
  await Promise.resolve();
  t.mock.timers.tick(300);
  assert.deepEqual(await (await result).json(), { ok: true });
  assert.equal(count, 2);
});
