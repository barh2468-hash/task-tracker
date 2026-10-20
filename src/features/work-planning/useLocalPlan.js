import { useEffect, useRef, useState } from 'react';
import { emptyPlan, readPlan, writePlan } from './localPlans.js';

function load(key, initialRows) {
  try {
    return { plan: readPlan(window.localStorage, key) || emptyPlan(initialRows), error: '', unsaved: false };
  } catch (error) {
    return { plan: emptyPlan(), error: error.code || 'storage', unsaved: false };
  }
}

export default function useLocalPlan(key, initialRows = []) {
  const [state, setState] = useState(() => load(key, initialRows));
  const current = useRef(state);
  function apply(next) { current.current = next; setState(next); }

  function commit(transform, keepDraftOnFailure = false) {
    const previous = current.current;
    const candidate = transform(previous.plan);
    try {
      const plan = writePlan(window.localStorage, key, candidate);
      apply({ plan, error: '', unsaved: false });
      return true;
    } catch (error) {
      apply({
        plan: keepDraftOnFailure ? { ...previous.plan, rows: candidate.rows } : previous.plan,
        error: error.code || 'storage', unsaved: keepDraftOnFailure || previous.unsaved,
      });
      return false;
    }
  }

  useEffect(() => {
    const onStorage = (event) => {
      if (event.key !== key) return;
      if (current.current.unsaved) {
        const next = { ...current.current, error: 'conflict' };
        current.current = next;
        setState(next);
      } else {
        const next = load(key, []);
        current.current = next;
        setState(next);
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [key]);

  useEffect(() => {
    if (!state.unsaved) return;
    const prevent = (event) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', prevent);
    return () => window.removeEventListener('beforeunload', prevent);
  }, [state.unsaved]);

  return {
    ...state,
    updateRows: (update) => commit((plan) => ({ ...plan, rows: update(plan.rows) }), true),
    save: () => commit((plan) => plan),
    publish: () => commit((plan) => ({
      ...plan, publishedRows: structuredClone(plan.rows), publishedAt: new Date().toISOString(),
    })),
    reload: () => apply(load(key, [])),
  };
}
