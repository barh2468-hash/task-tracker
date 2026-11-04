import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../auth/useAuth.js';
import { cacheOfflineData, getOfflineData } from '../../services/offlineStore.js';
import { listHelpers } from './api.js';

export function useCrewHelpers(enabled) {
  const { profile } = useAuth();
  const [state, setState] = useState({ helpers: [], loading: false, error: false, cached: false });
  const requestRef = useRef(0);
  const reload = useCallback(async () => {
    if (!enabled || !profile?.id) return;
    const request = ++requestRef.current;
    const key = `crew-helpers:${profile.id}`;
    setState((current) => ({ ...current, loading: true, error: false }));
    try {
      const offline = navigator.onLine === false;
      const helpers = offline ? await getOfflineData(key) : await listHelpers({ activeOnly: true });
      if (!Array.isArray(helpers)) throw new Error('Helpers unavailable');
      if (request === requestRef.current) setState({ helpers, loading: false, error: false, cached: offline });
      if (!offline) void cacheOfflineData(key, helpers).catch(() => {});
    } catch {
      if (request === requestRef.current) setState({ helpers: [], loading: false, error: true, cached: false });
    }
  }, [enabled, profile?.id]);
  useEffect(() => {
    if (!enabled) return undefined;
    void reload();
    window.addEventListener('maya-helpers-changed', reload);
    window.addEventListener('online', reload);
    return () => {
      requestRef.current += 1;
      window.removeEventListener('maya-helpers-changed', reload);
      window.removeEventListener('online', reload);
    };
  }, [enabled, reload]);
  return { ...state, reload };
}
