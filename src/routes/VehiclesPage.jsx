import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Car, ChevronDown, Download, Fuel, Pencil, Plus, RefreshCw, Search, Upload, X } from 'lucide-react';
import { useAuth } from '../features/auth/useAuth.js';
import { useMessage } from '../context/MessageContext.jsx';
import { t } from '../features/language/LanguageContext.jsx';
import { useRealtimeRefresh } from '../hooks/useRealtimeRefresh.js';
import { importVehicles, loadVehicles, saveVehicle, saveVehicleMileage } from '../features/vehicles/api.js';
import { filterVehicles, formatVehicleValue, getVehiclePlateKey, hasFuelCard, VEHICLE_EXPORT_FIELDS, VEHICLE_FIELDS } from '../features/vehicles/vehicleRegister.js';
import { downloadVehicleWorkbook, readVehicleWorkbook } from '../features/vehicles/workbook.js';
import PageHeader from '../components/ui/PageHeader.jsx';
import '../features/vehicles/vehicles.css';

function errorText(error) {
  if (error?.code === '23505') return t('מספר הרכב כבר קיים ברשימה.');
  if (error?.code === '42P01' || error?.code === 'PGRST205') return t('רשימת הרכבים טרם הוגדרה במערכת.');
  return t(error?.message || 'הפעולה נכשלה. נסו שוב.');
}

function VehicleDialog({ title, busy, onClose, children }) {
  const ref = useRef(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog.showModal();
    return () => { if (dialog.open) dialog.close(); };
  }, []);
  return (
    <dialog ref={ref} className="vehicleDialog" aria-label={title} onCancel={(event) => {
      event.preventDefault();
      if (!busy) onClose();
    }}>
      <header><h2>{title}</h2><button className="ghost iconOnly" type="button" aria-label={t('סגירה')} disabled={busy} onClick={onClose}><X size={20} /></button></header>
      {children}
    </dialog>
  );
}

function VehicleDetails({ record }) {
  return <dl className="vehicleDetails">{VEHICLE_EXPORT_FIELDS.map(({ key, label }) => (
    <div key={key}><dt>{t(label)}</dt><dd dir="auto">{formatVehicleValue(record[key])}</dd></div>
  ))}</dl>;
}

function VehicleMileage({ record, disabled, onSaved }) {
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const savingRef = useRef(false);
  const { setMessage } = useMessage();

  async function submit(event) {
    event.preventDefault();
    if (disabled || savingRef.current || draft === null) return;
    savingRef.current = true;
    setSaving(true);
    setError('');
    try {
      const saved = await saveVehicleMileage(record.id, draft);
      onSaved(saved);
      setDraft(null);
      setMessage(t('הקילומטראז׳ נשמר.'), 'success');
    } catch (failure) { setError(errorText(failure)); }
    finally { savingRef.current = false; setSaving(false); }
  }

  return <form className="vehicleMileage" onSubmit={submit}>
    <label htmlFor={`mileage-${record.id}`}>{t('קילומטראז׳ עדכני')} ({t('ק״מ')})</label>
    <div className="vehicleMileageControls">
      <input id={`mileage-${record.id}`} type="number" min="0" max="2147483647" step="1" inputMode="numeric" dir="ltr" value={draft ?? record.current_mileage ?? ''} placeholder="—" disabled={disabled || saving} aria-describedby={error ? `mileage-error-${record.id}` : undefined} onChange={(event) => { setDraft(event.target.value); setError(''); }} />
      <button type="submit" className="secondary smallBtn" disabled={disabled || saving || draft === null}>{t(saving ? 'שומר...' : 'שמירה')}</button>
    </div>
    {error && <p id={`mileage-error-${record.id}`} className="vehicleMileageError" role="alert">{error}</p>}
  </form>;
}

function VehicleEditor({ record, busy, error, onClose, onSave }) {
  const [draft, setDraft] = useState(record);
  return (
    <VehicleDialog title={t(record.id ? 'עריכת רכב' : 'הוספת רכב')} busy={busy} onClose={onClose}>
      <form onSubmit={(event) => { event.preventDefault(); onSave(draft); }}>
        <p className="vehicleHint">{t('אפשר להזין תאריך, סימון V או הערה לפי הטבלה. קוד נוסף לרכב ניתן להזין בשורה השנייה של מספר הרכב.')}</p>
        <div className="vehicleEditorFields">{VEHICLE_FIELDS.map(({ key, label }) => (
          <div className="vehicleEditorField" key={key}>
            <label htmlFor={`vehicle-${key}`}>{t(label)}{key === 'plate_number' && ' *'}</label>
            {['plate_number', 'insurance_agent', 'driver_name'].includes(key) ? (
              <textarea id={`vehicle-${key}`} rows={2} required={key === 'plate_number'} disabled={busy} value={draft[key] || ''} dir="auto" onChange={(event) => setDraft({ ...draft, [key]: event.target.value })} />
            ) : (
              <input id={`vehicle-${key}`} disabled={busy} value={draft[key] || ''} dir="auto" list={key === 'fuel_card' ? 'vehicle-fuel-values' : undefined} onChange={(event) => setDraft({ ...draft, [key]: event.target.value })} />
            )}
          </div>
        ))}</div>
        <datalist id="vehicle-fuel-values"><option value="V" /><option value="בביטול" /></datalist>
        {error && <p className="vehicleError" role="alert">{error}</p>}
        <footer><button type="button" className="secondary" disabled={busy} onClick={onClose}>{t('ביטול')}</button><button type="submit" disabled={busy}>{t(busy ? 'שומר...' : 'שמירה')}</button></footer>
      </form>
    </VehicleDialog>
  );
}

