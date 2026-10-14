import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../auth/useAuth.js';
import { useMessage } from '../../context/MessageContext.jsx';
import { useRealtimeRefresh } from '../../hooks/useRealtimeRefresh.js';
import * as chatApi from '../../services/api/chat.js';
import { useNotifications } from '../notifications/NotificationsContext.jsx';

const ChatContext = createContext(null);

export function ChatProvider({ children }) {
  const { profile } = useAuth();
  const { setMessage } = useMessage();
  const { unreadCount: unreadNotificationCount } = useNotifications();
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
      setMessage(error.message, 'error');
      return null;
    }
    setChatAvailable(true);
    await loadConversations();
    return data;
  }

  async function deleteConversation(conversationId) {
    const { error } = await chatApi.deleteChatConversation(conversationId);
    if (error) {
      setMessage(error.message, 'error');
      return false;
    }
    setConversations((items) => items.filter((item) => item.id !== conversationId));
    return true;
  }

  async function getMessages(conversationId) {
    const { data, error } = await chatApi.getChatMessages(conversationId);
    if (error) throw error;
    return data || [];
  }

  async function sendMessage(conversationId, body, project = null) {
    const text = body.trim();
    if ((!text && !project?.id) || !profile) return null;
    const messageBody = text || `הפניה לפרויקט: ${project.label}`;
    const { data, error } = await chatApi.insertChatMessage(
      conversationId,
      profile.id,
      messageBody,
      project,
    );
    if (error) {
      setMessage(error.message, 'error');
      return null;
    }
    // Push delivery must never turn a saved message into a failed send or retry.
    void chatApi
      .notifyChatMessage(data.id)
      .then(({ error: pushError }) => {
        if (pushError) console.warn('Chat push failed:', pushError.message);
      })
      .catch((pushError) => console.warn('Chat push failed:', pushError.message));
    await loadConversations();
    return data;
  }

  async function markConversationRead(conversationId, readAt) {
    if (!profile) return;
    const { error } = await chatApi.markChatConversationRead(conversationId, profile.id, readAt);
    if (error) return;
    setConversations((items) =>
      items.map((item) => (item.id === conversationId ? { ...item, unread_count: 0 } : item)),
    );
  }

  const unreadChatCount = useMemo(
    () => conversations.reduce((total, item) => total + Number(item.unread_count || 0), 0),
    [conversations],
  );

  useEffect(() => {
    if (!('setAppBadge' in navigator) || !('clearAppBadge' in navigator)) return;
    const count = unreadChatCount + unreadNotificationCount;
    const updateBadge = async () => {
      try {
        if (profile && count > 0) await navigator.setAppBadge(Math.min(count, 99));
        else await navigator.clearAppBadge();
      } catch (error) {
        console.warn('App badge update failed:', error.message);
      }
    };
    void updateBadge();
  }, [profile, unreadChatCount, unreadNotificationCount]);

  const value = {
    conversations,
    chatAvailable,
    chatLoading,
    unreadChatCount,
    loadConversations,
    createConversation,
    deleteConversation,
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
