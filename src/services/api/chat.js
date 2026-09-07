import { supabase } from '../supabase.js';

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

export function getChatMessages(conversationId) {
  return supabase
    .from('chat_messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
    .limit(300);
}

export function insertChatMessage(conversationId, senderId, body) {
  return supabase
    .from('chat_messages')
    .insert({ conversation_id: conversationId, sender_id: senderId, body: body.trim() })
    .select('*')
    .single();
}

export function markChatConversationRead(conversationId, userId) {
  return supabase
    .from('chat_members')
    .update({ last_read_at: new Date().toISOString() })
    .eq('conversation_id', conversationId)
    .eq('user_id', userId);
}
