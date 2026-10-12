import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, ArrowRight, Pencil, Trash2 } from 'lucide-react';
import { useAuth } from '../features/auth/useAuth.js';
import { useMessage } from '../context/MessageContext.jsx';
import { t } from '../features/language/LanguageContext.jsx';
import PageHeader from '../components/ui/PageHeader.jsx';
import Button from '../components/ui/Button.jsx';
import Card from '../components/ui/Card.jsx';
import EmptyState from '../components/ui/EmptyState.jsx';
import LoadingState from '../components/ui/LoadingState.jsx';
import { loadVehicleAssignments, loadVehicleDetail, removeVehicle, saveVehicle } from '../features/vehicles/api.js';
import {
  HOLDER_TYPES, OWNERSHIP_TYPES, VEHICLE_KINDS, VEHICLE_STATUSES, KINDS_WITHOUT_ODOMETER,
} from '../features/vehicles/constants.js';
import { expiryLevel, formatDate } from '../features/vehicles/utils/vehicleStatus.js';
import ExpiryPill from '../features/vehicles/components/ExpiryPill.jsx';
import VehicleFormModal from '../features/vehicles/components/VehicleFormModal.jsx';
import {
  AssignmentsPanel, DocumentsPanel, InspectionsPanel, InsurancePanel, OdometerPanel, TollsPanel,
} from '../features/vehicles/components/VehiclePanels.jsx';

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
  const { session, isManager } = useAuth();
  const { setMessage } = useMessage();
  const [detail, setDetail] = useState(undefined);
  const [assignments, setAssignments] = useState([]);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('overview');
  const [editing, setEditing] = useState(false);
  const userId = session?.user?.id;

  const load = useCallback(async () => {
    try {
      setDetail(await loadVehicleDetail(vehicleId));
      // Assignments arrive with phase 2; the card still works before that migration runs.
      loadVehicleAssignments(vehicleId).then(setAssignments).catch(() => setAssignments([]));
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

  const { vehicle, policies, inspections, tolls, readings, documents } = detail;
  const hasOdometer = !KINDS_WITHOUT_ODOMETER.includes(vehicle.kind);
  const tabs = [
    ['overview', t('סקירה')],
    ['insurance', t('ביטוח')],
    ['inspections', t('טסט')],
    ['assignments', t('שיוכים')],
    ...(hasOdometer ? [['tolls', t('מנויים')], ['odometer', t('ק"מ')]] : []),
    ['documents', `${t('מסמכים')} (${documents.length})`],
  ];
  const panelProps = { vehicle, canEdit: isManager, userId, onChanged: load };

  async function handleSave(payload) {
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
      {tab === 'inspections' && <InspectionsPanel {...panelProps} inspections={inspections} />}
      {tab === 'tolls' && <TollsPanel {...panelProps} tolls={tolls} />}
      {tab === 'odometer' && <OdometerPanel {...panelProps} readings={readings} />}
      {tab === 'assignments' && <AssignmentsPanel assignments={assignments} />}
      {tab === 'documents' && <DocumentsPanel {...panelProps} documents={documents} />}

      {editing && <VehicleFormModal vehicle={vehicle} onSave={handleSave} onClose={() => setEditing(false)} />}
    </>
  );
}
