import { useState } from 'react';
import { Check, Download, Plus, X } from 'lucide-react';
import { t } from '../../language/LanguageContext.jsx';
import { useMessage } from '../../../context/MessageContext.jsx';
import Button from '../../../components/ui/Button.jsx';
import Card from '../../../components/ui/Card.jsx';
import EmptyState from '../../../components/ui/EmptyState.jsx';
import Field from '../../../components/ui/Field.jsx';
import ScanUploader from './ScanUploader.jsx';
import { decideInsuranceQuote, getDocumentUrl, removeInsuranceQuote, submitInsuranceQuote } from '../api.js';
import { formatDate } from '../utils/vehicleStatus.js';

const STATUS = {
  pending: { label: 'ממתינה לאישור', pill: 'field' },
  approved: { label: 'אושרה', pill: 'done' },
  rejected: { label: 'נדחתה', pill: 'permits' },
};

const EMPTY = { agent: '', insurer: '', premium_ils: '', notes: '' };

/**
 * Insurance quotes for a vehicle. Anyone who manages vehicles can submit a
 * quote and any manager can decide it; the first decision closes it and the
 * requester is notified.
 */
export default function QuotesPanel({ vehicle, quotes, documents, canEdit, user, onChanged }) {
  const { setMessage } = useMessage();
  const [form, setForm] = useState({ ...EMPTY, agent: vehicle.insurance_agent || '' });
  const [scan, setScan] = useState(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));
  const docById = new Map(documents.map((document) => [document.id, document]));

  async function run(action, success) {
    setBusy(true);
    try {
      const result = await action();
      if (result === null) setMessage(t('מנהל אחר כבר החליט על ההצעה.'), 'info');
      else if (success) setMessage(success);
      await onChanged();
      return true;
    } catch (error) {
      setMessage(error?.message || t('הפעולה נכשלה.'), 'error');
      return false;
    } finally {
      setBusy(false);
    }
  }

  function applyScan({ scan: uploaded, fields }) {
    setScan(uploaded);
    if (!fields) return;
    setForm((current) => ({
      ...current,
      agent: fields.agent ?? current.agent,
      insurer: fields.insurer ?? current.insurer,
      premium_ils: fields.premium_ils ?? current.premium_ils,
    }));
  }

  async function submit(event) {
    event.preventDefault();
    const ok = await run(
      () => submitInsuranceQuote(vehicle, { ...form, premium_ils: form.premium_ils === '' ? null : Number(form.premium_ils) }, scan, user),
      t('ההצעה נשמרה והמנהלים קיבלו התראה.'),
    );
    if (ok) {
      setForm({ ...EMPTY, agent: vehicle.insurance_agent || '' });
      setScan(null);
    }
  }

  async function open(documentId) {
    const document = docById.get(documentId);
    if (!document) return;
    try {
      window.open(await getDocumentUrl(document), '_blank', 'noopener');
    } catch (error) {
      setMessage(error?.message || t('לא ניתן לפתוח את המסמך.'), 'error');
    }
  }

  const decide = (quote, status) =>
    run(() => decideInsuranceQuote(quote, vehicle, { status, note }, user), status === 'approved' ? t('ההצעה אושרה.') : t('ההצעה נדחתה.'));

  return (
    <Card>
      {quotes.length === 0 ? (
        <EmptyState title={t('לא הוגשו הצעות ביטוח לרכב זה')} />
      ) : (
        <div className="equipmentTableWrap">
          <table className="equipmentTable">
            <thead>
              <tr>
                <th>{t('הוגשה')}</th><th>{t('סוכן / חברה')}</th><th className="num">{t('פרמיה')}</th>
                <th>{t('סטטוס')}</th><th>{t('החלטה')}</th><th />
              </tr>
            </thead>
            <tbody>
              {quotes.map((quote) => (
                <tr key={quote.id}>
                  <td>{formatDate(quote.created_at.slice(0, 10))}<div><small className="muted">{quote.requested_by_name}</small></div></td>
                  <td>{[quote.agent, quote.insurer].filter(Boolean).join(' · ') || '—'}</td>
                  <td className="num">{quote.premium_ils != null ? `${Number(quote.premium_ils).toLocaleString('he-IL')} ₪` : '—'}</td>
                  <td><span className={`pill ${STATUS[quote.status].pill}`}>{t(STATUS[quote.status].label)}</span></td>
                  <td>
                    {quote.status === 'pending' ? '—' : (
                      <>
                        {quote.decided_by_name}
                        {quote.decided_at ? ` · ${formatDate(quote.decided_at.slice(0, 10))}` : ''}
                        {quote.decision_note ? <div><small className="muted">{quote.decision_note}</small></div> : null}
                      </>
                    )}
                  </td>
                  <td>
                    {quote.document_id && (
                      <Button variant="ghost" size="sm" className="iconOnly" aria-label={t('פתיחת ההצעה')} onClick={() => open(quote.document_id)}>
                        <Download size={15} />
                      </Button>
                    )}
                    {canEdit && quote.status === 'pending' && (
                      <>
                        <Button size="sm" disabled={busy} onClick={() => decide(quote, 'approved')}><Check size={14} /> {t('אישור')}</Button>
                        <Button variant="ghost" size="sm" className="danger" disabled={busy} onClick={() => decide(quote, 'rejected')}><X size={14} /> {t('דחייה')}</Button>
                      </>
                    )}
                    {canEdit && quote.status !== 'pending' && (
                      <Button
                        variant="ghost" size="sm" className="iconOnly" aria-label={t('מחיקה')} disabled={busy}
                        onClick={() => window.confirm(t('למחוק את ההצעה?')) && run(() => removeInsuranceQuote(quote.id))}
                      >
                        <X size={14} />
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {canEdit && quotes.some((quote) => quote.status === 'pending') && (
        <Field label={t('הערה להחלטה (אופציונלי)')}>
          <input value={note} onChange={(event) => setNote(event.target.value)} />
        </Field>
      )}

      {canEdit && (
        <form className="form formGrid" onSubmit={submit}>
          <ScanUploader kind="policy" onResult={applyScan} onDiscard={() => setScan(null)} label={t('העלאת הצעה (קריאה אוטומטית)')} />
          <Field label={t('סוכן')}><input value={form.agent} onChange={set('agent')} /></Field>
          <Field label={t('חברת ביטוח')}><input value={form.insurer} onChange={set('insurer')} /></Field>
          <Field label={t('פרמיה מוצעת (₪)')}>
            <input type="number" min="0" step="0.01" value={form.premium_ils} onChange={set('premium_ils')} />
          </Field>
          <Field label={t('הערות')}><input value={form.notes} onChange={set('notes')} /></Field>
          <Button type="submit" disabled={busy}><Plus size={16} /> {t('הגשת הצעה לאישור')}</Button>
        </form>
      )}
    </Card>
  );
}
