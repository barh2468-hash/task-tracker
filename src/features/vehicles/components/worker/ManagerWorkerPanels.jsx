import { useState } from 'react';
import { Check, PenLine } from 'lucide-react';
import Button from '../../../../components/ui/Button.jsx';
import Card from '../../../../components/ui/Card.jsx';
import EmptyState from '../../../../components/ui/EmptyState.jsx';
import { useMessage } from '../../../../context/MessageContext.jsx';
import { t } from '../../../language/LanguageContext.jsx';
import { approveDeclaration, loadFormSignature } from '../../workerApi.js';
import { formatDate } from '../../utils/vehicleStatus.js';
import { formatMonth } from '../../utils/fuelMonths.js';

const ACTION_LABELS = { received: 'קבלתי רכב', swapped: 'החלפתי רכב', returned: 'החזרתי רכב' };

const dateTime = (value) => `${formatDate(value)} ${new Date(value).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}`;

/** Declarations the workers filled for this vehicle (received / swapped / returned), with approval. */
export function FormsPanel({ vehicle, forms, canEdit, user, onChanged }) {
  const { setMessage } = useMessage();
  const [busyId, setBusyId] = useState('');
  const [signature, setSignature] = useState(null);

  async function approve(form) {
    setBusyId(form.id);
    try {
      await approveDeclaration(form, vehicle, user);
      setMessage(t('הטופס אושר.'));
      await onChanged();
    } catch (error) {
      setMessage(error?.message || t('האישור נכשל.'), 'error');
    } finally {
      setBusyId('');
    }
  }

  async function showSignature(form) {
    setSignature({ id: form.id, loading: true });
    setSignature({ id: form.id, image: await loadFormSignature(form.id) });
  }

  return (
    <Card>
      {forms.length === 0 ? (
        <EmptyState title={t('לא מולאו טפסים לרכב זה')} />
      ) : (
        <div className="equipmentTableWrap">
          <table className="equipmentTable">
            <thead>
              <tr>
                <th>{t('מועד')}</th><th>{t('עובד')}</th><th>{t('פעולה')}</th><th>{t('סוג שימוש')}</th>
                <th className="num">{t('ק"מ')}</th><th>{t('סטטוס')}</th><th />
              </tr>
            </thead>
            <tbody>
              {forms.map((form) => (
                <tr key={form.id}>
                  <td>{dateTime(form.happened_at)}</td>
                  <td>{form.user_name || '—'}</td>
                  <td>{t(ACTION_LABELS[form.action])}</td>
                  <td>{form.vehicle_use === 'temporary' ? t('זמני') : t('קבוע')}</td>
                  <td className="num">{form.odometer?.toLocaleString('he-IL') ?? '—'}</td>
                  <td>
                    <span className={`pill ${form.status === 'approved' ? 'done' : 'neutral'}`}>
                      {form.status === 'approved' ? t('אושר') : t('ממתין לאישור')}
                    </span>
                  </td>
                  <td>
                    {form.action !== 'returned' && (
                      <Button variant="ghost" size="sm" onClick={() => showSignature(form)}>
                        <PenLine size={14} /> {t('חתימה')}
                      </Button>
                    )}
                    {canEdit && form.status === 'pending' && (
                      <Button size="sm" disabled={busyId === form.id} onClick={() => approve(form)}>
                        <Check size={14} /> {t('אישור')}
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {signature && (
        <div role="dialog" aria-label={t('חתימה')}>
          {signature.loading ? <p className="muted">{t('טוען...')}</p>
            : signature.image ? <img src={signature.image} alt={t('חתימה')} style={{ maxWidth: '100%' }} />
              : <p className="muted">{t('אין חתימה שמורה')}</p>}
          <Button variant="ghost" size="sm" onClick={() => setSignature(null)}>{t('סגירה')}</Button>
        </div>
      )}
    </Card>
  );
}

/** Monthly fuel the drivers reported for this vehicle. */
export function FuelPanel({ reports }) {
  return (
    <Card>
      {reports.length === 0 ? (
        <EmptyState title={t('לא דווח דלק לרכב זה')} />
      ) : (
        <div className="equipmentTableWrap">
          <table className="equipmentTable">
            <thead>
              <tr><th>{t('חודש')}</th><th>{t('עובד')}</th><th className="num">{t('ליטרים')}</th><th className="num">{t('סכום (₪)')}</th></tr>
            </thead>
            <tbody>
              {reports.map((report) => (
                <tr key={report.id}>
                  <td>{formatMonth(String(report.report_month).slice(0, 7))}</td>
                  <td>{report.reporter?.full_name || '—'}</td>
                  <td className="num">{Number(report.liters).toLocaleString('he-IL')}</td>
                  <td className="num">{report.amount_ils != null ? Number(report.amount_ils).toLocaleString('he-IL') : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
