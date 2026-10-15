import test from 'node:test';
import assert from 'node:assert/strict';
import { createDraftStore, draftKey } from './draftStore.js';
import { createDraftSession } from './draftSession.js';

function memoryStore() {
  const rows = new Map();
  return createDraftStore({
    read: async (key) => structuredClone(rows.get(key)),
    write: async (key, row) => { rows.set(key, structuredClone(row)); },
    remove: async (key) => { rows.delete(key); },
  });
}
function session(store, user = 'alice', form = 'new-project', initialValue = { name: '', boundary_sketch: null }) {
  return createDraftSession({ key: draftKey(user, form), initialValue, store });
}

test('navigation/refresh offers recovery without overwriting it with defaults', async () => {
  const store = memoryStore();
  const first = session(store);
  await first.start();
  // Do not wait for autosave before navigating away.
  const saved = first.update({ name: 'Road 531', boundary_sketch: null });
  first.stop();
  const second = session(store);
  await second.start();
  assert.equal(second.getSnapshot().value.name, '');
  assert.equal(second.getSnapshot().recovery.value.name, 'Road 531');
  second.update({ name: 'overwrite', boundary_sketch: null });
  second.resume();
  assert.equal(second.getSnapshot().value.name, 'Road 531');
  await saved;
});

test('drafts are isolated by user, form and project', async () => {
  const store = memoryStore();
  const first = session(store, 'alice', 'work-diary:one');
  await first.start();
  await first.update({ name: 'Private', boundary_sketch: null });
  for (const [user, form] of [['bob', 'work-diary:one'], ['alice', 'work-diary:two'], ['alice', 'personal-note']]) {
    const other = session(store, user, form);
    await other.start();
    assert.equal(other.getSnapshot().recovery, null);
  }
  assert.equal(draftKey(null, 'personal-note'), null);
  assert.notEqual(draftKey('a:b', 'c'), draftKey('a', 'b:c'));
  await assert.rejects(store.write(null, {}));
});

test('attachments and both signatures survive storage round trips', async () => {
  const store = memoryStore();
  const project = session(store);
  await project.start();
  const attachment = new Blob(['drawing bytes'], { type: 'application/pdf' });
  await project.update({ name: 'Road', boundary_sketch: attachment });
  const recovered = session(store);
  await recovered.start(); recovered.resume();
  assert.equal(await recovered.getSnapshot().value.boundary_sketch.text(), 'drawing bytes');
  const initialValue = { form: { contact_name: '', work_date: '' }, customerSignature: '', teamLeadSignature: '' };
  const diary = session(store, 'alice', 'work-diary:one', initialValue);
  await diary.start();
  await diary.update({ form: { contact_name: 'Client', work_date: '2026-10-13' }, customerSignature: 'customer image', teamLeadSignature: 'lead image' });
  const reopened = session(store, 'alice', 'work-diary:one', initialValue);
  await reopened.start(); reopened.resume();
  assert.deepEqual(reopened.getSnapshot().value, diary.getSnapshot().value);
});

test('submission/discard clears queued saves and does not resurrect the draft', async () => {
  const store = memoryStore();
  const draft = session(store);
  await draft.start();
  draft.update({ name: 'First', boundary_sketch: null });
  draft.update({ name: 'Latest', boundary_sketch: null });
  assert.equal(await draft.clear(), true);
  assert.equal(draft.getSnapshot().hasDraft, false);
  const reopened = session(store);
  await reopened.start();
  assert.equal(reopened.getSnapshot().recovery, null);
});

test('failed writes preserve input and expose an error; retries can recover', async () => {
  let fail = true;
  const store = createDraftStore({ read: async () => null, write: async () => { if (fail) throw new Error('quota'); }, remove: async () => {} });
  const draft = session(store);
  await draft.start();
  await draft.update({ name: 'Do not lose', boundary_sketch: null });
  assert.equal(draft.getSnapshot().status, 'error');
  assert.equal(draft.getSnapshot().value.name, 'Do not lose');
  fail = false;
  await draft.update((value) => ({ ...value, name: 'Recovered' }));
  assert.equal(draft.getSnapshot().status, 'saved');
});

test('note editing retains the target id and ignores malformed/unknown saved fields', async () => {
  const store = memoryStore();
  const initialValue = { editingId: null, form: { title: '', body: '', project_id: '' } };
  await store.write(draftKey('alice', 'personal-note'), { editingId: 'note-123', form: { title: 'Edited', body: 'Pending changes', project_id: 42, unknown: 'ignore' }, unknown: 'ignore' });
  const note = session(store, 'alice', 'personal-note', initialValue);
  await note.start(); note.resume();
  assert.deepEqual(note.getSnapshot().value, { editingId: 'note-123', form: { title: 'Edited', body: 'Pending changes', project_id: '' } });
  await store.write(draftKey('alice', 'new-project'), 'corrupt');
  const corrupt = session(store);
  await corrupt.start();
  assert.equal(corrupt.getSnapshot().recovery, null);
});

test('late recovery results from an unmounted form cannot replace a newer session', async () => {
  let resolveRead;
  let readCount = 0;
  const store = {
    read: () => ++readCount === 1 ? new Promise((resolve) => { resolveRead = resolve; }) : Promise.resolve(null),
  };
  const draft = session(store);
  const pending = draft.start();
  draft.stop();
  await draft.start();
  resolveRead({ version: 1, value: { name: 'Stale', boundary_sketch: null }, updatedAt: Date.now() });
  await pending;
  assert.equal(draft.getSnapshot().recovery, null);
  assert.equal(draft.getSnapshot().status, 'idle');
});

test('storage read/delete failures leave the form usable and keep the recoverable draft', async () => {
  const unavailable = session({ read: async () => { throw new Error('blocked'); } });
  await unavailable.start();
  assert.equal(unavailable.getSnapshot().status, 'error');
  const store = { read: async () => ({ version: 1, value: { name: 'Keep me', boundary_sketch: null } }), remove: async () => { throw new Error('blocked'); } };
  const draft = session(store);
  await draft.start();
  assert.equal(await draft.clear(), false);
  draft.resume();
  assert.equal(draft.getSnapshot().value.name, 'Keep me');
});

test('reopening a blank diary uses fresh defaults while saved dates remain unchanged', async () => {
  const store = memoryStore();
  const diary = session(store, 'alice', 'work-diary:one', { work_date: '2026-10-13', contact: '' });
  await diary.start();
  await diary.update({ work_date: '2026-10-13', contact: 'Client' });
  diary.stop();
  await diary.start({ work_date: '2026-10-14', contact: '' });
  diary.resume();
  assert.equal(diary.getSnapshot().value.work_date, '2026-10-13');
  await diary.clear();
  assert.equal(diary.getSnapshot().value.work_date, '2026-10-14');
});
