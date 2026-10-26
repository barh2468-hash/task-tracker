// Only a newly saved message from the authenticated sender can trigger a push.
// Content and recipients come from the database, never from browser input.
// Project activity events and muted members never receive a push.
export async function resolveChatNotification(client, senderId, messageId, now = Date.now()) {
  const { data: message, error } = await client
    .from('chat_messages')
    .select('id,conversation_id,sender_id,body,created_at,kind')
    .eq('id', messageId)
    .single();
  if (error) throw error;
  const age = now - Date.parse(message.created_at);
  // Allow a little clock skew between Postgres and the edge runtime.
  if (
    message.sender_id !== senderId ||
    (message.kind && message.kind !== 'message') ||
    !Number.isFinite(age) ||
    age < -30000 ||
    age > 120000
  ) {
    throw new Error('Only your recent messages can trigger chat notifications');
  }
  const { data: members, error: memberError } = await client
    .from('chat_members')
    .select('user_id,last_read_at,muted')
    .eq('conversation_id', message.conversation_id);
  if (memberError) throw memberError;
  if (!members?.some((member) => member.user_id === senderId))
    throw new Error('Conversation access denied');

  const recipientIds = members
    .filter(
      (member) =>
        member.user_id !== senderId &&
        !member.muted &&
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
    .select('title,project_id')
    .eq('id', message.conversation_id)
    .single();
  if (conversationError) throw conversationError;

  let roomName = conversation.title;
  let url = `/app/chat?conversation=${encodeURIComponent(message.conversation_id)}`;
  if (conversation.project_id) {
    const { data: project, error: projectError } = await client
      .from('projects')
      .select('name')
      .eq('id', conversation.project_id)
      .single();
    if (projectError) throw projectError;
    roomName = project.name;
    url = `/app/projects?project=${encodeURIComponent(conversation.project_id)}&tab=discussion`;
  }
  return {
    recipientIds,
    title: `${sender.full_name || 'MAYA'}${roomName ? ` · ${roomName}` : ''}`.slice(0, 180),
    body: message.body.slice(0, 1000),
    url,
    tag: `chat-${message.conversation_id}`,
  };
}

// Unread people-written messages across the user's non-muted conversations,
// counted in one database call (managers belong to every project room).
export async function unreadChatCount(client, userId) {
  const { data, error } = await client.rpc('chat_unread_count_for', { p_user_id: userId });
  if (error) throw error;
  return Number(data || 0);
}
