import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Car, ClipboardList, FileSpreadsheet, FileCheck2, Gauge, Plus, ShieldAlert, Upload, UserCheck, Users, Receipt } from 'lucide-react';
import { useAuth } from '../features/auth/useAuth.js';
import { useMessage } from '../context/MessageContext.jsx';
import { t } from '../features/language/LanguageContext.jsx';
import PageHeader from '../components/ui/PageHeader.jsx';
import Button from '../components/ui/Button.jsx';
import Card from '../components/ui/Card.jsx';
import EmptyState from '../components/ui/EmptyState.jsx';
import LoadingState from '../components/ui/LoadingState.jsx';
import Stat from '../components/Stat.jsx';
import { createVehicle, importVehicles, isSchemaMissing, linkVehicleDrivers, loadFleetExportData, loadFleetOverview } from '../features/vehicles/api.js';
import {
  HOLDER_TYPES, OWNERSHIP_TYPES, TOLL_SHORT_LABELS, VEHICLE_KINDS, VEHICLE_STATUSES,
} from '../features/vehicles/constants.js';
import {
  attentionScore, buildVehicleSummaries, hasAlert, hasMissingData,
} from '../features/vehicles/utils/vehicleStatus.js';
import ExpiryPill from '../features/vehicles/components/ExpiryPill.jsx';
import VehicleFormModal from '../features/vehicles/components/VehicleFormModal.jsx';
import { exportFleetWorkbook } from '../features/vehicles/utils/exportVehicles.js';
import VehicleImportModal from '../features/vehicles/components/VehicleImportModal.jsx';
import DriverMatchModal from '../features/vehicles/components/DriverMatchModal.jsx';

const FOCUS_FILTERS = {
  attention: hasAlert,
  missing: hasMissingData,
  odometer: (summary) => summary.odometerMissing,
  quotes: (summary) => summary.hasPendingQuote,
};

