import { useState } from 'react';
import { CheckCircle2, Circle } from 'lucide-react';
import { t } from '../../language/LanguageContext.jsx';
import Button from '../../../components/ui/Button.jsx';
import Card from '../../../components/ui/Card.jsx';
import { formatDate, hasActivePolicy } from '../utils/vehicleStatus.js';

/**
 * The new-vehicle path: details → insurance quote → approval → policy →
 * handover. A vehicle cannot be marked ready for handover or in use until a
 * valid policy exists.
 */
export default function LifecycleCard({ vehicle, quotes, policies, canEdit, onSetStatus, onOpenTab }) {
  const [busy, setBusy] = useState(false);
  const hasQuote = quotes.length > 0;
  const approved = quotes.some((quote) => quote.status === 'approved');
  const pending = quotes.some((quote) => quote.status === 'pending');
  const insured = hasActivePolicy(policies);
  const handover = vehicle.status === 'awaiting_handover';

  const steps = [
    { done: true, label: t('פרטי הרכב הוזנו'), detail: vehicle.expected_arrival ? `${t('הגעה צפויה')} ${formatDate(vehicle.expected_arrival)}` : null },
    { done: hasQuote, label: t('הצעת ביטוח הוגשה'), tab: 'quotes', hint: t('העלאת הצעת מחיר מהסוכן') },
    { done: approved, label: t('ההצעה אושרה'), tab: 'quotes', hint: pending ? t('ממתינה להחלטת מנהל') : null },
    { done: insured, label: t('פוליסה בתוקף הועלתה'), tab: 'insurance', hint: approved ? t('העלאת הפוליסה שהונפקה') : null },
    { done: handover || vehicle.status === 'in_use', label: t('הרכב הגיע ומוכן למסירה') },
  ];
  const next = steps.findIndex((step) => !step.done);

  async function move(status) {
    setBusy(true);
    try {
      await onSetStatus(status);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <h3>{t('תהליך קליטת רכב חדש')}</h3>
      <ol className="muted" style={{ listStyle: 'none', padding: 0, display: 'grid', gap: 8 }}>
        {steps.map((step, index) => (
          <li key={step.label} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {step.done ? <CheckCircle2 size={18} color="#087a36" /> : <Circle size={18} />}
            <span style={{ fontWeight: index === next ? 700 : 400 }}>{step.label}</span>
            {step.detail && <small>{step.detail}</small>}
            {index === next && step.hint && onOpenTab && step.tab && (
              <button type="button" className="ghost tinyBtn" onClick={() => onOpenTab(step.tab)}>{step.hint}</button>
            )}
          </li>
        ))}
      </ol>
      {canEdit && (
        <>
          {!handover && (
            <Button disabled={busy || !insured} onClick={() => move('awaiting_handover')}>
              {t('הרכב הגיע – מוכן למסירה')}
            </Button>
          )}
          {handover && (
            <Button disabled={busy || !insured} onClick={() => move('in_use')}>{t('סימון כנמסר – בשימוש')}</Button>
          )}
          {!insured && <p className="muted">{t('אי אפשר להעביר למסירה לפני שיש פוליסה בתוקף.')}</p>}
        </>
      )}
    </Card>
  );
}
