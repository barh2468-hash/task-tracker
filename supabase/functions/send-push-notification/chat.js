// Only a newly saved message from the authenticated sender can trigger a push.
// Content and recipients come from the database, never from browser input.
export async function resolveChatNotification(client, senderId, messageId, now = Date.now()) {
  const { data: message, error } = await client
    .from('chat_messages')
    .select('id,conversation_id,sender_id,body,created_at')
    .eq('id', messageId)
    .single();
  if (error) throw error;
  const age = now - Date.parse(message.created_at);
  // Allow a little clock skew between Postgres and the edge runtime.
  if (message.sender_id !== senderId || !Number.isFinite(age) || age < -30000 || age > 120000) {
    throw new Error('Only your recent messages can trigger chat notifications');
  }
  const { data: members, error: memberError } = await client
    .from('chat_members')
    .select('user_id,last_read_at')
    .eq('conversation_id', message.conversation_id);
  if (memberError) throw memberError;
  if (!members?.some((member) => member.user_id === senderId))
    throw new Error('Conversation access denied');

  const recipientIds = members
    .filter(
      (member) =>
        member.user_id !== senderId &&
        (!member.last_read_at || Date.parse(member.last_read_at) < Date.parse(message.created_at)),
    )
    .map((member) => member.user_id);
  const { data: sender, error: senderError } = await client
    .from('profiles')
    .select('full_name')
    .eq('id', senderId)
    .single();
  if (senderError) throw senderError;
  const { data: conversation, error: conversationError } = await client
    .from('chat_conversations')
    .select('title')
    .eq('id', message.conversation_id)
    .single();
  if (conversationError) throw conversationError;
  return {
    recipientIds,
    title:
      `${sender.full_name || 'MAYA'}${conversation.title ? ` · ${conversation.title}` : ''}`.slice(
        0,
        180,
      ),
    body: message.body.slice(0, 1000),
    url: `/app/chat?conversation=${encodeURIComponent(message.conversation_id)}`,
    tag: `chat-${message.conversation_id}`,
  };
}

export async function unreadChatCount(client, userId) {
  const { data: members, error } = await client
    .from('chat_members')
    .select('conversation_id,last_read_at')
    .eq('user_id', userId);
  if (error) throw error;
  const counts = await Promise.all(
    (members || []).map(async (member) => {
      let query = client
        .from('chat_messages')
        .select('id', { count: 'exact', head: true })
        .eq('conversation_id', member.conversation_id)
        .neq('sender_id', userId);
      if (member.last_read_at) query = query.gt('created_at', member.last_read_at);
      const { count, error: countError } = await query;
      if (countError) throw countError;
      return count || 0;
    }),
  );
  return counts.reduce((total, count) => total + count, 0);
}
