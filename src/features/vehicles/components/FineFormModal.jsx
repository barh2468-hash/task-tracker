import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import Modal from '../../../components/ui/Modal.jsx';
import Button from '../../../components/ui/Button.jsx';
import Field from '../../../components/ui/Field.jsx';
import { t } from '../../language/LanguageContext.jsx';
import ScanUploader from './ScanUploader.jsx';
import { discardScan, findVehicleByPlate, resolveFineHolder } from '../api.js';

const EMPTY = {
  vehicle_id: '',
  fine_number: '',
  offense_at: '',
  offense_description: '',
  location: '',
  authority: '',
  amount_ils: '',
  due_date: '',
  points: '',
  notes: '',
};

function toLocalInput(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 16);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}

/**
 * New fine from a scan (AI-filled, reviewed here) or by hand. The holder of
 * the vehicle at the offense time is looked up from the assignment history,
 * and can be overridden before saving.
 */
export default function FineFormModal({ vehicles, drivers, onSave, onClose }) {
  const [form, setForm] = useState(EMPTY);
  const [scan, setScan] = useState(null);
  const [uncertain, setUncertain] = useState([]);
  const [plateHint, setPlateHint] = useState('');
  const [holder, setHolder] = useState({ driver_id: '', driver_name: '' });
  const [aiUsed, setAiUsed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));
  const doubtful = (key) => (uncertain.includes(key) ? t('לא בטוח בקריאה – יש לבדוק') : undefined);

  function handleResult({ scan: uploaded, fields, uncertain: unsure }) {
    setScan(uploaded);
    if (!fields) return;
    const vehicle = findVehicleByPlate(vehicles, fields.plate_number);
    setAiUsed(true);
    setUncertain(unsure);
    setPlateHint(vehicle ? '' : fields.plate_number || '');
    setForm((current) => ({
      ...current,
      vehicle_id: vehicle?.id || current.vehicle_id,
      fine_number: fields.fine_number ?? current.fine_number,
      offense_at: fields.offense_at ? toLocalInput(fields.offense_at) : current.offense_at,
      offense_description: fields.offense_description ?? current.offense_description,
      location: fields.location ?? current.location,
      authority: fields.authority ?? current.authority,
      amount_ils: fields.amount_ils ?? current.amount_ils,
      due_date: fields.due_date ?? current.due_date,
      points: fields.points ?? current.points,
      notes: fields.notes ?? current.notes,
    }));
  }

  // Re-resolve who held the vehicle whenever the vehicle or offense time changes.
  useEffect(() => {
    if (!form.vehicle_id || !form.offense_at) return undefined;
    let cancelled = false;
    resolveFineHolder(form.vehicle_id, form.offense_at)
      .then((result) => !cancelled && setHolder({ driver_id: result.driver_id || '', driver_name: result.driver_name || '' }))
      .catch(() => !cancelled && setHolder({ driver_id: '', driver_name: '' }));
    return () => {
      cancelled = true;
    };
  }, [form.vehicle_id, form.offense_at]);

  const holderOptions = useMemo(() => drivers || [], [drivers]);

  async function close() {
    if (scan) await discardScan(scan);
    onClose();
  }

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await onSave(
        {
          vehicle_id: form.vehicle_id,
          driver_id: holder.driver_id || null,
          driver_name: holder.driver_name,
          fine_number: form.fine_number.trim(),
          offense_description: form.offense_description,
          offense_at: form.offense_at ? new Date(form.offense_at).toISOString() : null,
          location: form.location,
          authority: form.authority,
          amount_ils: Number(form.amount_ils),
          due_date: form.due_date || null,
          points: form.points === '' ? null : Number(form.points),
          notes: form.notes,
          source: aiUsed ? 'ai' : 'manual',
        },
        scan,
      );
    } catch (saveError) {
      setError(saveError?.code === '23505' ? t('דוח עם מספר זה כבר קיים לרכב.') : saveError?.message || t('השמירה נכשלה.'));
      setBusy(false);
    }
  }

  return (
    <Modal title={t('דוח חדש')} onClose={close}>
      <form className="form" onSubmit={submit}>
        <ScanUploader kind="fine" onResult={handleResult} onDiscard={() => { setScan(null); setUncertain([]); }} />
        {plateHint && (
          <p className="muted" role="status">
            <AlertTriangle size={14} /> {t('הרכב')} {plateHint} {t('לא נמצא במערכת. יש לבחור רכב ידנית.')}
          </p>
        )}
        <div className="formGrid">
          <Field label={t('רכב')}>
            <select value={form.vehicle_id} onChange={set('vehicle_id')} required>
              <option value="">{t('בחירת רכב')}</option>
              {vehicles.map((vehicle) => (
                <option key={vehicle.id} value={vehicle.id}>{vehicle.plate_number}{vehicle.make_model ? ` — ${vehicle.make_model}` : ''}</option>
              ))}
            </select>
          </Field>
          <Field label={t('מספר דוח')} hint={doubtful('fine_number')}>
            <input value={form.fine_number} onChange={set('fine_number')} />
          </Field>
          <Field label={t('מועד העבירה')} hint={doubtful('offense_at')}>
            <input type="datetime-local" value={form.offense_at} onChange={set('offense_at')} required />
          </Field>
          <Field label={t('סכום לתשלום (₪)')} hint={doubtful('amount_ils')}>
            <input type="number" min="0" step="0.01" value={form.amount_ils} onChange={set('amount_ils')} required />
          </Field>
          <Field label={t('לתשלום עד')} hint={doubtful('due_date')}>
            <input type="date" value={form.due_date} onChange={set('due_date')} />
          </Field>
          <Field label={t('עבירה')} hint={doubtful('offense_description')}>
            <input value={form.offense_description} onChange={set('offense_description')} />
          </Field>
          <Field label={t('מקום')} hint={doubtful('location')}>
            <input value={form.location} onChange={set('location')} />
          </Field>
          <Field label={t('רשות מוציאה')} hint={doubtful('authority')}>
            <input value={form.authority} onChange={set('authority')} />
          </Field>
          <Field label={t('נקודות')}>
            <input type="number" min="0" value={form.points} onChange={set('points')} />
          </Field>
        </div>
        <Field
          label={t('נהג אחראי')}
          hint={form.vehicle_id && form.offense_at ? t('נקבע לפי היסטוריית השיוכים בשעת העבירה. אפשר לשנות.') : t('יוצג אחרי בחירת רכב ומועד.')}
        >
          <select
            value={holder.driver_id}
            onChange={(event) => {
              const chosen = holderOptions.find((driver) => driver.id === event.target.value);
              setHolder({ driver_id: event.target.value, driver_name: chosen?.full_name || '' });
            }}
          >
            <option value="">{holder.driver_name ? `${holder.driver_name} (${t('ללא משתמש מקושר')})` : t('לא נקבע')}</option>
            {holderOptions.map((driver) => <option key={driver.id} value={driver.id}>{driver.full_name}</option>)}
          </select>
        </Field>
        <Field label={t('הערות')}>
          <textarea rows={2} value={form.notes} onChange={set('notes')} />
        </Field>
        {error && <p className="fieldError" role="alert">{error}</p>}
        <div className="uiModalActions">
          <Button variant="secondary" onClick={close}>{t('ביטול')}</Button>
          <Button type="submit" disabled={busy}>{busy ? t('שומר...') : t('שמירה')}</Button>
        </div>
      </form>
    </Modal>
  );
}
