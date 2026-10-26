import test from 'node:test';
import assert from 'node:assert/strict';
import { messageReaders } from './receipts.js';

const message = { sender_id: 'me', created_at: '2026-10-26T10:00:00Z' };

test('a direct chat is read once the other person has caught up', () => {
  const members = [
    { user_id: 'me', last_read_at: '2026-10-26T10:00:00Z' },
    { user_id: 'avi', last_read_at: '2026-10-26T09:59:00Z' },
  ];
  assert.equal(messageReaders(message, members).readByAll, false);
  members[1].last_read_at = '2026-10-26T10:00:00Z';
  assert.deepEqual(messageReaders(message, members), {
    readerIds: ['avi'],
    waitingIds: [],
    readByAll: true,
  });
});

test('in groups each member is counted separately', () => {
  const members = [
    { user_id: 'me', last_read_at: null },
    { user_id: 'avi', last_read_at: '2026-10-26T11:00:00Z' },
    { user_id: 'dana', last_read_at: null },
  ];
  assert.deepEqual(messageReaders(message, members), {
    readerIds: ['avi'],
    waitingIds: ['dana'],
    readByAll: false,
  });
});

test('no other members means not read', () => {
  assert.equal(messageReaders(message, [{ user_id: 'me', last_read_at: null }]).readByAll, false);
  assert.equal(messageReaders(message, undefined).readByAll, false);
});
