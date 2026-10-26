import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Car, Fuel, Gauge, LogIn, LogOut, Repeat } from 'lucide-react';
import { useMessage } from '../context/MessageContext.jsx';
import { t } from '../features/language/LanguageContext.jsx';
import PageHeader from '../components/ui/PageHeader.jsx';
import Button from '../components/ui/Button.jsx';
import Card from '../components/ui/Card.jsx';
import EmptyState from '../components/ui/EmptyState.jsx';
import LoadingState from '../components/ui/LoadingState.jsx';
import { isWorkerFlowMissing, loadMyVehicleOverview } from '../features/vehicles/workerApi.js';
import { formatDate } from '../features/vehicles/utils/vehicleStatus.js';
import DeclarationForm from '../features/vehicles/components/worker/DeclarationForm.jsx';
import { FuelReportModal, OdometerReportModal } from '../features/vehicles/components/worker/ReportForms.jsx';
import { formatMonth } from '../features/vehicles/utils/fuelMonths.js';

const ACTION_LABELS = { received: 'קבלתי רכב', swapped: 'החלפתי רכב', returned: 'החזרתי רכב' };

/**
 * "My vehicle" for every role: report the monthly odometer and fuel, and take, swap or return a vehicle
 * with the signed declaration. Data comes only through the worker RPCs (no direct fleet-table access).
 */
export default function MyVehiclePage() {
  useTranslation();
  const { setMessage } = useMessage();
  const [data, setData] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [dialog, setDialog] = useState(null);

  const load = useCallback(async () => {
    try {
      setData(await loadMyVehicleOverview());
      setLoadError('');
    } catch (error) {
      setLoadError(
        isWorkerFlowMissing(error)
          ? t('מסך הרכב האישי עדיין לא הופעל במערכת. יש לפנות למנהל המערכת.')
          : error?.message || t('הטעינה נכשלה.'),
      );
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Vehicles the worker can report fuel for: the ones held now, plus any held in the last two months.
  const fuelVehicles = useMemo(() => {
    if (!data) return [];
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - 2);
    const map = new Map(data.vehicles.map((vehicle) => [vehicle.vehicle_id, vehicle]));
    for (const form of data.forms) {
      if (!map.has(form.vehicle_id) && new Date(form.happened_at) >= cutoff) {
        map.set(form.vehicle_id, { vehicle_id: form.vehicle_id, plate_number: form.plate_number, make_model: form.make_model });
      }
    }
    return [...map.values()];
  }, [data]);

  function done(message) {
    setDialog(null);
    setMessage(message);
    load();
  }

  if (loadError) return <EmptyState icon={AlertTriangle} title={loadError} />;
  if (!data) return <LoadingState label={t('טוען...')} />;

  return (
    <>
      <PageHeader
        title={t('הרכב שלי')}
        subtitle={t('דיווח ק"מ ודלק, וקבלה, החלפה או החזרה של רכב')}
        actions={
          <>
            <Button onClick={() => setDialog({ type: 'declare', action: 'received' })}>
              <LogIn size={16} /> {t('קבלתי רכב')}
            </Button>
            {data.vehicles.length > 0 && (
              <>
                <Button variant="secondary" onClick={() => setDialog({ type: 'declare', action: 'swapped' })}>
                  <Repeat size={16} /> {t('החלפתי רכב')}
                </Button>
                <Button variant="secondary" onClick={() => setDialog({ type: 'declare', action: 'returned' })}>
                  <LogOut size={16} /> {t('החזרתי רכב')}
                </Button>
              </>
            )}
          </>
        }
      />

      {data.vehicles.length === 0 ? (
        <EmptyState
          icon={Car}
          title={t('אין רכב רשום על שמך')}
          description={t('אם קיבלת רכב, לחצי על "קבלתי רכב" ומלאי את הטופס.')}
        />
      ) : (
        data.vehicles.map((vehicle) => (
          <Card key={vehicle.vehicle_id}>
            <h2>
              <bdi>{vehicle.plate_number}</bdi>
              {vehicle.make_model ? ` · ${vehicle.make_model}` : ''}
            </h2>
            <p className="muted">
              {vehicle.assignment_kind === 'temporary' ? t('רכב חלופי / זמני') : t('רכב קבוע')}
              {vehicle.since ? ` · ${t('מ-')}${formatDate(vehicle.since)}` : ''}
            </p>
            <p>
              {t('ק"מ אחרון')}: {vehicle.current_odometer != null ? vehicle.current_odometer.toLocaleString('he-IL') : '—'}
              {!vehicle.odometer_reported_this_month && vehicle.kind !== 'trailer' && (
                <span className="pill warn"> {t('לא דווח החודש')}</span>
              )}
            </p>
            <div className="uiModalActions">
              {vehicle.kind !== 'trailer' && (
                <Button variant="secondary" onClick={() => setDialog({ type: 'odometer', vehicle })}>
                  <Gauge size={16} /> {t('דיווח ק"מ')}
                </Button>
              )}
              <Button variant="secondary" onClick={() => setDialog({ type: 'fuel', vehicleId: vehicle.vehicle_id })}>
                <Fuel size={16} /> {t('דיווח דלק חודשי')}
              </Button>
            </div>
          </Card>
        ))
      )}

      {data.vehicles.length === 0 && fuelVehicles.length > 0 && (
        <div className="uiModalActions">
          <Button variant="secondary" onClick={() => setDialog({ type: 'fuel', vehicleId: fuelVehicles[0].vehicle_id })}>
            <Fuel size={16} /> {t('דיווח דלק חודשי')}
          </Button>
        </div>
      )}

      {data.fuelReports.length > 0 && (
        <Card>
          <h2>{t('דיווחי הדלק שלי')}</h2>
          <table className="equipmentTable">
            <thead><tr><th>{t('חודש')}</th><th>{t('רכב')}</th><th className="num">{t('ליטרים')}</th><th className="num">{t('סכום (₪)')}</th></tr></thead>
            <tbody>
              {data.fuelReports.map((report) => (
                <tr key={report.id}>
                  <td>{formatMonth(String(report.report_month).slice(0, 7))}</td>
                  <td><bdi>{report.plate_number}</bdi></td>
                  <td className="num">{Number(report.liters).toLocaleString('he-IL')}</td>
                  <td className="num">{report.amount_ils != null ? Number(report.amount_ils).toLocaleString('he-IL') : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {data.forms.length > 0 && (
        <Card>
          <h2>{t('הטפסים שלי')}</h2>
          <table className="equipmentTable">
            <thead><tr><th>{t('מועד')}</th><th>{t('פעולה')}</th><th>{t('רכב')}</th><th>{t('סטטוס')}</th></tr></thead>
            <tbody>
              {data.forms.map((form) => (
                <tr key={form.id}>
                  <td>{formatDate(form.happened_at)}</td>
                  <td>{t(ACTION_LABELS[form.action])}</td>
                  <td><bdi>{form.plate_number}</bdi></td>
                  <td>{form.status === 'approved' ? t('אושר') : t('ממתין לאישור')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {dialog?.type === 'declare' && (
        <DeclarationForm
          initialAction={dialog.action}
          myVehicles={data.vehicles}
          available={data.available}
          onDone={done}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.type === 'odometer' && (
        <OdometerReportModal vehicle={dialog.vehicle} onDone={done} onClose={() => setDialog(null)} />
      )}
      {dialog?.type === 'fuel' && (
        <FuelReportModal
          vehicles={fuelVehicles}
          existing={data.fuelReports}
          initialVehicleId={dialog.vehicleId}
          onDone={done}
          onClose={() => setDialog(null)}
        />
      )}
    </>
  );
}
