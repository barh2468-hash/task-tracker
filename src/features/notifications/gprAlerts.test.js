import test from 'node:test';
import assert from 'node:assert/strict';
import {
  notificationUnreadCount,
  readDismissedGpr,
  selectGprAlert,
  writeDismissedGpr,
} from './gprAlerts.js';

test('the unread count uses the server total beyond the 80 displayed rows and respects zero', () => {
  const page = Array.from({ length: 80 }, () => ({ is_read: false }));
  assert.equal(notificationUnreadCount(115, page), 115);
  assert.equal(notificationUnreadCount(0, page, 115), 0);
  assert.equal(notificationUnreadCount(null, page, 115), 115);
});

test('unread GPR work is visible on arrival or the next app launch, without replaying dismissed/read/deleted alerts', () => {
  const first = { id: 'first', type: 'gpr_email_order_received', is_read: false };
  const second = { ...first, id: 'second' };
  const list = [{ id: 'other', type: 'project_update' }, first, second];
  assert.equal(selectGprAlert(list, []).id, 'first');
  assert.equal(selectGprAlert(list, ['first']).id, 'second');
  assert.equal(selectGprAlert(list, ['first', 'second']), null);
  assert.equal(selectGprAlert([{ ...first, is_read: true }], []), null);
  assert.equal(
    selectGprAlert([{ ...first, gpr_work_orders: { deleted_at: '2026-10-28' } }], []),
    null,
  );
});

test('dismissal survives reload for the same user and stays isolated between accounts', () => {
  const values = new Map();
  const storage = {
    getItem: (key) => values.get(key),
    setItem: (key, value) => values.set(key, value),
  };
  writeDismissedGpr(storage, 'admin', ['first']);
  assert.deepEqual(readDismissedGpr(storage, 'admin'), ['first']);
  assert.deepEqual(readDismissedGpr(storage, 'other-user'), []);
  values.set('gpr-alerts:admin', 'broken json');
  assert.deepEqual(readDismissedGpr(storage, 'admin'), []);
  assert.deepEqual(readDismissedGpr(null, 'admin'), []);
  assert.doesNotThrow(() => writeDismissedGpr(null, 'admin', ['first']));
});
