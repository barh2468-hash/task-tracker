import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../auth/useAuth.js';
import { useMessage } from '../../context/MessageContext.jsx';
import { useRealtimeRefresh } from '../../hooks/useRealtimeRefresh.js';
import * as chatApi from '../../services/api/chat.js';

const ChatContext = createContext(null);

export function ChatProvider({ children }) {
  const { profile } = useAuth();
  const { setMessage } = useMessage();
  const [conversations, setConversations] = useState([]);
  const [chatAvailable, setChatAvailable] = useState(true);
  const [chatLoading, setChatLoading] = useState(false);

  async function loadConversations() {
    if (!profile) return [];
    setChatLoading(true);
    try {
      const { data, error } = await chatApi.getChatConversations();
      if (error) throw error;
      const next = data || [];
      setChatAvailable(true);
      setConversations(next);
      return next;
    } catch (error) {
      console.warn('Chat load failed:', error instanceof Error ? error.message : error);
      setChatAvailable(false);
      setConversations([]);
      return [];
    } finally {
      setChatLoading(false);
    }
  }

  useEffect(() => {
    if (!profile) {
      setConversations([]);
      return;
    }
    loadConversations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  useRealtimeRefresh({
    enabled: Boolean(profile && chatAvailable),
    channelName: 'infrastructure-tracker-chat-list',
    tables: ['chat_conversations', 'chat_members', 'chat_messages'],
    onRefresh: loadConversations,
    pollIntervalMs: 10000,
  });

  async function createConversation(memberIds, title) {
    const { data, error } = await chatApi.createChatConversation(memberIds, title);
    if (error) {
      setMessage(error.message);
      return null;
    }
    setChatAvailable(true);
    await loadConversations();
    return data;
  }

  async function getMessages(conversationId) {
    const { data, error } = await chatApi.getChatMessages(conversationId);
    if (error) throw error;
    return data || [];
  }

  async function sendMessage(conversationId, body) {
    const text = body.trim();
    if (!text || !profile) return null;
    const { data, error } = await chatApi.insertChatMessage(conversationId, profile.id, text);
    if (error) {
      setMessage(error.message);
      return null;
    }
    await loadConversations();
    return data;
  }

  async function markConversationRead(conversationId) {
    if (!profile) return;
    const { error } = await chatApi.markChatConversationRead(conversationId, profile.id);
    if (error) return;
    setConversations((items) =>
      items.map((item) => (item.id === conversationId ? { ...item, unread_count: 0 } : item)),
    );
  }

  const unreadChatCount = useMemo(
    () => conversations.reduce((total, item) => total + Number(item.unread_count || 0), 0),
    [conversations],
  );

  const value = {
    conversations,
    chatAvailable,
    chatLoading,
    unreadChatCount,
    loadConversations,
    createConversation,
    getMessages,
    sendMessage,
    markConversationRead,
  };

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChat() {
  const context = useContext(ChatContext);
  if (!context) throw new Error('useChat must be used inside ChatProvider');
  return context;
}
