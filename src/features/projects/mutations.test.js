import { test } from 'node:test';
import assert from 'node:assert/strict';
import { finishProjectMutation } from './mutations.js';

test(
  'saved reports close immediately even when the project and inbox reads are stalled',
  { timeout: 200 },
  async () => {
    let release,
      applied = false,
      refreshed = false;
    const slow = new Promise((resolve) => {
      release = resolve;
    });
    const result = { ok: true, optimistic: { is_done: false }, report: { id: 'saved' } };
    assert.equal(
      await finishProjectMutation(Promise.resolve(result), {
        notify: () => {},
        applyOptimistic: () => {
          applied = true;
        },
        refresh: () => {
          refreshed = true;
          return slow;
        },
        background: true,
      }),
      result,
    );
    assert.equal(applied, true);
    assert.equal(refreshed, true);
    release();
  },
);
test('save results still wait for the write and failures do not refresh or apply success', async () => {
  let complete,
    applied = false,
    refreshed = false,
    resolved = false;
  const pending = new Promise((resolve) => {
    complete = resolve;
  });
  const save = finishProjectMutation(pending, {
    notify: () => {},
    applyOptimistic: () => {
      applied = true;
    },
    refresh: () => {
      refreshed = true;
    },
    background: true,
  }).then((result) => {
    resolved = true;
    return result;
  });
  await Promise.resolve();
  assert.equal(resolved, false);
  complete({ ok: false });
  assert.equal((await save).ok, false);
  assert.equal(applied, false);
  assert.equal(refreshed, false);
});
