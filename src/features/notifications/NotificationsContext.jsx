import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useAuth } from '../auth/useAuth.js';
import { useRealtimeRefresh } from '../../hooks/useRealtimeRefresh.js';
import * as notificationsFeatureApi from './api.js';

import { NotificationsContext } from './context.js';
import {
  notificationUnreadCount,
  readDismissedGpr,
  selectGprAlert,
  writeDismissedGpr,
} from './gprAlerts.js';

export function NotificationsProvider({ children }) {
  const { profile } = useAuth();
  const userId = profile?.id;
  const includeGpr = profile?.role === 'admin';
  const userRef = useRef(userId);
  userRef.current = userId;
  const requestRef = useRef(0);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [gprUnread, setGprUnread] = useState([]);
  const [dismissedGpr, setDismissedGpr] = useState([]);

  const loadNotifications = useCallback(async () => {
    if (!userId) return;
    const request = ++requestRef.current;
    const snapshot = await notificationsFeatureApi.getNotificationSnapshot(userId, includeGpr);
    if (userRef.current !== userId || requestRef.current !== request) return;
    setNotifications(snapshot.notifications);
    setUnreadCount((previous) =>
      notificationUnreadCount(snapshot.unreadCount, snapshot.notifications, previous),
    );
    setGprUnread(snapshot.gprUnread);
  }, [userId, includeGpr]);

  useEffect(() => {
    setNotifications([]);
    setUnreadCount(0);
    setGprUnread([]);
    setDismissedGpr(userId ? readDismissedGpr(window.sessionStorage, userId) : []);
    if (userId) void loadNotifications().catch(() => console.warn('Notification refresh failed'));
  }, [userId, loadNotifications]);

  useRealtimeRefresh({
    enabled: Boolean(userId),
    channelName: `infrastructure-tracker-notifications-${userId}`,
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

  function dismissGprAlert(id) {
    setDismissedGpr((current) => {
      const next = current.includes(id) ? current : [...current, id].slice(-1000);
      writeDismissedGpr(window.sessionStorage, userId, next);
      return next;
    });
  }

  const value = {
    notifications,
    unreadCount,
    loadNotifications,
    gprNotification: includeGpr ? selectGprAlert(gprUnread, dismissedGpr) : null,
    dismissGprAlert,
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
