import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useAuth } from '../auth/useAuth.js';
import { useRealtimeRefresh } from '../../hooks/useRealtimeRefresh.js';
import * as notificationsFeatureApi from './api.js';
import { useMessage } from '../../context/MessageContext.jsx';
import { t } from '../language/LanguageContext.jsx';
import { useNotificationPreferences } from './useNotificationPreferences.js';

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
  const notificationPreferences = useNotificationPreferences(userId);
  const includeGpr = profile?.role === 'admin';
  const userRef = useRef(userId);
  userRef.current = userId;
  const requestRef = useRef(0);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [gprUnread, setGprUnread] = useState([]);
  const [dismissedGpr, setDismissedGpr] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const limitRef = useRef(80);
  const mutationRef = useRef(false);
  const { setMessage } = useMessage();

  const loadNotifications = useCallback(async () => {
    if (!userId) return;
    const request = ++requestRef.current;
    setLoading(true);
    try {
      const snapshot = await notificationsFeatureApi.getNotificationSnapshot(
        userId,
        includeGpr,
        limitRef.current,
      );
      if (userRef.current !== userId || requestRef.current !== request) return;
      setNotifications(snapshot.notifications);
      setUnreadCount((previous) =>
        notificationUnreadCount(snapshot.unreadCount, snapshot.notifications, previous),
      );
      setGprUnread(snapshot.gprUnread);
      setHasMore(snapshot.hasMore);
      setLoadError(false);
    } catch {
      if (userRef.current === userId && requestRef.current === request) setLoadError(true);
    } finally {
      if (userRef.current === userId && requestRef.current === request) setLoading(false);
    }
  }, [userId, includeGpr]);

  useEffect(() => {
    setNotifications([]);
    setUnreadCount(0);
    setGprUnread([]);
    setHasMore(false);
    setLoadError(false);
    limitRef.current = 80;
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

  async function updateReadState(ids, isRead, all = false) {
    if (!userId || mutationRef.current || (!all && !ids.length)) return false;
    mutationRef.current = true;
    setBusy(true);
    try {
      const { data, error } = all
        ? await notificationsFeatureApi.markAllNotificationsRead(userId)
        : await notificationsFeatureApi.setNotificationsRead(ids, isRead, userId);
      if (error || (!all && data?.length !== ids.length))
        throw error || new Error('Incomplete notification update');
      if (userRef.current !== userId) return false;
      // Invalidate any snapshot started before this mutation.
      requestRef.current += 1;
      setNotifications((current) =>
        current.map((item) => (all || ids.includes(item.id) ? { ...item, is_read: isRead } : item)),
      );
      setGprUnread((current) =>
        current.filter((item) => !(isRead && (all || ids.includes(item.id)))),
      );
      const unreadChange = notifications
        .filter((item) => ids.includes(item.id))
        .reduce((total, item) => total + (Number(!isRead) - Number(!item.is_read)), 0);
      setUnreadCount((current) => (all ? 0 : Math.max(0, current + unreadChange)));
      await loadNotifications();
      return true;
    } catch {
      if (userRef.current === userId) {
        setMessage(t('notifications.updateError'), 'error');
        await loadNotifications();
      }
      return false;
    } finally {
      mutationRef.current = false;
      setBusy(false);
    }
  }

  function markNotificationRead(notificationId) {
    return updateReadState([notificationId], true);
  }

  function markAllNotificationsRead() {
    return updateReadState([], true, true);
  }

  function loadMoreNotifications() {
    if (loading || !hasMore) return;
    limitRef.current += 80;
    return loadNotifications();
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
    loading,
    loadError,
    hasMore,
    busy,
    loadMoreNotifications,
    setNotificationsRead: updateReadState,
    ...notificationPreferences,
    gprNotification:
      includeGpr &&
      !notificationPreferences.preferencesLoading &&
      !notificationPreferences.preferencesError &&
      notificationPreferences.preferences.gpr !== false
        ? selectGprAlert(gprUnread, dismissedGpr)
        : null,
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
