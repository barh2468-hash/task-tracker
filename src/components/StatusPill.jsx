import { REVIEW_STATUS } from '../services/supabase.js';

export function getStatusClass(status) {
  if (status === REVIEW_STATUS) return 'review';
  if (status === 'הושלם') return 'done';
  if (status === 'עבר לשרטוט') return 'drafting';
  if (status === 'נדרש GPR') return 'gpr';
  if (status === 'מחכה להיתרים') return 'permits';
  return 'field';
}

export default function StatusPill({ status }) {
  return <span className={`pill ${getStatusClass(status)}`}>{status}</span>;
}
