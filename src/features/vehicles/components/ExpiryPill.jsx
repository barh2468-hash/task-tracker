import { t } from '../../language/LanguageContext.jsx';
import { daysUntil, formatDate } from '../utils/vehicleStatus.js';

const LEVEL_CLASS = { ok: 'done', soon: 'field', expired: 'permits', missing: 'neutral' };

export default function ExpiryPill({ level, validTo }) {
  const days = daysUntil(validTo);
  let label;
  if (level === 'missing') label = t('לא הוזן');
  else if (level === 'expired') label = `${t('פג תוקף')} · ${formatDate(validTo)}`;
  else if (level === 'soon') label = `${t('נותרו')} ${days} ${t('ימים')} · ${formatDate(validTo)}`;
  else label = formatDate(validTo);
  return <span className={`pill ${LEVEL_CLASS[level] || 'done'}`}>{label}</span>;
}
