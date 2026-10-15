import { useTranslation } from 'react-i18next';
import { DEFAULT_PROJECT_STATUS, REVIEW_COMPLETED_STATUS, REVIEW_STATUS } from '../services/supabase.js';
import { t } from '../features/language/LanguageContext.jsx';

export function getStatusClass(status) {
  if (status === DEFAULT_PROJECT_STATUS) return 'coordination';
  if (status === REVIEW_STATUS) return 'review';
  if (status === REVIEW_COMPLETED_STATUS) return 'review-complete';
  if (status === 'הושלם') return 'done';
  if (status === 'עבר לשרטוט') return 'drafting';
  if (status === 'נדרש GPR') return 'gpr';
  if (status === 'מחכה להיתרים') return 'permits';
  return 'field';
}

export default function StatusPill({ status }) {
  useTranslation();
  return <span className={`pill ${getStatusClass(status)}`}>{t(status)}</span>;
}
