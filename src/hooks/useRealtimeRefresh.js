import { useEffect, useRef } from 'react';
import { supabase } from '../services/supabase.js';
import { startRealtimeRefresh } from './realtimeRefresh.js';

export function useRealtimeRefresh({
  enabled,
  channelName,
  tables,
  onRefresh,
  debounceMs = 350,
  pollIntervalMs = 30000,
  safetyIntervalMs = 300000,
}) {
  const refreshRef = useRef(onRefresh);
  refreshRef.current = onRefresh;
  const tableKey = tables.join(',');

  useEffect(() => {
    if (!enabled) return undefined;

    return startRealtimeRefresh({
      client: supabase, channelName, tables: tableKey.split(',').filter(Boolean),
      onRefresh: () => refreshRef.current(), debounceMs, pollIntervalMs, safetyIntervalMs,
    });
  }, [enabled, channelName, tableKey, debounceMs, pollIntervalMs, safetyIntervalMs]);
}
