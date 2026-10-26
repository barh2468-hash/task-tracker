import { useMemo, useState } from 'react';
import Modal from '../../../../components/ui/Modal.jsx';
import Button from '../../../../components/ui/Button.jsx';
import Field from '../../../../components/ui/Field.jsx';
import { t } from '../../../language/LanguageContext.jsx';
import SignaturePad from '../../../work-diary/components/SignaturePad.jsx';
import { submitDeclaration } from '../../workerApi.js';
import {
  CHECKLIST_ITEMS, dalkanRequired, givesVehicle, takesVehicle, validateDeclaration,
} from '../../utils/declarationRules.js';

const ACTION_LABELS = { received: 'קבלתי רכב', swapped: 'החלפתי רכב', returned: 'החזרתי רכב' };

function nowLocalInput() {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}

const vehicleLabel = (vehicle) => `${vehicle.plate_number}${vehicle.make_model ? ` — ${vehicle.make_model}` : ''}`;

/**
 * Receive / swap / return declaration. The server closes the previous assignment, opens the new one,
 * records the odometer and notifies the managers (see worker_declare_vehicle).
 */
export default function DeclarationForm({ initialAction = 'received', myVehicles, available, onDone, onClose }) {
  const [form, setForm] = useState({
    action: initialAction,
    vehicleId: initialAction === 'returned' ? myVehicles[0]?.vehicle_id || '' : '',
    returnedVehicleId: myVehicles[0]?.vehicle_id || '',
    use: 'temporary',
    isRegular: false,
    odometer: '',
    returnedOdometer: '',
    place: '',
    happenedAt: nowLocalInput(),
    checklist: {},
    liabilityAck: false,
    signature: '',
  });
  const [errors, setErrors] = useState([]);
  const [busy, setBusy] = useState(false);
  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));
  const setField = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const toggleCheck = (key) => (event) =>
    setForm((current) => ({ ...current, checklist: { ...current.checklist, [key]: event.target.checked } }));

  const { action } = form;
  const takes = takesVehicle(action);
  const gives = givesVehicle(action);
  const needsDalkan = dalkanRequired(action, form.use);
  const candidates = useMemo(
    () => available.filter((vehicle) => !myVehicles.some((mine) => mine.vehicle_id === vehicle.vehicle_id)),
    [available, myVehicles],
  );
  const checklistItems = CHECKLIST_ITEMS.filter((item) => (takes ? true : !item.key.endsWith('_sent')));

  async function submit(event) {
    event.preventDefault();
    const problems = validateDeclaration(form).map((message) => t(message));
    setErrors(problems);
    if (problems.length) return;
    setBusy(true);
    try {
      await submitDeclaration(form);
      onDone(t(ACTION_LABELS[action]));
    } catch (error) {
      setErrors([t(error?.message || 'השליחה נכשלה.')]);
      setBusy(false);
    }
  }

  return (
    <Modal title={t('טופס הצהרה על רכב')} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <div className="formGrid" role="radiogroup" aria-label={t('פעולה')}>
          {Object.entries(ACTION_LABELS).map(([value, label]) => (
            <label key={value}>
              <input
                type="radio"
                name="declaration-action"
                checked={action === value}
                onChange={() => setForm((current) => ({
                  ...current,
                  action: value,
                  vehicleId: value === 'returned' ? myVehicles[0]?.vehicle_id || '' : '',
                }))}
              />{' '}
              {t(label)}
            </label>
          ))}
        </div>

        {takes && (
          <Field label={t('הרכב שאני מקבל/ת')}>
            <select value={form.vehicleId} onChange={set('vehicleId')} required>
              <option value="">{t('בחירת רכב')}</option>
              {candidates.map((vehicle) => (
                <option key={vehicle.vehicle_id} value={vehicle.vehicle_id}>{vehicle.plate_number}</option>
              ))}
            </select>
          </Field>
        )}
        {action === 'returned' && (
          <Field label={t('הרכב שמחזיר/ה')}>
            <select value={form.vehicleId} onChange={set('vehicleId')} required>
              <option value="">{t('בחירת רכב')}</option>
              {myVehicles.map((vehicle) => <option key={vehicle.vehicle_id} value={vehicle.vehicle_id}>{vehicleLabel(vehicle)}</option>)}
            </select>
          </Field>
        )}
        {action === 'swapped' && (
          <Field label={t('הרכב שמחזיר/ה')}>
            <select value={form.returnedVehicleId} onChange={set('returnedVehicleId')} required>
              <option value="">{t('בחירת רכב')}</option>
              {myVehicles.map((vehicle) => <option key={vehicle.vehicle_id} value={vehicle.vehicle_id}>{vehicleLabel(vehicle)}</option>)}
            </select>
          </Field>
        )}

        {takes && (
          <div className="formGrid" role="radiogroup" aria-label={t('סוג שימוש')}>
            <label>
              <input type="radio" name="declaration-use" checked={form.use === 'permanent'} onChange={() => setField('use', 'permanent')} />{' '}
              {t('רכב קבוע')}
            </label>
            <label>
              <input type="radio" name="declaration-use" checked={form.use === 'temporary'} onChange={() => setField('use', 'temporary')} />{' '}
              {t('רכב חלופי / זמני')}
            </label>
          </div>
        )}
        {takes && form.use === 'permanent' && (
          <label>
            <input type="checkbox" checked={form.isRegular} onChange={(event) => setField('isRegular', event.target.checked)} />{' '}
            {t('אני הנהג/ת הקבוע/ה של הרכב')}
          </label>
        )}

        <div className="formGrid">
          <Field label={action === 'returned' ? t('ק"מ החזרה') : t('ק"מ קבלה')}>
            <input type="number" inputMode="numeric" min="0" value={form.odometer} onChange={set('odometer')} required={action === 'returned'} />
          </Field>
          {action === 'swapped' && (
            <Field label={t('ק"מ ברכב שהוחזר')}>
              <input type="number" inputMode="numeric" min="0" value={form.returnedOdometer} onChange={set('returnedOdometer')} />
            </Field>
          )}
          <Field label={t('מועד')}>
            <input type="datetime-local" value={form.happenedAt} onChange={set('happenedAt')} />
          </Field>
          <Field label={t('מקום')}>
            <input value={form.place} onChange={set('place')} />
          </Field>
        </div>

        <fieldset>
          <legend>{t('צ׳קליסט')}</legend>
          {checklistItems.map((item) => (
            <label key={item.key}>
              <input type="checkbox" checked={Boolean(form.checklist[item.key])} onChange={toggleCheck(item.key)} />{' '}
              {t(item.label)}
              {item.key === 'dalkan_blocked' && needsDalkan ? ` (${t('חובה ברכב זמני')})` : ''}
            </label>
          ))}
        </fieldset>

        {takes && (
          <>
            <label>
              <input type="checkbox" checked={form.liabilityAck} onChange={(event) => setField('liabilityAck', event.target.checked)} />{' '}
              {t('אני מצהיר/ה שאני מודע/ת לכך שבכל נזק, דוח או תאונה בזמן שהרכב משויך אליי אני נושא/ת בעלויות על פי חוק.')}
            </label>
            <SignaturePad label={t('חתימה')} value={form.signature} onChange={(value) => setField('signature', value)} />
          </>
        )}
        {gives && action === 'returned' && (
          <p className="muted">{t('אחרי השליחה הרכב ייסגר על שמך והמשרד יקבל הודעה.')}</p>
        )}

        {errors.length > 0 && (
          <ul className="fieldError" role="alert">
            {errors.map((message) => <li key={message}>{message}</li>)}
          </ul>
        )}
        <div className="uiModalActions">
          <Button variant="secondary" onClick={onClose}>{t('ביטול')}</Button>
          <Button type="submit" disabled={busy}>{busy ? t('שולח...') : t('שליחה')}</Button>
        </div>
      </form>
    </Modal>
  );
}
