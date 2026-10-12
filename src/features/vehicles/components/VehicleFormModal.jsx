import { useState } from 'react';
import Modal from '../../../components/ui/Modal.jsx';
import Button from '../../../components/ui/Button.jsx';
import Field from '../../../components/ui/Field.jsx';
import { t } from '../../language/LanguageContext.jsx';
import { HOLDER_TYPES, OWNERSHIP_TYPES, VEHICLE_KINDS, VEHICLE_STATUSES } from '../constants.js';

const EMPTY = {
  plate_number: '',
  kind: 'car',
  make_model: '',
  manufacture_year: '',
  is_electric: false,
  status: 'in_use',
  expected_arrival: '',
  entered_on: '',
  ownership: '',
  ownership_label: '',
  lease_start: '',
  lease_end: '',
  holder_type: 'driver',
  driver_name: '',
  insurance_agent: '',
  retired_on: '',
  retired_reason: '',
  notes: '',
};

function toForm(vehicle) {
  if (!vehicle) return EMPTY;
  const form = { ...EMPTY };
  for (const key of Object.keys(EMPTY)) form[key] = vehicle[key] ?? EMPTY[key];
  return form;
}

function toPayload(form) {
  const nullable = (value) => (value === '' ? null : value);
  return {
    ...form,
    plate_number: form.plate_number.trim(),
    manufacture_year: form.manufacture_year === '' ? null : Number(form.manufacture_year),
    expected_arrival: nullable(form.expected_arrival),
    entered_on: nullable(form.entered_on),
    ownership: nullable(form.ownership),
    lease_start: nullable(form.lease_start),
    lease_end: nullable(form.lease_end),
    retired_on: nullable(form.retired_on),
  };
}

function Options({ values }) {
  return Object.entries(values).map(([value, label]) => (
    <option key={value} value={value}>{t(label)}</option>
  ));
}

export default function VehicleFormModal({ vehicle, onSave, onClose }) {
  const [form, setForm] = useState(() => toForm(vehicle));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (key) => (event) =>
    setForm((current) => ({
      ...current,
      [key]: event.target.type === 'checkbox' ? event.target.checked : event.target.value,
    }));

  async function submit(event) {
    event.preventDefault();
    if (!form.plate_number.trim()) {
      setError(t('יש להזין מספר רכב.'));
      return;
    }
    setBusy(true);
    setError('');
    try {
      await onSave(toPayload(form));
    } catch (saveError) {
      setError(
        saveError?.code === '23505'
          ? t('רכב עם מספר זה כבר קיים במערכת.')
          : saveError?.message || t('השמירה נכשלה.'),
      );
      setBusy(false);
    }
  }

  return (
    <Modal title={vehicle ? t('עריכת רכב') : t('רכב חדש')} onClose={onClose}>
      <form className="form formGrid" onSubmit={submit}>
        <Field label={t('מספר רכב')}>
          <input value={form.plate_number} onChange={set('plate_number')} required />
        </Field>
        <Field label={t('סוג')}>
          <select value={form.kind} onChange={set('kind')}><Options values={VEHICLE_KINDS} /></select>
        </Field>
        <Field label={t('יצרן ודגם')}>
          <input value={form.make_model} onChange={set('make_model')} />
        </Field>
        <Field label={t('שנת יצור')}>
          <input type="number" min="1980" max="2100" value={form.manufacture_year} onChange={set('manufacture_year')} />
        </Field>
        <Field label={t('סטטוס')}>
          <select value={form.status} onChange={set('status')}><Options values={VEHICLE_STATUSES} /></select>
        </Field>
        {form.status === 'expected' && (
          <Field label={t('תאריך הגעה צפוי')}>
            <input type="date" value={form.expected_arrival} onChange={set('expected_arrival')} />
          </Field>
        )}
        {form.status === 'retired' && (
          <>
            <Field label={t('תאריך הוצאה משימוש')}>
              <input type="date" value={form.retired_on} onChange={set('retired_on')} />
            </Field>
            <Field label={t('סיבה (החזרת ליסינג, מכירה, השבתה)')}>
              <input value={form.retired_reason} onChange={set('retired_reason')} />
            </Field>
          </>
        )}
        <Field label={t('נכנס לחברה בתאריך')}>
          <input type="date" value={form.entered_on} onChange={set('entered_on')} />
        </Field>
        <Field label={t('בעלות')}>
          <select value={form.ownership} onChange={set('ownership')}>
            <option value="">{t('לא צוין')}</option>
            <Options values={OWNERSHIP_TYPES} />
          </select>
        </Field>
        <Field label={t('חברת ליסינג / בעלים')}>
          <input value={form.ownership_label} onChange={set('ownership_label')} />
        </Field>
        {form.ownership === 'leasing' && (
          <>
            <Field label={t('תחילת חוזה ליסינג')}>
              <input type="date" value={form.lease_start} onChange={set('lease_start')} />
            </Field>
            <Field label={t('סיום חוזה ליסינג')}>
              <input type="date" value={form.lease_end} onChange={set('lease_end')} />
            </Field>
          </>
        )}
        <Field label={t('סוג מחזיק')}>
          <select value={form.holder_type} onChange={set('holder_type')}><Options values={HOLDER_TYPES} /></select>
        </Field>
        <Field label={t('שם הנהג / המחזיק')}>
          <input value={form.driver_name} onChange={set('driver_name')} />
        </Field>
        <Field label={t('סוכן ביטוח')}>
          <input value={form.insurance_agent} onChange={set('insurance_agent')} />
        </Field>
        <label className="checkLine">
          <input type="checkbox" checked={form.is_electric} onChange={set('is_electric')} /> {t('רכב חשמלי')}
        </label>
        <Field label={t('הערות')}>
          <textarea rows={3} value={form.notes} onChange={set('notes')} />
        </Field>
        {error && <p className="fieldError" role="alert">{error}</p>}
        <div className="uiModalActions">
          <Button variant="secondary" onClick={onClose}>{t('ביטול')}</Button>
          <Button type="submit" disabled={busy}>{busy ? t('שומר...') : t('שמירה')}</Button>
        </div>
      </form>
    </Modal>
  );
}
