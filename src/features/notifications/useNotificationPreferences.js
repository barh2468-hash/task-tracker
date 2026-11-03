import { useCallback, useEffect, useRef, useState } from 'react';
import { useRealtimeRefresh } from '../../hooks/useRealtimeRefresh.js';
import {
  getNotificationPreferences,
  saveNotificationPreference,
} from '../../services/api/notifications.js';

export function useNotificationPreferences(userId) {
  const [state, setState] = useState({ owner: null, values: {}, loading: true, error: false });
  const [saving, setSaving] = useState(false);
  const owner = useRef(userId);
  owner.current = userId;
  const request = useRef(0);
  const savingRef = useRef(false);

  const reload = useCallback(async () => {
    if (!userId) return;
    const current = ++request.current;
    try {
      const { data, error } = await getNotificationPreferences(userId);
      if (error) throw error;
      if (owner.current === userId && request.current === current) {
        setState({
          owner: userId,
          values: Object.fromEntries((data || []).map((row) => [row.category, row.enabled])),
          loading: false,
          error: false,
        });
      }
    } catch {
      if (owner.current === userId && request.current === current) {
        setState((previous) => ({ ...previous, owner: userId, loading: false, error: true }));
      }
    }
  }, [userId]);

  useEffect(() => {
    void reload();
  }, [reload]);
  useRealtimeRefresh({
    enabled: Boolean(userId),
    channelName: `notification-preferences-${userId}`,
    tables: ['notification_preferences'],
    onRefresh: reload,
  });

  async function update(category, enabled) {
    if (!userId || savingRef.current || state.owner !== userId || state.loading || state.error)
      return false;
    savingRef.current = true;
    setSaving(true);
    try {
      const { data, error } = await saveNotificationPreference(userId, category, enabled);
      if (error || data?.enabled !== enabled || data?.category !== category)
        throw error || new Error('Preference was not saved');
      if (owner.current !== userId) return false;
      request.current += 1;
      setState((previous) => ({
        ...previous,
        values: { ...previous.values, [category]: enabled },
      }));
      return true;
    } catch {
      return false;
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }
  const current = state.owner === userId ? state : { values: {}, loading: true, error: false };
  return {
    preferences: current.values,
    preferencesLoading: current.loading,
    preferencesError: current.error,
    preferencesSaving: saving,
    updateNotificationPreference: update,
    reloadNotificationPreferences: reload,
  };
}
