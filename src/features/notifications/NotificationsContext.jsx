import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../auth/useAuth.js';
import { supabase } from '../../services/supabase.js';
import * as notificationsFeatureApi from './api.js';

const NotificationsContext = createContext(null);

export function NotificationsProvider({ children }) {
  const { profile } = useAuth();
  const [notifications, setNotifications] = useState([]);

  async function loadNotifications() {
    setNotifications(await notificationsFeatureApi.getNotifications());
  }

  useEffect(() => {
    if (!profile) {
      setNotifications([]);
      return;
    }
    loadNotifications();
  }, [profile]);

  useEffect(() => {
    if (!profile) return;
    const channel = supabase
      .channel('infrastructure-tracker-notifications')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, () => loadNotifications())
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [profile]);

  async function markNotificationRead(notificationId) {
    await notificationsFeatureApi.markNotificationRead(notificationId);
    await loadNotifications();
  }

  async function markAllNotificationsRead() {
    await notificationsFeatureApi.markAllNotificationsRead();
    await loadNotifications();
  }

  const unreadCount = useMemo(() => notifications.filter((n) => !n.is_read).length, [notifications]);

  const value = {
    notifications,
    unreadCount,
    loadNotifications,
    markNotificationRead,
    markAllNotificationsRead,
  };

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

export function useNotifications() {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error('useNotifications must be used within a NotificationsProvider');
  return ctx;
}