export default function VehiclesPage() {
  useTranslation();
  const { isManager } = useAuth();
  const { setMessage } = useMessage();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState('');
  const [ownership, setOwnership] = useState('');
  const [fuel, setFuel] = useState('');
  const [editor, setEditor] = useState(null);
  const [editorError, setEditorError] = useState('');
  const [pendingImport, setPendingImport] = useState(null);
  const [importError, setImportError] = useState('');
  const [busy, setBusy] = useState(false);
  const [fileBusy, setFileBusy] = useState(false);
  const fileRef = useRef(null);

  const refresh = useCallback(async () => {
    try {
      setRecords(await loadVehicles());
      setLoadError('');
    } catch (error) { setLoadError(errorText(error)); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { if (isManager) refresh(); }, [isManager, refresh]);
  useRealtimeRefresh({ enabled: isManager, channelName: 'manager-vehicles', tables: ['manager_vehicles'], onRefresh: refresh });

  const visible = useMemo(() => filterVehicles(records, { search, ownership, fuel }), [records, search, ownership, fuel]);
  const owners = useMemo(() => [...new Set(records.map((record) => record.ownership).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'he')), [records]);
  const existingKeys = useMemo(() => new Set(records.map((record) => getVehiclePlateKey(record.plate_number))), [records]);
  const updatedCount = pendingImport?.records.filter((record) => existingKeys.has(getVehiclePlateKey(record.plate_number))).length || 0;
  const ready = !loading && !loadError && !busy && !fileBusy;

  function openEditor(record = {}) {
    setEditorError('');
    setEditor(record);
  }

  function replaceSavedRecord(saved) {
    setRecords((current) => [...current.filter((record) => record.id !== saved.id), saved].sort((a, b) => a.plate_key.localeCompare(b.plate_key)));
  }

  async function submitEditor(draft) {
    if (busy) return;
    setBusy(true);
    setEditorError('');
    try {
      const saved = await saveVehicle(draft);
      replaceSavedRecord(saved);
      setEditor(null);
      setMessage(t('פרטי הרכב נשמרו.'), 'success');
    } catch (error) { setEditorError(errorText(error)); }
    finally { setBusy(false); }
  }

  async function selectFile(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { setMessage(t('יש לבחור קובץ בגודל עד 10 MB.'), 'error'); return; }
    setFileBusy(true);
    setImportError('');
    try { setPendingImport({ name: file.name, records: await readVehicleWorkbook(file) }); }
    catch (error) { setMessage(errorText(error), 'error'); }
    finally { setFileBusy(false); }
  }

  async function confirmImport() {
    if (busy) return;
    setBusy(true);
    setImportError('');
    try {
      await importVehicles(pendingImport.records);
      setPendingImport(null);
      setMessage(t('ייבוא הרכבים הושלם.'), 'success');
      await refresh();
    } catch (error) { setImportError(errorText(error)); }
    finally { setBusy(false); }
  }

  async function exportRecords() {
    setFileBusy(true);
    try { await downloadVehicleWorkbook(visible); }
    catch (error) { setMessage(errorText(error), 'error'); }
    finally { setFileBusy(false); }
  }

  if (!isManager) return <Navigate to="/app/projects" replace />;

  return (
    <div className="vehiclesPage">
      <PageHeader title={t('רכבים')} subtitle={t('ניהול רכבי החברה, נהגים, דלקנים, כבישי אגרה וביטוח.')} actions={<>
        <button type="button" onClick={() => openEditor()} disabled={!ready}><Plus size={17} />{t('הוספת רכב')}</button>
        <button type="button" className="secondary" onClick={() => fileRef.current?.click()} disabled={!ready}><Upload size={17} />{t(fileBusy ? 'מעבד קובץ...' : 'ייבוא Excel')}</button>
        <button type="button" className="secondary" onClick={exportRecords} disabled={!ready || !visible.length}><Download size={17} />{t('ייצוא הרשימה')}</button>
        <input ref={fileRef} type="file" accept=".xlsx" hidden aria-label={t('ייבוא Excel')} onChange={selectFile} />
      </>} />
      <div className="vehicleMetrics">
        <div><Car size={24} /><strong>{loading ? '—' : records.length}</strong><span>{t('רכבים ברשימה')}</span></div>
        <div><Fuel size={24} /><strong>{loading ? '—' : records.filter((record) => hasFuelCard(record.fuel_card)).length}</strong><span>{t('דלקנים פעילים לפי הטבלה')}</span></div>
        <div><Search size={24} /><strong>{loading ? '—' : visible.length}</strong><span>{t('רכבים בתצוגה')}</span></div>
      </div>
      {loadError && <div className="vehicleError" role="alert"><p>{loadError}</p><button type="button" className="secondary" onClick={refresh}><RefreshCw size={16} />{t('נסה שוב')}</button></div>}
      <section className="vehicleRegister" aria-label={t('רשימת רכבים')}>
        <div className="vehicleFilters">
          <label>{t('חיפוש')}<input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t('מספר רכב, נהג, סוג רכב או פסקל')} /></label>
          <label>{t('בעלות רכב')}<select value={ownership} onChange={(event) => setOwnership(event.target.value)}><option value="">{t('כל הבעלויות')}</option>{owners.map((owner) => <option key={owner} value={owner}>{owner}</option>)}</select></label>
          <label>{t('דלקן')}<select value={fuel} onChange={(event) => setFuel(event.target.value)}><option value="">{t('כל הרכבים')}</option><option value="yes">{t('דלקן פעיל')}</option><option value="no">{t('ללא דלקן פעיל')}</option></select></label>
        </div>
        {loading ? <p className="vehicleEmpty" role="status">{t('טוען רכבים...')}</p> : !visible.length ? <p className="vehicleEmpty">{t(records.length ? 'לא נמצאו רכבים מתאימים לחיפוש.' : 'אין רכבים ברשימה. אפשר להוסיף רכב או לייבא Excel.')}</p> : (
          <div className="vehicleList">{visible.map((record) => (
            <article key={record.id} className="vehicleCard">
              <div className="vehicleCardHeading">
                <span className="vehicleCarIcon"><Car size={22} /></span>
                <div><h3><bdi dir="ltr">{record.plate_number.split('\n')[0]}</bdi></h3><p>{record.vehicle_type || '—'}</p></div>
                <button type="button" className="secondary" disabled={!ready} aria-label={`${t('עריכת רכב')} ${record.plate_number}`} onClick={() => openEditor(record)}><Pencil size={16} />{t('עריכה')}</button>
              </div>
              <dl className="vehicleSummary">
                <div className="vehicleDriverDetails"><dt>{t('שם נהג')}</dt><dd>{record.driver_name || '—'}</dd><dd><VehicleMileage record={record} disabled={!ready} onSaved={replaceSavedRecord} /></dd></div>
                <div><dt>{t('בעלות רכב')}</dt><dd>{record.ownership || '—'}</dd></div>
                <div><dt>{t('דלקן')}</dt><dd><span className={`vehicleFuelBadge ${hasFuelCard(record.fuel_card) ? 'active' : ''}`}>{record.fuel_card || '—'}</span></dd></div>
                <div><dt>{t('סוכן ביטוח')}</dt><dd>{record.insurance_agent || '—'}</dd></div>
              </dl>
              <details><summary>{t('כל פרטי הרכב')}<ChevronDown size={16} /></summary><VehicleDetails record={record} /></details>
            </article>
          ))}</div>
        )}
      </section>
      {editor && <VehicleEditor record={editor} busy={busy} error={editorError} onClose={() => setEditor(null)} onSave={submitEditor} />}
      {pendingImport && <VehicleDialog title={t('תצוגה מקדימה לייבוא')} busy={busy} onClose={() => setPendingImport(null)}>
        <p dir="auto">{pendingImport.name}</p>
        <p>{t('רכבים בקובץ')}: <b>{pendingImport.records.length}</b> · {t('רכבים חדשים')}: <b>{pendingImport.records.length - updatedCount}</b> · {t('רכבים לעדכון')}: <b>{updatedCount}</b></p>
        <p className="vehicleHint">{t('הייבוא מעדכן את כל פרטי הרכבים שמופיעים בקובץ לפי מספר הרכב, כולל תאים ריקים. רכבים שאינם בקובץ נשמרים ברשימה.')}</p>
        <div className="vehicleImportPreview">{pendingImport.records.map((record) => <div key={getVehiclePlateKey(record.plate_number)}><bdi dir="ltr">{record.plate_number.split('\n')[0]}</bdi><span>{record.vehicle_type}</span><span>{record.driver_name}</span></div>)}</div>
        {importError && <p className="vehicleError" role="alert">{importError}</p>}
        <footer><button type="button" className="secondary" disabled={busy} onClick={() => setPendingImport(null)}>{t('ביטול')}</button><button type="button" disabled={busy || Boolean(loadError)} onClick={confirmImport}>{t(busy ? 'שומר...' : 'אישור ייבוא')}</button></footer>
      </VehicleDialog>}
    </div>
  );
}
