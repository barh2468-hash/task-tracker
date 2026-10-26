import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
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
  // Project rooms live apart from personal chats: their own inbox, counts and
  // badges. Unavailable until the project chat migration has been applied.
  const [projectRooms, setProjectRooms] = useState([]);
  const [projectRoomsLoaded, setProjectRoomsLoaded] = useState(false);
  const [projectChatAvailable, setProjectChatAvailable] = useState(true);
  const projectChatAvailableRef = useRef(true);

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

  async function loadProjectRooms() {
    if (!profile || !projectChatAvailableRef.current) return [];
    try {
      const { data, error } = await chatApi.getProjectChatInbox();
      if (error) throw error;
      const next = data || [];
      setProjectRooms(next);
      return next;
    } catch (error) {
      // A missing function means the migration is not applied: stop asking
      // until the next page load. Other errors keep the last known rooms.
      if (error?.code === 'PGRST202') {
        projectChatAvailableRef.current = false;
        setProjectChatAvailable(false);
        setProjectRooms([]);
      } else {
        console.warn('Project chat load failed:', error instanceof Error ? error.message : error);
      }
      return [];
    } finally {
      setProjectRoomsLoaded(true);
    }
  }

  function refreshChat() {
    return Promise.all([loadConversations(), loadProjectRooms()]);
  }

  useEffect(() => {
    if (!profile) {
      setConversations([]);
      setProjectRooms([]);
      setProjectRoomsLoaded(false);
      return;
    }
    refreshChat();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  useRealtimeRefresh({
    enabled: Boolean(profile && chatAvailable),
    channelName: 'infrastructure-tracker-chat-list',
    tables: ['chat_conversations', 'chat_members', 'chat_messages'],
    onRefresh: refreshChat,
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

  // Removes a personal chat from the caller's list only; the next message in
  // it brings it back.
  async function hideConversation(conversationId) {
    const { error } = await chatApi.hideChatConversation(conversationId);
    if (error) {
      setMessage(error.message, 'error');
      return false;
    }
    setConversations((items) => items.filter((item) => item.id !== conversationId));
    return true;
  }

  // Returns { conversation_id, muted, member_count } for a project's room,
  // creating it (and syncing its members) on first use.
  async function openProjectConversation(projectId) {
    const { data, error } = await chatApi.getProjectConversation(projectId);
    if (error) throw error;
    return data;
  }

  async function setConversationMuted(conversationId, muted) {
    if (!profile) return false;
    const { error } = await chatApi.setChatConversationMuted(conversationId, profile.id, muted);
    if (error) {
      setMessage(error.message, 'error');
      return false;
    }
    setProjectRooms((items) =>
      items.map((item) => (item.conversation_id === conversationId ? { ...item, muted } : item)),
    );
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
    await refreshChat();
    return data;
  }

  async function markConversationRead(conversationId, readAt) {
    if (!profile) return;
    const { error } = await chatApi.markChatConversationRead(conversationId, profile.id, readAt);
    if (error) return;
    setConversations((items) =>
      items.map((item) => (item.id === conversationId ? { ...item, unread_count: 0 } : item)),
    );
    setProjectRooms((items) =>
      items.map((item) =>
        item.conversation_id === conversationId ? { ...item, unread_count: 0 } : item,
      ),
    );
  }

  const unreadChatCount = useMemo(
    () => conversations.reduce((total, item) => total + Number(item.unread_count || 0), 0),
    [conversations],
  );
  // Muted rooms still show their own count on the project, but stay out of
  // the totals.
  const unreadProjectChatCount = useMemo(
    () =>
      projectRooms.reduce(
        (total, item) => total + (item.muted ? 0 : Number(item.unread_count || 0)),
        0,
      ),
    [projectRooms],
  );
  const projectRoomsByProjectId = useMemo(
    () => new Map(projectRooms.map((item) => [item.project_id, item])),
    [projectRooms],
  );

  useEffect(() => {
    if (!('setAppBadge' in navigator) || !('clearAppBadge' in navigator)) return;
    const count = unreadChatCount + unreadProjectChatCount + unreadNotificationCount;
    const updateBadge = async () => {
      try {
        if (profile && count > 0) await navigator.setAppBadge(Math.min(count, 99));
        else await navigator.clearAppBadge();
      } catch (error) {
        console.warn('App badge update failed:', error.message);
      }
    };
    void updateBadge();
  }, [profile, unreadChatCount, unreadProjectChatCount, unreadNotificationCount]);

  const value = {
    conversations,
    chatAvailable,
    chatLoading,
    unreadChatCount,
    projectRooms,
    projectRoomsLoaded,
    projectChatAvailable,
    projectRoomsByProjectId,
    unreadProjectChatCount,
    loadConversations,
    createConversation,
    deleteConversation,
    hideConversation,
    openProjectConversation,
    setConversationMuted,
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
