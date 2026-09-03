import { useEffect, useRef } from 'react';
import { supabase } from '../services/supabase.js';

const RECONNECT_STATUSES = new Set(['CHANNEL_ERROR', 'TIMED_OUT']);

export function useRealtimeRefresh({
  enabled,
  channelName,
  tables,
  onRefresh,
  debounceMs = 350,
  pollIntervalMs = 30000,
}) {
  const refreshRef = useRef(onRefresh);
  refreshRef.current = onRefresh;
  const tableKey = tables.join(',');

  useEffect(() => {
    if (!enabled) return undefined;

    let stopped = false;
    let channel = null;
    let refreshTimer = null;
    let reconnectTimer = null;
    let reconnectAttempt = 0;

    const refresh = (delay = debounceMs) => {
      window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(() => {
        Promise.resolve(refreshRef.current()).catch((error) => {
          console.warn(`${channelName} refresh failed:`, error instanceof Error ? error.message : error);
        });
      }, delay);
    };

    const connect = () => {
      if (stopped) return;

      const nextChannel = supabase.channel(`${channelName}-${Date.now()}`);
      tableKey.split(',').filter(Boolean).forEach((table) => {
        nextChannel.on('postgres_changes', { event: '*', schema: 'public', table }, () => refresh());
      });

      channel = nextChannel.subscribe((status, error) => {
        if (status === 'SUBSCRIBED') {
          reconnectAttempt = 0;
          return;
        }
        if (!RECONNECT_STATUSES.has(status) || stopped || reconnectTimer) return;

        console.warn(`${channelName} realtime ${status.toLowerCase()}:`, error?.message || 'reconnecting');
        reconnectAttempt += 1;
        const waitMs = Math.min(15000, 1000 * (2 ** Math.min(reconnectAttempt, 4)));
        reconnectTimer = window.setTimeout(async () => {
          reconnectTimer = null;
          const staleChannel = channel;
          channel = null;
          if (staleChannel) await supabase.removeChannel(staleChannel);
          connect();
          refresh(0);
        }, waitMs);
      });
    };

    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') refresh(0);
    };
    const refreshWhenOnline = () => refresh(0);

    connect();
    const pollTimer = window.setInterval(refreshWhenVisible, pollIntervalMs);
    document.addEventListener('visibilitychange', refreshWhenVisible);
    window.addEventListener('focus', refreshWhenVisible);
    window.addEventListener('online', refreshWhenOnline);

    return () => {
      stopped = true;
      window.clearTimeout(refreshTimer);
      window.clearTimeout(reconnectTimer);
      window.clearInterval(pollTimer);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
      window.removeEventListener('focus', refreshWhenVisible);
      window.removeEventListener('online', refreshWhenOnline);
      if (channel) supabase.removeChannel(channel);
    };
  }, [enabled, channelName, tableKey, debounceMs, pollIntervalMs]);
}
