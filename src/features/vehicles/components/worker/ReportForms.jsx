import { useState } from 'react';
import Modal from '../../../../components/ui/Modal.jsx';
import Button from '../../../../components/ui/Button.jsx';
import Field from '../../../../components/ui/Field.jsx';
import { t } from '../../../language/LanguageContext.jsx';
import { reportMyFuel, reportMyOdometer } from '../../workerApi.js';
import { formatMonth, fuelMonthOptions } from '../../utils/fuelMonths.js';

export function OdometerReportModal({ vehicle, onDone, onClose }) {
  const [km, setKm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    if (!/^\d+$/.test(km)) {
      setError(t('ק"מ חייב להיות מספר שלם שאינו שלילי.'));
      return;
    }
    setBusy(true);
    try {
      await reportMyOdometer(vehicle.vehicle_id, km);
      onDone(t('הקריאה נשמרה.'));
    } catch (reportError) {
      setError(t(reportError?.message || 'השמירה נכשלה.'));
      setBusy(false);
    }
  }

  return (
    <Modal title={`${t('דיווח ק"מ')} · ${vehicle.plate_number}`} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <Field
          label={t('ק"מ נוכחי')}
          hint={vehicle.current_odometer != null ? `${t('קריאה אחרונה')}: ${vehicle.current_odometer.toLocaleString('he-IL')}` : undefined}
        >
          <input type="number" inputMode="numeric" min="0" value={km} onChange={(event) => setKm(event.target.value)} required />
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

/** Monthly fuel for the worker's vehicle, independent of any swap. Re-sending a month updates it. */
export function FuelReportModal({ vehicles, existing, initialVehicleId, onDone, onClose }) {
  const months = fuelMonthOptions();
  const [vehicleId, setVehicleId] = useState(initialVehicleId || vehicles[0]?.vehicle_id || '');
  const [month, setMonth] = useState(months[0]);
  const previous = existing.find((report) => report.vehicle_id === vehicleId && String(report.report_month).slice(0, 10) === month);
  const [liters, setLiters] = useState(previous ? String(previous.liters) : '');
  const [amount, setAmount] = useState(previous?.amount_ils != null ? String(previous.amount_ils) : '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  function pick(nextVehicle, nextMonth) {
    setVehicleId(nextVehicle);
    setMonth(nextMonth);
    const found = existing.find((report) => report.vehicle_id === nextVehicle && String(report.report_month).slice(0, 10) === nextMonth);
    setLiters(found ? String(found.liters) : '');
    setAmount(found?.amount_ils != null ? String(found.amount_ils) : '');
  }

  async function submit(event) {
    event.preventDefault();
    if (!(Number(liters) >= 0) || liters === '') {
      setError(t('יש להזין כמות ליטרים תקינה.'));
      return;
    }
    setBusy(true);
    try {
      await reportMyFuel({ vehicleId, month, liters, amount });
      onDone(t('דיווח הדלק נשמר.'));
    } catch (reportError) {
      setError(t(reportError?.message || 'השמירה נכשלה.'));
      setBusy(false);
    }
  }

  return (
    <Modal title={t('דיווח דלק חודשי')} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <div className="formGrid">
          <Field label={t('רכב')}>
            <select value={vehicleId} onChange={(event) => pick(event.target.value, month)} required>
              {vehicles.map((vehicle) => (
                <option key={vehicle.vehicle_id} value={vehicle.vehicle_id}>
                  {vehicle.plate_number}{vehicle.make_model ? ` — ${vehicle.make_model}` : ''}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t('חודש')}>
            <select value={month} onChange={(event) => pick(vehicleId, event.target.value)}>
              {months.map((value) => <option key={value} value={value}>{formatMonth(value)}</option>)}
            </select>
          </Field>
          <Field label={t('ליטרים שתודלקו בחודש')}>
            <input type="number" inputMode="decimal" min="0" step="0.01" value={liters} onChange={(event) => setLiters(event.target.value)} required />
          </Field>
          <Field label={t('סכום (₪, לא חובה)')}>
            <input type="number" inputMode="decimal" min="0" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} />
          </Field>
        </div>
        {previous && <p className="muted">{t('כבר דווח לחודש זה. השליחה תעדכן את הדיווח.')}</p>}
        {error && <p className="fieldError" role="alert">{error}</p>}
        <div className="uiModalActions">
          <Button variant="secondary" onClick={onClose}>{t('ביטול')}</Button>
          <Button type="submit" disabled={busy || !vehicleId}>{busy ? t('שומר...') : t('שמירה')}</Button>
        </div>
      </form>
    </Modal>
  );
}
