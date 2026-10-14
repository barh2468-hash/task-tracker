import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveChatNotification, unreadChatCount } from './chat.js';

const now = Date.parse('2026-10-14T10:00:00Z');
const message = { id: 'message', conversation_id: 'room', sender_id: 'sender', body: 'Private message', created_at: '2026-10-14T09:59:30Z' };
const members = [
  { conversation_id: 'room', user_id: 'sender', last_read_at: null },
  { conversation_id: 'room', user_id: 'recipient', last_read_at: '2026-10-14T09:00:00Z' },
  { conversation_id: 'room', user_id: 'new-member', last_read_at: null },
  { conversation_id: 'room', user_id: 'already-read', last_read_at: message.created_at },
];

function client(rows = {}) {
  const tables = {
    chat_messages: [message], chat_members: members,
    profiles: [{ id: 'sender', full_name: 'Sender Name' }],
    chat_conversations: [{ id: 'room', title: 'Team' }], ...rows,
  };
  return {
    from(table) {
      let result = tables[table];
      let countOnly = false;
      const query = {
        select(_columns, options) { countOnly = Boolean(options?.head); return query; },
        eq(key, value) { result = result.filter((row) => row[key] === value); return query; },
        neq(key, value) { result = result.filter((row) => row[key] !== value); return query; },
        gt(key, value) { result = result.filter((row) => row[key] > value); return query; },
        async single() { return { data: result[0], error: result.length === 1 ? null : new Error('Not found') }; },
        then(resolve) { return Promise.resolve({ data: countOnly ? null : result, count: result.length }).then(resolve); },
      };
      return query;
    },
  };
}

test('private chat push reaches only other members who have not read the message', async () => {
  const result = await resolveChatNotification(client(), 'sender', 'message', now);
  assert.deepEqual(result.recipientIds, ['recipient', 'new-member']);
  assert.equal(result.title, 'Sender Name · Team');
  assert.equal(result.body, message.body);
  assert.equal(result.url, '/app/chat?conversation=room');
  assert.equal(result.tag, 'chat-room');
});

test('another user cannot use a private message to send notifications', async () => {
  await assert.rejects(resolveChatNotification(client(), 'outsider', 'message', now), /Only your recent messages/);
});

test('a sender removed from a conversation cannot notify its current members', async () => {
  await assert.rejects(resolveChatNotification(client({ chat_members: members.slice(1) }), 'sender', 'message', now), /access denied/);
});

test('old messages and invalid timestamps cannot be replayed', async () => {
  for (const created_at of ['2026-10-14T09:57:59Z', 'invalid', '2026-10-14T10:01:00Z']) {
    await assert.rejects(resolveChatNotification(client({ chat_messages: [{ ...message, created_at }] }), 'sender', 'message', now), /Only your recent messages/);
  }
});

test('small database and edge clock differences do not block a newly saved message', async () => {
  const result = await resolveChatNotification(client({ chat_messages: [{ ...message, created_at: '2026-10-14T10:00:15Z' }] }), 'sender', 'message', now);
  assert.ok(result.recipientIds.includes('recipient'));
});

test('a read conversation produces no recipients; direct chat title uses sender name', async () => {
  const result = await resolveChatNotification(client({ chat_members: [members[0], members[3]], chat_conversations: [{ id: 'room', title: null }] }), 'sender', 'message', now);
  assert.deepEqual(result.recipientIds, []);
  assert.equal(result.title, 'Sender Name');
});

test('badge count includes only unread incoming messages across the recipient conversations', async () => {
  const result = await unreadChatCount(client({
    chat_members: [
      { user_id: 'recipient', conversation_id: 'room', last_read_at: '2026-10-14T09:00:00Z' },
      { user_id: 'recipient', conversation_id: 'second', last_read_at: null },
      { user_id: 'outsider', conversation_id: 'private', last_read_at: null },
    ],
    chat_messages: [message,
      { conversation_id: 'room', sender_id: 'recipient', created_at: message.created_at },
      { conversation_id: 'room', sender_id: 'sender', created_at: '2026-10-14T08:59:00Z' },
      { conversation_id: 'second', sender_id: 'sender', created_at: message.created_at },
      { conversation_id: 'private', sender_id: 'sender', created_at: message.created_at },
    ],
  }), 'recipient');
  assert.equal(result, 2);
  assert.equal(await unreadChatCount(client({ chat_members: [] }), 'recipient'), 0);
});
