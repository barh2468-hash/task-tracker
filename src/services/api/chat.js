import { supabase } from '../supabase.js';
import { sendPushNotification } from './edgeFunctions.js';

export function notifyChatMessage(messageId) {
  return sendPushNotification({ chatMessageId: messageId });
}

export function getChatConversations() {
  return supabase.rpc('get_chat_conversations');
}

export function createChatConversation(memberIds, title) {
  return supabase.rpc('create_chat_conversation', {
    p_member_ids: memberIds,
    p_title: title?.trim() || null,
  });
}

export function deleteChatConversation(conversationId) {
  return supabase.rpc('delete_chat_conversation', {
    p_conversation_id: conversationId,
  });
}

export function hideChatConversation(conversationId) {
  return supabase.rpc('hide_chat_conversation', {
    p_conversation_id: conversationId,
  });
}

export async function getChatMessages(conversationId) {
  const result = await supabase
    .from('chat_messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(300);
  return { ...result, data: result.data ? [...result.data].reverse() : null };
}

export function insertChatMessage(conversationId, senderId, body, project) {
  return supabase
    .from('chat_messages')
    .insert({
      conversation_id: conversationId,
      sender_id: senderId,
      body: body.trim(),
      project_id: project?.id || null,
      project_label: project?.label || null,
    })
    .select('*')
    .single();
}

export function getProjectChatInbox() {
  return supabase.rpc('get_project_chat_inbox');
}

export async function getProjectConversation(projectId) {
  const result = await supabase.rpc('get_project_conversation', { p_project_id: projectId });
  return { ...result, data: result.data?.[0] || null };
}

export function setChatConversationMuted(conversationId, userId, muted) {
  return supabase
    .from('chat_members')
    .update({ muted })
    .eq('conversation_id', conversationId)
    .eq('user_id', userId);
}

export function markChatConversationRead(
  conversationId,
  userId,
  readAt = new Date().toISOString(),
) {
  return supabase
    .from('chat_members')
    .update({ last_read_at: readAt })
    .eq('conversation_id', conversationId)
    .eq('user_id', userId)
    .or(`last_read_at.is.null,last_read_at.lt.${readAt}`);
}
