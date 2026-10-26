import test from 'node:test';
import assert from 'node:assert/strict';
import { firstUnreadIndex } from './unreadDivider.js';

const me = 'me';
const messages = [
  { sender_id: 'avi' },
  { sender_id: me },
  { sender_id: 'avi' },
  { sender_id: 'dana' },
  { sender_id: me },
  { sender_id: 'avi' },
];

test('no divider when nothing is unread', () => {
  assert.equal(firstUnreadIndex(messages, 0, me), -1);
  assert.equal(firstUnreadIndex([], 3, me), -1);
});

test('divider sits before the oldest unread message from someone else', () => {
  assert.equal(firstUnreadIndex(messages, 1, me), 5);
  assert.equal(firstUnreadIndex(messages, 2, me), 3);
  assert.equal(firstUnreadIndex(messages, 3, me), 2);
});

test('own messages are skipped when counting back', () => {
  assert.equal(firstUnreadIndex(messages, 4, me), 0);
});

test('project activity events are skipped like own messages', () => {
  const withEvents = [
    { sender_id: 'avi' },
    { sender_id: 'dana', kind: 'event' },
    { sender_id: 'avi' },
    { sender_id: null, kind: 'event' },
  ];
  assert.equal(firstUnreadIndex(withEvents, 1, me), 2);
  assert.equal(firstUnreadIndex(withEvents, 2, me), 0);
});

test('more unread than loaded history puts the divider at the top', () => {
  assert.equal(firstUnreadIndex(messages, 50, me), 0);
});
