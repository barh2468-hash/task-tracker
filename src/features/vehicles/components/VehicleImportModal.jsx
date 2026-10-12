import { useState } from 'react';
import { AlertTriangle, Upload } from 'lucide-react';
import Modal from '../../../components/ui/Modal.jsx';
import Button from '../../../components/ui/Button.jsx';
import { t } from '../../language/LanguageContext.jsx';
import { parseVehicleRegistryFile } from '../utils/parseVehicleRegistry.js';
import { OWNERSHIP_TYPES, TOLL_KINDS, VEHICLE_KINDS } from '../constants.js';

export default function VehicleImportModal({ existingVehicles, onImport, onClose }) {
  const [parsed, setParsed] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const digits = (plate) => String(plate).replace(/\D/g, '');
  const known = new Set(existingVehicles.map((vehicle) => digits(vehicle.plate_number)));
  const newCount = parsed ? parsed.vehicles.filter((v) => !known.has(digits(v.plate_number))).length : 0;

  async function pickFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setError('');
    setParsed(null);
    try {
      setParsed(await parseVehicleRegistryFile(file));
    } catch (parseError) {
      setError(parseError.message || t('לא ניתן לקרוא את הקובץ.'));
    }
  }

  async function confirm() {
    setBusy(true);
    setError('');
    try {
      await onImport(parsed.vehicles);
    } catch (importError) {
      setError(importError?.message || t('הייבוא נכשל.'));
      setBusy(false);
    }
  }

  return (
    <Modal title={t('ייבוא טבלת רכבים')} onClose={onClose}>
      <p className="muted">
        {t('בחרי את קובץ האקסל של המזכירה. רכבים שכבר קיימים במערכת (לפי מספר רכב) לא יידרסו.')}
      </p>
      <label className="secondary smallBtn">
        <Upload size={15} /> {t('בחירת קובץ')}
        <input type="file" accept=".xls,.xlsx" hidden onChange={pickFile} />
      </label>
      {error && <p className="fieldError" role="alert">{error}</p>}

      {parsed && (
        <>
          <p>
            {t('נמצאו')} <b>{parsed.vehicles.length}</b> {t('רכבים')} · <b>{newCount}</b> {t('חדשים לייבוא')}
          </p>
          {parsed.warnings.length > 0 && (
            <ul className="muted">
              {parsed.warnings.map((warning) => (
                <li key={warning}><AlertTriangle size={14} /> {warning}</li>
              ))}
            </ul>
          )}
          <div className="equipmentTableWrap" style={{ maxHeight: 320 }}>
            <table className="equipmentTable">
              <thead>
                <tr>
                  <th>{t('מספר רכב')}</th><th>{t('סוג')}</th><th>{t('דגם')}</th>
                  <th>{t('בעלות')}</th><th>{t('נהג')}</th><th>{t('מנויים')}</th><th />
                </tr>
              </thead>
              <tbody>
                {parsed.vehicles.map((vehicle) => (
                  <tr key={vehicle.plate_number}>
                    <td>{vehicle.plate_number}</td>
                    <td>{t(VEHICLE_KINDS[vehicle.kind])}</td>
                    <td>{vehicle.make_model}</td>
                    <td>{[OWNERSHIP_TYPES[vehicle.ownership] && t(OWNERSHIP_TYPES[vehicle.ownership]), vehicle.ownership_label].filter(Boolean).join(' · ')}</td>
                    <td>{vehicle.driver_name}</td>
                    <td>{vehicle.tolls.map((toll) => t(TOLL_KINDS[toll.kind])).join(', ')}</td>
                    <td>{known.has(digits(vehicle.plate_number)) ? t('קיים – ידולג') : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <div className="uiModalActions">
        <Button variant="secondary" onClick={onClose}>{t('ביטול')}</Button>
        <Button disabled={busy || !parsed || newCount === 0} onClick={confirm}>
          {busy ? t('מייבא...') : `${t('ייבוא')} ${newCount} ${t('רכבים')}`}
        </Button>
      </div>
    </Modal>
  );
}
