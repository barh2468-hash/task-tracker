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
    chat_conversations: [{ id: 'room', title: 'Team' }],
    projects: [{ id: 'project', name: 'WBO-253' }], ...rows,
  };
  return {
    rpcCalls: [],
    async rpc(name, args) {
      this.rpcCalls.push([name, args]);
      return { data: rows.rpcResult ?? 0, error: null };
    },
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

test('muted members receive no push', async () => {
  const result = await resolveChatNotification(client({ chat_members: [members[0], { ...members[1], muted: true }, members[2]] }), 'sender', 'message', now);
  assert.deepEqual(result.recipientIds, ['new-member']);
});

test('project activity events cannot trigger a push', async () => {
  await assert.rejects(resolveChatNotification(client({ chat_messages: [{ ...message, kind: 'event' }] }), 'sender', 'message', now), /Only your recent messages/);
});

test('project room push is titled with the project and opens its discussion tab', async () => {
  const result = await resolveChatNotification(client({ chat_messages: [{ ...message, kind: 'message' }], chat_conversations: [{ id: 'room', title: null, project_id: 'project' }] }), 'sender', 'message', now);
  assert.equal(result.title, 'Sender Name · WBO-253');
  assert.equal(result.url, '/app/projects?project=project&tab=discussion');
  assert.equal(result.tag, 'chat-room');
});

test('badge count comes from one database call for the recipient', async () => {
  const db = client({ rpcResult: 7 });
  assert.equal(await unreadChatCount(db, 'recipient'), 7);
  assert.deepEqual(db.rpcCalls, [['chat_unread_count_for', { p_user_id: 'recipient' }]]);
  assert.equal(await unreadChatCount(client(), 'recipient'), 0);
});