export default function VehiclesPage() {
  useTranslation();
  const { session, isManager } = useAuth();
  const { setMessage } = useMessage();
  const [data, setData] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('active');
  const [focus, setFocus] = useState(null);
  const [dialog, setDialog] = useState(null);
  const userId = session?.user?.id;

  const load = useCallback(async () => {
    try {
      setData(await loadFleetOverview());
      setLoadError('');
    } catch (error) {
      setLoadError(
        isSchemaMissing(error)
          ? t('טבלאות הרכבים עדיין לא קיימות במסד הנתונים. יש להריץ את המיגרציה.')
          : error?.message || t('הטעינה נכשלה.'),
      );
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const summaries = useMemo(() => (data ? buildVehicleSummaries({ ...data }) : []), [data]);

  const tollsByVehicle = useMemo(() => {
    const map = new Map();
    for (const toll of data?.tolls || []) {
      if (!map.has(toll.vehicle_id)) map.set(toll.vehicle_id, []);
      map.get(toll.vehicle_id).push(toll);
    }
    return map;
  }, [data]);

  const counts = useMemo(() => {
    const active = summaries.filter((s) => s.vehicle.status !== 'retired');
    return {
      active: active.length,
      attention: active.filter(FOCUS_FILTERS.attention).length,
      missing: active.filter(FOCUS_FILTERS.missing).length,
      odometer: active.filter(FOCUS_FILTERS.odometer).length,
      quotes: active.filter(FOCUS_FILTERS.quotes).length,
    };
  }, [summaries]);

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    return summaries
      .filter((summary) => {
        const { vehicle } = summary;
        const statusOk =
          statusFilter === 'active' ? vehicle.status !== 'retired'
          : statusFilter === 'all' ? true
          : vehicle.status === statusFilter;
        if (!statusOk) return false;
        if (focus && !FOCUS_FILTERS[focus](summary)) return false;
        if (!query) return true;
        return [vehicle.plate_number, vehicle.make_model, vehicle.driver_name, vehicle.ownership_label]
          .join(' ')
          .toLowerCase()
          .includes(query);
      })
      .sort(
        (a, b) =>
          attentionScore(b) - attentionScore(a) ||
          a.vehicle.plate_number.localeCompare(b.vehicle.plate_number, 'he', { numeric: true }),
      );
  }, [summaries, search, statusFilter, focus]);

  async function handleExport() {
    try {
      await exportFleetWorkbook(await loadFleetExportData());
      setMessage(t('הקובץ נוצר.'));
    } catch (exportError) {
      setMessage(exportError?.message || t('הייצוא נכשל.'), 'error');
    }
  }

  async function handleCreate(payload) {
    await createVehicle(payload, userId);
    setDialog(null);
    setMessage(t('הרכב נוסף.'));
    await load();
  }

  async function handleLinkDrivers(links) {
    await linkVehicleDrivers(links);
    setDialog(null);
    setMessage(`${t('קושרו')} ${links.length} ${t('נהגים למשתמשים')}`);
    await load();
  }

  async function handleImport(parsedVehicles) {
    const result = await importVehicles(parsedVehicles, data.vehicles, userId);
    setDialog(null);
    setMessage(`${t('יובאו')} ${result.created} ${t('רכבים')}${result.skipped ? ` · ${result.skipped} ${t('דולגו (כבר קיימים)')}` : ''}`);
    await load();
  }

  const unlinkedDrivers = data
    ? data.vehicles.filter((v) => v.holder_type !== 'company' && v.driver_name && !v.driver_id).length
    : 0;

  const toggleFocus = (key) => setFocus((current) => (current === key ? null : key));

  if (loadError) return <EmptyState icon={AlertTriangle} title={loadError} />;
  if (!data) return <LoadingState label={t('טוען רכבים...')} />;

  return (
    <>
      <PageHeader
        title={t('רכבי חברה')}
        subtitle={t('ניהול הצי, ביטוחים, טסטים ומסמכים')}
        actions={
          <>
            <Link to="/app/vehicles/fines" className="secondary smallBtn">
              <Receipt size={16} /> {t('דוחות')}
            </Link>
            <Button variant="secondary" onClick={handleExport}>
              <FileSpreadsheet size={16} /> {t('ייצוא לאקסל')}
            </Button>
            {isManager && (
            <>
              {unlinkedDrivers > 0 && (
                <Button variant="secondary" onClick={() => setDialog('drivers')}>
                  <Users size={16} /> {t('התאמת נהגים')} ({unlinkedDrivers})
                </Button>
              )}
              <Button variant="secondary" onClick={() => setDialog('import')}>
                <Upload size={16} /> {t('ייבוא מטבלה')}
              </Button>
              <Button onClick={() => setDialog('new')}>
                <Plus size={16} /> {t('רכב חדש')}
              </Button>
            </>
            )}
          </>
        }
      />

      <div className="grid">
        <Stat
          icon={<Car size={22} />}
          number={counts.active}
          label="רכבים פעילים"
          active={focus === null}
          onClick={() => setFocus(null)}
        />
        <Stat
          icon={<ShieldAlert size={22} />}
          number={counts.attention}
          label="פג תוקף / קרוב לפקיעה"
          active={focus === 'attention'}
          onClick={() => toggleFocus('attention')}
        />
        <Stat
          icon={<ClipboardList size={22} />}
          number={counts.missing}
          label="חסר מידע (ביטוח / טסט)"
          active={focus === 'missing'}
          onClick={() => toggleFocus('missing')}
        />
        {counts.quotes > 0 && (
          <Stat
            icon={<FileCheck2 size={22} />}
            number={counts.quotes}
            label="הצעות ביטוח לאישור"
            active={focus === 'quotes'}
            onClick={() => toggleFocus('quotes')}
          />
        )}
        <Stat
          icon={<Gauge size={22} />}
          number={counts.odometer}
          label={'לא דווח ק"מ החודש'}
          active={focus === 'odometer'}
          onClick={() => toggleFocus('odometer')}
        />
      </div>

      <div className="toolbar">
        <input
          type="search"
          aria-label={t('חיפוש')}
          placeholder={t('חיפוש לפי מספר, דגם או נהג')}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
          <option value="active">{t('פעילים')}</option>
          <option value="all">{t('הכל')}</option>
          {Object.entries(VEHICLE_STATUSES).map(([value, label]) => (
            <option key={value} value={value}>{t(label)}</option>
          ))}
        </select>
      </div>

      {visible.length === 0 ? (
        <EmptyState
          icon={Car}
          title={data.vehicles.length ? t('אין רכבים התואמים לסינון') : t('עדיין אין רכבים במערכת')}
          description={isManager && !data.vehicles.length ? t('אפשר להוסיף רכב או לייבא את הטבלה הקיימת.') : undefined}
        />
      ) : (
        <Card className="equipmentTableWrap">
          <table className="equipmentTable">
            <thead>
              <tr>
                <th>{t('רכב')}</th>
                <th>{t('נהג / מחזיק')}</th>
                <th>{t('בעלות')}</th>
                <th>{t('מנויים')}</th>
                <th>{t('ביטוח')}</th>
                <th>{t('טסט')}</th>
                <th className="num">{t('ק"מ')}</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((summary) => {
                const { vehicle } = summary;
                const tolls = tollsByVehicle.get(vehicle.id) || [];
                const ownership = [
                  vehicle.ownership && t(OWNERSHIP_TYPES[vehicle.ownership]),
                  vehicle.ownership_label,
                ].filter(Boolean).join(' · ');
                return (
                  <tr key={vehicle.id}>
                    <td>
                      <Link to={`/app/vehicles/${vehicle.id}`}>
                        <bdi><b>{vehicle.plate_number}</b></bdi>
                      </Link>
                      <div>
                        <small className="muted">
                          {[vehicle.make_model, vehicle.manufacture_year, t(VEHICLE_KINDS[vehicle.kind])]
                            .filter(Boolean)
                            .join(' · ')}
                        </small>
                      </div>
                      {vehicle.status !== 'in_use' && (
                        <span className="pill neutral">{t(VEHICLE_STATUSES[vehicle.status])}</span>
                      )}
                    </td>
                    <td>
                      {vehicle.holder_type !== 'driver' && (
                        <span className="pill neutral">{t(HOLDER_TYPES[vehicle.holder_type])}</span>
                      )}{' '}
                      {vehicle.driver_name || (vehicle.holder_type === 'driver' ? '—' : '')}
                      {vehicle.driver_id && (
                        <UserCheck size={14} aria-label={t('מקושר למשתמש במערכת')} />
                      )}
                    </td>
                    <td>{ownership || '—'}</td>
                    <td>
                      {tolls.length === 0 ? '—' : tolls.map((toll) => (
                        <span key={toll.id} className="pill neutral">{t(TOLL_SHORT_LABELS[toll.kind])}</span>
                      ))}
                    </td>
                    <td><ExpiryPill level={summary.insuranceLevel} validTo={summary.insuranceValidTo} /></td>
                    <td>
                      {vehicle.kind === 'trailer' && !summary.inspectionValidTo
                        ? '—'
                        : <ExpiryPill level={summary.inspectionLevel} validTo={summary.inspectionValidTo} />}
                    </td>
                    <td className="num">
                      {vehicle.current_odometer?.toLocaleString('he-IL') ?? '—'}
                      {summary.odometerMissing && (
                        <div><small className="muted">{t('לא דווח החודש')}</small></div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}

      {dialog === 'new' && <VehicleFormModal defaultStatus="expected" onSave={handleCreate} onClose={() => setDialog(null)} />}
      {dialog === 'drivers' && (
        <DriverMatchModal
          vehicles={data.vehicles}
          drivers={data.drivers}
          onSave={handleLinkDrivers}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog === 'import' && (
        <VehicleImportModal
          existingVehicles={data.vehicles}
          onImport={handleImport}
          onClose={() => setDialog(null)}
        />
      )}
    </>
  );
}
