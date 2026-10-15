import { draftStore } from './draftStore.js';

// Restore known fields only; changes to a form's schema keep their defaults.
function restoreValue(value, defaults) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const restored = { ...defaults };
  for (const [key, fallback] of Object.entries(defaults)) {
    const candidate = value[key];
    if (Array.isArray(fallback)) {
      if (Array.isArray(candidate) && candidate.every((item) => typeof item === 'string')) restored[key] = candidate;
    } else if (fallback === null) {
      if (candidate === null || typeof candidate === 'string' || (typeof Blob !== 'undefined' && candidate instanceof Blob)) restored[key] = candidate;
    } else if (typeof fallback === 'object') {
      restored[key] = restoreValue(candidate, fallback) || fallback;
    } else if (typeof candidate === typeof fallback) {
      restored[key] = candidate;
    }
  }
  return restored;
}

export function createDraftSession({ key, initialValue, store = draftStore }) {
  let defaults = initialValue;
  let state = { value: initialValue, recovery: null, status: 'loading', savedAt: null, hasDraft: false };
  let revision = 0;
  let generation = 0;
  const listeners = new Set();
  function publish(changes) {
    state = { ...state, ...changes };
    listeners.forEach((listener) => listener());
  }
  return {
    getSnapshot: () => state,
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    async start(nextDefaults = initialValue) {
      defaults = nextDefaults;
      const current = ++generation;
      revision++;
      publish({ value: defaults, recovery: null, status: 'loading', hasDraft: false, savedAt: null });
      try {
        const row = key ? await store.read(key) : null;
        if (current !== generation) return;
        const value = row?.version === 1 ? restoreValue(row.value, defaults) : null;
        publish({ recovery: value ? { value, updatedAt: row.updatedAt } : null, status: 'idle', hasDraft: Boolean(value) });
      } catch {
        if (current === generation) publish({ status: 'error' });
      }
    },
    stop() { generation++; },
    resume() {
      if (!state.recovery) return;
      publish({ value: state.recovery.value, savedAt: state.recovery.updatedAt, recovery: null, status: 'saved' });
    },
    update(next) {
      if (state.status === 'loading' || state.recovery || !key) return;
      const value = typeof next === 'function' ? next(state.value) : next;
      const current = ++revision;
      publish({ value, hasDraft: true, status: 'saving' });
      return store.write(key, value).then(() => {
        if (current === revision) publish({ status: 'saved', savedAt: Date.now() });
      }).catch(() => {
        if (current === revision) publish({ status: 'error' });
      });
    },
    async clear() {
      const current = ++revision;
      try {
        if (key) await store.remove(key);
        if (current === revision) publish({ value: defaults, recovery: null, hasDraft: false, status: 'idle', savedAt: null });
        return true;
      } catch {
        if (current === revision) publish({ status: 'error' });
        return false;
      }
    },
  };
}
