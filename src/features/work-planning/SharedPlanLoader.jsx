import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { t } from '../language/LanguageContext.jsx';
import { loadPublication, publishPlan } from './publishedPlans.js';
import { supabase } from '../../services/supabase.js';

export default function SharedPlanLoader({ date, storageScope, children }) {
  useTranslation();
  const [state, setState] = useState({ loading: true, record: null, error: false });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    loadPublication(date, supabase).then((record) => {
      if (active) setState({ loading: false, record, error: false });
    }).catch(() => {
      if (active) setState({ loading: false, record: null, error: true });
    });
    return () => { active = false; };
  }, [date, attempt]);

  if (state.loading) return <p role="status">{t('workPlan.loading')}</p>;
  if (state.error) return <div className="workPlanError" role="alert"><p>{t('workPlan.sharedLoadError')}</p>
    <button type="button" onClick={() => { setState({ loading: true, record: null, error: false }); setAttempt((value) => value + 1); }}>{t('workPlan.reload')}</button>
  </div>;

  async function publish(rows, rosterNames) {
    const record = await publishPlan({ date, rows, rosterNames, userId: storageScope, version: state.record?.version }, supabase);
    setState({ loading: false, record, error: false });
  }

  return children({ record: state.record, publish });
}
