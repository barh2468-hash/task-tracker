import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../auth/useAuth.js';
import { useRealtimeRefresh } from '../../hooks/useRealtimeRefresh.js';
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

  useRealtimeRefresh({
    enabled: Boolean(profile),
    channelName: 'infrastructure-tracker-notifications',
    tables: ['notifications'],
    onRefresh: loadNotifications,
    pollIntervalMs: 30000,
  });

  async function markNotificationRead(notificationId) {
    await notificationsFeatureApi.markNotificationRead(notificationId);
    await loadNotifications();
  }

  async function markAllNotificationsRead() {
    await notificationsFeatureApi.markAllNotificationsRead();
    await loadNotifications();
  }

  const unreadCount = useMemo(() => notifications.filter((n) => !n.is_read).length, [notifications]);

  useEffect(() => {
    if (!('setAppBadge' in navigator) || !('clearAppBadge' in navigator)) return;

    const updateBadge = async () => {
      try {
        if (profile && unreadCount > 0) await navigator.setAppBadge(Math.min(unreadCount, 99));
        else await navigator.clearAppBadge();
      } catch (error) {
        // Badging is optional and may be blocked when the app is not installed.
        console.warn('App badge update failed:', error instanceof Error ? error.message : error);
      }
    };

    updateBadge();
  }, [profile, unreadCount]);

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
