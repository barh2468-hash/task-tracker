import { useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { draftKey } from './draftStore.js';
import { createDraftSession } from './draftSession.js';

export default function useFormDraft({ userId, formId, initialValue, enabled = true }) {
  const key = draftKey(userId, formId);
  // Defaults are a snapshot for this form/user, not a background-refreshed form.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const session = useMemo(() => createDraftSession({ key, initialValue }), [key]);
  const state = useSyncExternalStore(session.subscribe, session.getSnapshot);
  const defaultsRef = useRef(initialValue);
  useEffect(() => { defaultsRef.current = initialValue; }, [initialValue]);
  useEffect(() => {
    if (!enabled) return;
    void session.start(defaultsRef.current);
    return () => session.stop();
  }, [session, enabled]);
  useEffect(() => {
    const warnIfUnsaved = (event) => {
      const latest = session.getSnapshot();
      if (!latest.hasDraft || !['saving', 'error'].includes(latest.status)) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warnIfUnsaved);
    return () => window.removeEventListener('beforeunload', warnIfUnsaved);
  }, [session]);
  return {
    ...state,
    ready: Boolean(key && enabled && state.status !== 'loading' && !state.recovery),
    setValue: session.update,
    resume: session.resume,
    clear: session.clear,
  };
}
