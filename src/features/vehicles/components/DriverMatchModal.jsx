import { useMemo, useState } from 'react';
import Modal from '../../../components/ui/Modal.jsx';
import Button from '../../../components/ui/Button.jsx';
import EmptyState from '../../../components/ui/EmptyState.jsx';
import { t } from '../../language/LanguageContext.jsx';
import { buildDriverMatches } from '../utils/matchDrivers.js';

/**
 * Links vehicles' free-text driver names to system users. Strong name matches
 * are pre-selected; the secretary reviews every row before anything is saved.
 * Rows left on "no link" stay untouched (many drivers have no account).
 */
export default function DriverMatchModal({ vehicles, drivers, onSave, onClose }) {
  const rows = useMemo(() => buildDriverMatches(vehicles, drivers), [vehicles, drivers]);
  const [choices, setChoices] = useState(() =>
    Object.fromEntries(rows.map((row) => [row.vehicle.id, row.preselected?.id || ''])),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const selected = rows.filter((row) => choices[row.vehicle.id]);

  async function save() {
    setBusy(true);
    setError('');
    try {
      await onSave(selected.map((row) => ({ vehicleId: row.vehicle.id, driverId: choices[row.vehicle.id] })));
    } catch (saveError) {
      setError(saveError?.message || t('השמירה נכשלה.'));
      setBusy(false);
    }
  }

  return (
    <Modal title={t('התאמת נהגים למשתמשים')} onClose={onClose}>
      {drivers.length === 0 ? (
        <EmptyState
          title={t('לא ניתן לטעון את רשימת המשתמשים')}
          description={t('יש להריץ את מיגרציית fleet_driver_lookup ב-Supabase.')}
        />
      ) : rows.length === 0 ? (
        <EmptyState title={t('כל הנהגים כבר מקושרים')} />
      ) : (
        <>
          <p className="muted">
            {t('לכל רכב נבחר המשתמש שהשם שלו תואם לשם הנהג. התאמות ודאיות מסומנות מראש, ואת השאר יש לבדוק. רכבים בלי משתמש במערכת נשארים כפי שהם.')}
          </p>
          <div className="equipmentTableWrap" style={{ maxHeight: 380 }}>
            <table className="equipmentTable">
              <thead>
                <tr><th>{t('רכב')}</th><th>{t('שם נהג בטבלה')}</th><th>{t('משתמש במערכת')}</th></tr>
              </thead>
              <tbody>
                {rows.map(({ vehicle, suggestions }) => (
                  <tr key={vehicle.id}>
                    <td><bdi>{vehicle.plate_number}</bdi></td>
                    <td>{vehicle.driver_name}</td>
                    <td>
                      <select
                        aria-label={`${t('משתמש עבור')} ${vehicle.plate_number}`}
                        value={choices[vehicle.id]}
                        onChange={(event) => setChoices((current) => ({ ...current, [vehicle.id]: event.target.value }))}
                      >
                        <option value="">{t('ללא קישור')}</option>
                        {suggestions.length > 0 && (
                          <optgroup label={t('הצעות')}>
                            {suggestions.map(({ candidate }) => (
                              <option key={candidate.id} value={candidate.id}>{candidate.full_name}</option>
                            ))}
                          </optgroup>
                        )}
                        <optgroup label={t('כל המשתמשים')}>
                          {drivers
                            .filter((candidate) => !suggestions.some((s) => s.candidate.id === candidate.id))
                            .map((candidate) => (
                              <option key={candidate.id} value={candidate.id}>{candidate.full_name}</option>
                            ))}
                        </optgroup>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      {error && <p className="fieldError" role="alert">{error}</p>}
      <div className="uiModalActions">
        <Button variant="secondary" onClick={onClose}>{t('סגירה')}</Button>
        {rows.length > 0 && drivers.length > 0 && (
          <Button disabled={busy || selected.length === 0} onClick={save}>
            {busy ? t('שומר...') : `${t('שמירת')} ${selected.length} ${t('קישורים')}`}
          </Button>
        )}
      </div>
    </Modal>
  );
}
