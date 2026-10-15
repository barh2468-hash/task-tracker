import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, ArrowRight, FileText, Plus, Receipt } from 'lucide-react';
import { useAuth } from '../features/auth/useAuth.js';
import { useMessage } from '../context/MessageContext.jsx';
import { t } from '../features/language/LanguageContext.jsx';
import PageHeader from '../components/ui/PageHeader.jsx';
import Button from '../components/ui/Button.jsx';
import Card from '../components/ui/Card.jsx';
import Field from '../components/ui/Field.jsx';
import Modal from '../components/ui/Modal.jsx';
import EmptyState from '../components/ui/EmptyState.jsx';
import LoadingState from '../components/ui/LoadingState.jsx';
import {
  createFine, forwardFine, getDocumentUrl, loadDriverCandidates, loadFines, loadFleetVehicles,
  removeFine, setFineStatus, updateFineAmount,
} from '../features/vehicles/api.js';
import { daysUntil, formatDate } from '../features/vehicles/utils/vehicleStatus.js';
import FineFormModal from '../features/vehicles/components/FineFormModal.jsx';

const FINE_STATUS = {
  new: { label: 'חדש', pill: 'gpr' },
  forwarded: { label: 'הועבר לנהג', pill: 'field' },
  paid: { label: 'שולם', pill: 'done' },
  appeal: { label: 'בערעור', pill: 'neutral' },
};

const money = (value) => new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS' }).format(Number(value) || 0);
const dateTime = (value) => (value ? new Date(value).toLocaleString('he-IL', { dateStyle: 'short', timeStyle: 'short' }) : '—');
const OPEN_STATUSES = ['new', 'forwarded'];

