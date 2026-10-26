import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, ArrowRight, FileArchive, Pencil, Trash2 } from 'lucide-react';
import { useAuth } from '../features/auth/useAuth.js';
import { useMessage } from '../context/MessageContext.jsx';
import { t } from '../features/language/LanguageContext.jsx';
import PageHeader from '../components/ui/PageHeader.jsx';
import Button from '../components/ui/Button.jsx';
import Card from '../components/ui/Card.jsx';
import EmptyState from '../components/ui/EmptyState.jsx';
import LoadingState from '../components/ui/LoadingState.jsx';
import {
  loadVehicleAssignments, loadVehicleDetail, loadVehicleFines, removeVehicle, saveVehicle,
} from '../features/vehicles/api.js';
import {
  HOLDER_TYPES, OWNERSHIP_TYPES, VEHICLE_KINDS, VEHICLE_STATUSES, KINDS_WITHOUT_ODOMETER,
} from '../features/vehicles/constants.js';
import { expiryLevel, formatDate, hasActivePolicy, PRE_ACTIVE_STATUSES } from '../features/vehicles/utils/vehicleStatus.js';
import { exportVehicleZip } from '../features/vehicles/utils/exportVehicles.js';
import LifecycleCard from '../features/vehicles/components/LifecycleCard.jsx';
import QuotesPanel from '../features/vehicles/components/QuotesPanel.jsx';
import ExpiryPill from '../features/vehicles/components/ExpiryPill.jsx';
import VehicleFormModal from '../features/vehicles/components/VehicleFormModal.jsx';
import {
  AssignmentsPanel, DocumentsPanel, InspectionsPanel, InsurancePanel, OdometerPanel, TollsPanel,
} from '../features/vehicles/components/VehiclePanels.jsx';
import { FormsPanel, FuelPanel } from '../features/vehicles/components/worker/ManagerWorkerPanels.jsx';
import { loadVehicleForms, loadVehicleFuelReports } from '../features/vehicles/workerApi.js';

function Detail({ label, children }) {
  return (
    <div>
      <small className="muted">{label}</small>
      <div>{children || '—'}</div>
    </div>
  );
}

