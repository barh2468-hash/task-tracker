import test from 'node:test';
import assert from 'node:assert/strict';
import { createProjectLoader, resolveProjectLink } from './projectLoader.js';

const profile = { id: 'user-a', role: 'manager' };
const project = { id: 'linked' };
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function setup(options = {}) {
  let state;
  const loader = createProjectLoader({
    read: async () => [project], readCache: async () => null, writeCache: async () => {},
    ...options, publish: (next) => { state = next; },
  });
  return { loader, state: () => state };
}

test('a timeout with no cache keeps the link pending and can recover on retry', async () => {
  let fail = true;
  const { loader, state } = setup({ read: async () => {
    if (fail) throw new Error('statement timeout');
    return [project];
  } });
  await loader.load(profile);
  assert.equal(state().error, true);
  assert.equal(state().loading, false);
  assert.equal(resolveProjectLink('linked', state().projects, state().verified), 'pending');
  fail = false;
  await loader.load(profile);
  assert.equal(state().error, false);
  assert.equal(state().verified, true);
  assert.equal(resolveProjectLink('linked', state().projects, state().verified), 'available');
});

test('cached missing projects never establish an access denial', async () => {
  const { loader, state } = setup({ read: async () => { throw new Error('offline'); }, readCache: async () => [{ id: 'cached' }] });
  await loader.load(profile);
  assert.equal(resolveProjectLink('linked', state().projects, state().verified), 'pending');
  assert.equal(resolveProjectLink('cached', state().projects, state().verified), 'available');
});

test('cache read/write failures cannot discard valid server data or leave loading stuck', async () => {
  const storageError = async () => { throw new Error('device storage blocked'); };
  const { loader, state } = setup({ readCache: storageError, writeCache: storageError });
  await loader.load(profile);
  assert.deepEqual(state().projects, [project]);
  assert.equal(state().verified, true);
  const failing = setup({ read: storageError, readCache: storageError });
  await failing.loader.load(profile);
  assert.equal(failing.state().loading, false);
  assert.equal(failing.state().verified, false);
});

test('failed background refresh preserves the current data and optimistic edits', async () => {
  let fail = false;
  const { loader, state } = setup({ read: async () => {
    if (fail) throw new Error('timeout');
    return [project];
  }, readCache: async () => [{ id: 'older-cache' }] });
  await loader.load(profile);
  loader.setProjects((projects) => projects.map((item) => ({ ...item, name: 'new edit' })));
  fail = true;
  await loader.load(profile);
  assert.equal(state().projects[0].name, 'new edit');
  assert.equal(state().error, true);
  assert.equal(state().verified, false);
});

test('poll, focus and realtime refreshes share the same in-flight request', async () => {
  let calls = 0;
  const pending = deferred();
  const { loader, state } = setup({ read: () => { calls += 1; return pending.promise; } });
  const first = loader.load(profile);
  assert.equal(loader.load(profile), first);
  assert.equal(loader.load(profile), first);
  await Promise.resolve();
  assert.equal(calls, 1);
  pending.resolve([project]);
  await first;
  assert.equal(state().verified, true);
});

test('late success or failure from a previous account cannot overwrite the new account', async () => {
  for (const fail of [false, true]) {
    const previous = deferred();
    const { loader, state } = setup({ read: (user) => user.id === profile.id ? previous.promise : Promise.resolve([{ id: 'user-b-project' }]) });
    const first = loader.load(profile);
    await loader.load({ id: 'user-b', role: 'field_worker' });
    if (fail) previous.reject(new Error('timeout')); else previous.resolve([project]);
    await first;
    assert.equal(state().owner, 'user-b:field_worker');
    assert.deepEqual(state().projects, [{ id: 'user-b-project' }]);
  }
});

test('logout clears data and cancels a late response', async () => {
  const previous = deferred();
  const { loader, state } = setup({ read: () => previous.promise });
  const first = loader.load(profile);
  loader.activate(null);
  previous.resolve([project]);
  await first;
  assert.equal(state().owner, null);
  assert.deepEqual(state().projects, []);
});

test('cleanup cancels old reads and remounting starts a new request', async () => {
  const previous = deferred();
  let calls = 0;
  const { loader, state } = setup({ read: () => ++calls === 1 ? previous.promise : Promise.resolve([project]) });
  const first = loader.load(profile);
  loader.cancel();
  await loader.load(profile);
  previous.resolve([]);
  await first;
  assert.deepEqual(state().projects, [project]);
});

test('only a complete successful response can mark a missing project unavailable', async () => {
  const { loader, state } = setup({ read: async () => [] });
  await loader.load(profile);
  assert.equal(resolveProjectLink('linked', state().projects, state().verified), 'unavailable');
  assert.equal(resolveProjectLink(null, state().projects, state().verified), 'none');
});

test('a synchronous read failure can be retried and stalled storage does not block refreshes', async () => {
  let fail = true;
  let calls = 0;
  const { loader, state } = setup({ read: () => {
    calls += 1;
    if (fail) throw new Error('configuration error');
    return Promise.resolve([project]);
  }, writeCache: () => new Promise(() => {}) });
  await loader.load(profile);
  assert.equal(state().error, true);
  fail = false;
  await loader.load(profile);
  await loader.load(profile);
  assert.equal(calls, 3);
  assert.equal(state().verified, true);
});