function FineDetailModal({ fine, canEdit, onAction, onClose }) {
  const { setMessage } = useMessage();
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);

  async function run(action, success) {
    setBusy(true);
    try {
      await action();
      setMessage(success);
    } catch (error) {
      setMessage(error?.message || t('הפעולה נכשלה.'), 'error');
    } finally {
      setBusy(false);
    }
  }

  async function open(path) {
    try {
      window.open(await getDocumentUrl({ file_path: path }), '_blank', 'noopener');
    } catch (error) {
      setMessage(error?.message || t('לא ניתן לפתוח את המסמך.'), 'error');
    }
  }

  const history = fine.amount_history || [];
  return (
    <Modal title={`${t('דוח')} ${fine.fine_number || ''}`} onClose={onClose}>
      <div className="formGrid">
        <div><small className="muted">{t('רכב')}</small><div><bdi>{fine.vehicle?.plate_number}</bdi> {fine.vehicle?.make_model}</div></div>
        <div><small className="muted">{t('נהג אחראי')}</small><div>{fine.driver_name || '—'}</div></div>
        <div><small className="muted">{t('מועד העבירה')}</small><div>{dateTime(fine.offense_at)}</div></div>
        <div><small className="muted">{t('עבירה')}</small><div>{fine.offense_description || '—'}</div></div>
        <div><small className="muted">{t('מקום')}</small><div>{fine.location || '—'}</div></div>
        <div><small className="muted">{t('רשות')}</small><div>{fine.authority || '—'}</div></div>
        <div><small className="muted">{t('סכום לתשלום')}</small><div><b>{money(fine.amount_ils)}</b></div></div>
        <div><small className="muted">{t('לתשלום עד')}</small><div>{fine.due_date ? formatDate(fine.due_date) : '—'}</div></div>
      </div>
      {fine.notes && <p className="muted">{fine.notes}</p>}
      {history.length > 1 && (
        <p className="muted">
          {t('היסטוריית סכום')}: {history.map((entry) => `${money(entry.amount)} (${formatDate(entry.at.slice(0, 10))})`).join(' ← ')}
        </p>
      )}
      <p>
        {fine.document?.file_path && (
          <Button variant="secondary" size="sm" onClick={() => open(fine.document.file_path)}><FileText size={14} /> {t('סריקת הדוח')}</Button>
        )}
      </p>

      {canEdit && fine.status !== 'paid' && (
        <fieldset className="innerPanel">
          <legend>{t('עדכון סכום (למשל אחרי חיוב ריבית)')}</legend>
          <div className="formGrid">
            <Field label={t('סכום חדש מהרשות (₪)')}>
              <input type="number" min="0" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} />
            </Field>
            <Button
              variant="secondary"
              disabled={busy || !amount}
              onClick={() => run(async () => { await onAction('amount', Number(amount)); setAmount(''); }, t('הסכום עודכן.'))}
            >
              {t('עדכון סכום')}
            </Button>
          </div>
        </fieldset>
      )}

      <div className="uiModalActions">
        <Button variant="secondary" onClick={onClose}>{t('סגירה')}</Button>
        {canEdit && (
          <>
            <Button variant="ghost" className="danger" disabled={busy} onClick={() => window.confirm(t('למחוק את הדוח?')) && run(() => onAction('delete'), t('הדוח נמחק.'))}>
              {t('מחיקה')}
            </Button>
            {fine.status !== 'appeal' && fine.status !== 'paid' && (
              <Button variant="secondary" disabled={busy} onClick={() => run(() => onAction('appeal'), t('הדוח סומן כבערעור.'))}>{t('סימון ערעור')}</Button>
            )}
            {fine.status === 'new' && (
              <Button disabled={busy} onClick={() => run(() => onAction('forward'), t('הדוח סומן כמועבר לנהג.'))}>
                {t('סימון כמועבר לנהג')}
              </Button>
            )}
            {fine.status !== 'paid' && (
              <Button disabled={busy} onClick={() => run(() => onAction('paid'), t('הדוח סומן כשולם.'))}>{t('סימון כשולם')}</Button>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}

export default function VehicleFinesPage() {
  useTranslation();
  const { session, isManager } = useAuth();
  const { setMessage } = useMessage();
  const [fines, setFines] = useState(null);
  const [vehicles, setVehicles] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('open');
  const [dialog, setDialog] = useState(null);
  const [selected, setSelected] = useState(null);
  const userId = session?.user?.id;

  const load = useCallback(async () => {
    try {
      const [rows, choices, people] = await Promise.all([loadFines(), loadFleetVehicles(), loadDriverCandidates()]);
      setFines(rows);
      setVehicles(choices);
      setDrivers(people);
      setError('');
    } catch (loadError) {
      setError(
        loadError?.code === '42P01' || loadError?.code === 'PGRST205'
          ? t('טבלת הדוחות עדיין לא קיימת במסד הנתונים. יש להריץ את המיגרציה.')
          : loadError?.message || t('הטעינה נכשלה.'),
      );
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const visible = useMemo(
    () =>
      (fines || [])
        .filter((fine) => (filter === 'all' ? true : filter === 'open' ? OPEN_STATUSES.includes(fine.status) : fine.status === filter))
        .sort((a, b) => (a.due_date || '9999').localeCompare(b.due_date || '9999')),
    [fines, filter],
  );
  const openTotal = (fines || []).filter((fine) => OPEN_STATUSES.includes(fine.status)).reduce((sum, fine) => sum + Number(fine.amount_ils), 0);

  async function handleCreate(payload, scan) {
    await createFine(payload, scan, userId);
    setDialog(null);
    setMessage(t('הדוח נשמר.'));
    await load();
  }

  async function handleAction(fine, action, value) {
    if (action === 'amount') await updateFineAmount(fine, value);
    else if (action === 'forward') await forwardFine(fine);
    else if (action === 'delete') await removeFine(fine);
    else await setFineStatus(fine.id, action === 'paid' ? 'paid' : 'appeal');
    setSelected(null);
    await load();
  }

  if (error) return <EmptyState icon={AlertTriangle} title={error} />;
  if (!fines) return <LoadingState label={t('טוען דוחות...')} />;

  return (
    <>
      <PageHeader
        title={t('דוחות')}
        subtitle={`${t('סה"כ פתוח לתשלום')}: ${money(openTotal)}`}
        actions={
          <>
            <Link to="/app/vehicles" className="secondary smallBtn"><ArrowRight size={15} /> {t('לרשימת הרכבים')}</Link>
            {isManager && <Button onClick={() => setDialog('new')}><Plus size={16} /> {t('דוח חדש')}</Button>}
          </>
        }
      />
      <div className="toolbar">
        <select value={filter} onChange={(event) => setFilter(event.target.value)}>
          <option value="open">{t('פתוחים')}</option>
          <option value="all">{t('הכל')}</option>
          {Object.entries(FINE_STATUS).map(([value, item]) => <option key={value} value={value}>{t(item.label)}</option>)}
        </select>
      </div>

      {visible.length === 0 ? (
        <EmptyState icon={Receipt} title={t('אין דוחות להצגה')} description={isManager ? t('אפשר להעלות סריקה והמערכת תמלא את הפרטים.') : undefined} />
      ) : (
        <Card className="equipmentTableWrap">
          <table className="equipmentTable">
            <thead>
              <tr>
                <th>{t('רכב')}</th><th>{t('מס׳ דוח')}</th><th>{t('מועד העבירה')}</th><th>{t('נהג')}</th>
                <th className="num">{t('סכום')}</th><th>{t('לתשלום עד')}</th><th>{t('סטטוס')}</th><th />
              </tr>
            </thead>
            <tbody>
              {visible.map((fine) => {
                const left = fine.due_date ? daysUntil(fine.due_date) : null;
                const late = left !== null && left < 0 && OPEN_STATUSES.includes(fine.status);
                return (
                  <tr key={fine.id}>
                    <td><bdi>{fine.vehicle?.plate_number}</bdi></td>
                    <td>{fine.fine_number || '—'}</td>
                    <td>{dateTime(fine.offense_at)}</td>
                    <td>{fine.driver_name || <span className="muted">{t('לא נקבע')}</span>}</td>
                    <td className="num">{money(fine.amount_ils)}</td>
                    <td>{fine.due_date ? <span className={late ? 'pill permits' : ''}>{formatDate(fine.due_date)}</span> : '—'}</td>
                    <td><span className={`pill ${FINE_STATUS[fine.status].pill}`}>{t(FINE_STATUS[fine.status].label)}</span></td>
                    <td><Button variant="secondary" size="sm" onClick={() => setSelected(fine)}>{t('פתיחה')}</Button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}

      {dialog === 'new' && <FineFormModal vehicles={vehicles} drivers={drivers} onSave={handleCreate} onClose={() => setDialog(null)} />}
      {selected && (
        <FineDetailModal
          fine={selected}
          canEdit={isManager}
          onAction={(action, value) => handleAction(selected, action, value)}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  );
}