export default function VehicleDetailPage() {
  useTranslation();
  const { vehicleId } = useParams();
  const navigate = useNavigate();
  const { session, profile, isManager } = useAuth();
  const { setMessage } = useMessage();
  const [detail, setDetail] = useState(undefined);
  const [assignments, setAssignments] = useState([]);
  const [forms, setForms] = useState([]);
  const [fuelReports, setFuelReports] = useState([]);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('overview');
  const [editing, setEditing] = useState(false);
  const [exporting, setExporting] = useState('');
  const userId = session?.user?.id;
  const user = { id: userId, name: profile?.full_name || '' };

  const load = useCallback(async () => {
    try {
      setDetail(await loadVehicleDetail(vehicleId));
      // Assignments arrive with phase 2; the card still works before that migration runs.
      loadVehicleAssignments(vehicleId).then(setAssignments).catch(() => setAssignments([]));
      // Worker forms and fuel reports arrive with the worker flow migration.
      loadVehicleForms(vehicleId).then(setForms).catch(() => setForms([]));
      loadVehicleFuelReports(vehicleId).then(setFuelReports).catch(() => setFuelReports([]));
      setError('');
    } catch (loadError) {
      setError(loadError?.message || t('הטעינה נכשלה.'));
    }
  }, [vehicleId]);

  useEffect(() => {
    load();
  }, [load]);

  if (error) return <EmptyState icon={AlertTriangle} title={error} />;
  if (detail === undefined) return <LoadingState label={t('טוען רכב...')} />;
  if (detail === null) return <EmptyState icon={AlertTriangle} title={t('הרכב לא נמצא')} />;

  const { vehicle, policies, inspections, tolls, readings, documents, quotes } = detail;
  const hasOdometer = !KINDS_WITHOUT_ODOMETER.includes(vehicle.kind);
  const tabs = [
    ['overview', t('סקירה')],
    ['insurance', t('ביטוח')],
    ['quotes', `${t('הצעות ביטוח')}${quotes.some((quote) => quote.status === 'pending') ? ' •' : ''}`],
    ['inspections', t('טסט')],
    ['assignments', t('שיוכים')],
    ['forms', `${t('טפסים')}${forms.some((form) => form.status === 'pending') ? ' •' : ''}`],
    ['fuel', t('דלק')],
    ...(hasOdometer ? [['tolls', t('מנויים')], ['odometer', t('ק"מ')]] : []),
    ['documents', `${t('מסמכים')} (${documents.length})`],
  ];
  const panelProps = { vehicle, canEdit: isManager, userId, onChanged: load };

  // A vehicle still being onboarded cannot be handed over or put in use without a valid policy.
  function assertCanActivate(nextStatus) {
    const activating = nextStatus === 'awaiting_handover' || nextStatus === 'in_use';
    if (activating && PRE_ACTIVE_STATUSES.includes(vehicle.status) && !hasActivePolicy(policies)) {
      throw new Error(t('אי אפשר להעביר את הרכב למסירה / שימוש לפני שיש פוליסה בתוקף.'));
    }
  }

  async function handleSetStatus(status) {
    try {
      assertCanActivate(status);
      await saveVehicle(vehicle.id, { status });
      setMessage(t('הסטטוס עודכן.'));
      await load();
    } catch (statusError) {
      setMessage(statusError?.message || t('העדכון נכשל.'), 'error');
    }
  }

  async function handleExportZip() {
    setExporting(t('מכין קובץ...'));
    try {
      const fines = await loadVehicleFines(vehicle.id);
      const result = await exportVehicleZip(detail, { assignments, fines }, (done, total) => setExporting(`${t('מוריד מסמכים')} ${done}/${total}`));
      setMessage(result.errors ? `${t('הקובץ נוצר. מסמכים שלא הורדו:')} ${result.errors}` : t('הקובץ נוצר.'), result.errors ? 'info' : 'success');
    } catch (exportError) {
      setMessage(exportError?.message || t('הייצוא נכשל.'), 'error');
    } finally {
      setExporting('');
    }
  }

  async function handleSave(payload) {
    assertCanActivate(payload.status);
    await saveVehicle(vehicle.id, payload);
    setEditing(false);
    setMessage(t('הרכב עודכן.'));
    await load();
  }

  async function handleDelete() {
    if (!window.confirm(t('למחוק את הרכב וכל המסמכים והרשומות שלו? הפעולה אינה הפיכה. להוצאה משימוש יש לשנות סטטוס.'))) return;
    try {
      await removeVehicle(vehicle.id, documents);
      setMessage(t('הרכב נמחק.'));
      navigate('/app/vehicles');
    } catch (deleteError) {
      setMessage(deleteError?.message || t('המחיקה נכשלה.'), 'error');
    }
  }

  const latestInsurance = policies[0]?.valid_to;
  const latestInspection = inspections[0]?.valid_to;

  return (
    <>
      <PageHeader
        title={vehicle.plate_number}
        subtitle={[vehicle.make_model, t(VEHICLE_KINDS[vehicle.kind]), t(VEHICLE_STATUSES[vehicle.status])].filter(Boolean).join(' · ')}
        actions={
          <>
            <Link to="/app/vehicles" className="secondary smallBtn"><ArrowRight size={15} /> {t('לרשימה')}</Link>
            <Button variant="secondary" disabled={Boolean(exporting)} onClick={handleExportZip}>
              <FileArchive size={15} /> {exporting || t('ייצוא מסמכים (ZIP)')}
            </Button>
            {isManager && (
              <>
                <Button variant="secondary" onClick={() => setEditing(true)}><Pencil size={15} /> {t('עריכה')}</Button>
                <Button variant="ghost" className="danger" onClick={handleDelete}><Trash2 size={15} /> {t('מחיקה')}</Button>
              </>
            )}
          </>
        }
      />

      <nav className="accountingTabs" aria-label={t('פרטי רכב')}>
        {tabs.map(([key, label]) => (
          <button
            key={key}
            type="button"
            className={`accountingTab${tab === key ? ' active' : ''}`}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </nav>

      {tab === 'overview' && PRE_ACTIVE_STATUSES.includes(vehicle.status) && (
        <LifecycleCard
          vehicle={vehicle}
          quotes={quotes}
          policies={policies}
          canEdit={isManager}
          onSetStatus={handleSetStatus}
          onOpenTab={setTab}
        />
      )}
      {tab === 'overview' && (
        <Card>
          <div className="formGrid">
            <Detail label={t('ביטוח')}>
              <ExpiryPill level={expiryLevel(latestInsurance)} validTo={latestInsurance} />
            </Detail>
            <Detail label={t('טסט')}>
              {vehicle.kind === 'trailer' && !latestInspection
                ? null
                : <ExpiryPill level={expiryLevel(latestInspection)} validTo={latestInspection} />}
            </Detail>
            <Detail label={t('נהג / מחזיק')}>
              {[t(HOLDER_TYPES[vehicle.holder_type]), vehicle.driver_name].filter(Boolean).join(' · ')}
            </Detail>
            <Detail label={t('בעלות')}>
              {[vehicle.ownership && t(OWNERSHIP_TYPES[vehicle.ownership]), vehicle.ownership_label].filter(Boolean).join(' · ')}
            </Detail>
            <Detail label={t('סוכן ביטוח')}>{vehicle.insurance_agent}</Detail>
            <Detail label={t('נכנס לחברה')}>{vehicle.entered_on ? formatDate(vehicle.entered_on) : null}</Detail>
            {vehicle.ownership === 'leasing' && (
              <Detail label={t('חוזה ליסינג')}>
                {vehicle.lease_start || vehicle.lease_end
                  ? `${formatDate(vehicle.lease_start)} – ${formatDate(vehicle.lease_end)}`
                  : null}
              </Detail>
            )}
            {hasOdometer && (
              <Detail label={t('ק"מ אחרון')}>{vehicle.current_odometer?.toLocaleString('he-IL')}</Detail>
            )}
            <Detail label={t('שנת יצור')}>{vehicle.manufacture_year}{vehicle.is_electric ? ` · ${t('חשמלי')}` : ''}</Detail>
            {vehicle.status === 'retired' && (
              <Detail label={t('הוצא משימוש')}>
                {[vehicle.retired_on && formatDate(vehicle.retired_on), vehicle.retired_reason].filter(Boolean).join(' · ')}
              </Detail>
            )}
            <Detail label={t('הערות')}>{vehicle.notes}</Detail>
          </div>
        </Card>
      )}
      {tab === 'insurance' && <InsurancePanel {...panelProps} policies={policies} />}
      {tab === 'quotes' && <QuotesPanel {...panelProps} quotes={quotes} documents={documents} user={user} />}
      {tab === 'inspections' && <InspectionsPanel {...panelProps} inspections={inspections} />}
      {tab === 'tolls' && <TollsPanel {...panelProps} tolls={tolls} />}
      {tab === 'odometer' && <OdometerPanel {...panelProps} readings={readings} />}
      {tab === 'assignments' && <AssignmentsPanel assignments={assignments} />}
      {tab === 'forms' && <FormsPanel {...panelProps} forms={forms} user={user} />}
      {tab === 'fuel' && <FuelPanel reports={fuelReports} />}
      {tab === 'documents' && <DocumentsPanel {...panelProps} documents={documents} />}

      {editing && <VehicleFormModal vehicle={vehicle} onSave={handleSave} onClose={() => setEditing(false)} />}
    </>
  );
}
