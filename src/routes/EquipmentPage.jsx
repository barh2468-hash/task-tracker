import { useEffect, useMemo, useRef, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  AlertTriangle,
  Boxes,
  CalendarDays,
  CheckCircle,
  ClipboardCheck,
  ChevronDown,
  ChevronUp,
  Database,
  Download,
  FileSpreadsheet,
  HardHat,
  Package,
  Pencil,
  Minus,
  Plus,
  Search,
  Save,
  Upload,
  UserRound,
  Users,
  Wrench,
  X,
} from 'lucide-react';
import { useAuth } from '../features/auth/useAuth.js';
import { useMessage } from '../context/MessageContext.jsx';
import { t, useLanguage } from '../features/language/LanguageContext.jsx';
import {
  addEquipmentRecord,
  loadLatestEquipmentSnapshot,
  saveEquipmentRecord,
  saveEquipmentSnapshot,
} from '../features/equipment/api.js';
import {
  isUnreadableEquipmentText,
  parseEquipmentFile,
} from '../features/equipment/utils/parseEquipmentCsv.js';
import { exportEquipmentWorkbook } from '../features/equipment/utils/exportEquipmentWorkbook.js';
import {
  EQUIPMENT_CHECKLIST_COLUMNS,
  getEquipmentQuantity,
  getEquipmentQuantityTotal,
  toEquipmentQuantityCell,
} from '../features/equipment/utils/equipmentQuantities.js';

const DEVICE_COLUMNS = [1, 2, 3, 4, 13, 14, 34];
const EDITOR_TEXT_COLUMNS = [1, 2, 3, 4, 13, 14, 15, 34, 35, 36];
function hasDatabaseSchemaError(error) {
  return error?.code === '42P01' || error?.code === 'PGRST205';
}

function formatPeriod(value, language) {
  if (!value) return t('ללא תאריך');
  return new Intl.DateTimeFormat(language === 'he' ? 'he-IL' : language, {
    month: 'long',
    year: 'numeric',
  }).format(new Date(`${value.slice(0, 10)}T12:00:00`));
}

function getDeviceValues(record) {
  return DEVICE_COLUMNS.map((index) => record.cells?.[index])
    .filter(Boolean)
    .filter((value) => !/^v$/i.test(value) && value !== '-' && !isUnreadableEquipmentText(value));
}

function formatEquipmentValue(value) {
  if (!isUnreadableEquipmentText(value)) return value;
  const readablePart = value.replace(/[?\s'"]+/g, ' ').trim();
  return readablePart
    ? `${t('לא קריא במקור')} · ${readablePart}`
    : t('לא קריא במקור');
}

function EquipmentMetric({ icon: Icon, value, label, tone }) {
  return (
    <div className={`equipmentMetric ${tone || ''}`}>
      <span className="equipmentMetricIcon">
        <Icon size={21} />
      </span>
      <div>
        <strong>{value}</strong>
        <span>{t(label)}</span>
      </div>
    </div>
  );
}

function EquipmentDetails({ record, headers }) {
  const populatedCells = (record.cells || [])
    .map((value, index) => ({ index, label: headers[index] || `${t('עמודה')} ${index + 1}`, value }))
    .filter(({ index, value }) => index > 0 && (value || EQUIPMENT_CHECKLIST_COLUMNS.includes(index)));

  return (
    <div className="equipmentDetails">
      {record.source_name_unreadable && (
        <div className="equipmentNameWarning">
          <AlertTriangle size={16} />
          <span>{t('שם העובד לא קריא בקובץ המקורי.')}</span>
        </div>
      )}
      <div className="equipmentDetailsGrid">
        {populatedCells.map(({ index, label, value }) => {
          const isQuantityCell = EQUIPMENT_CHECKLIST_COLUMNS.includes(index);
          const quantity = isQuantityCell
            ? getEquipmentQuantity(value)
            : 0;
          const checked = quantity > 0;
          const unavailable = isQuantityCell ? quantity === 0 : value === '-';
          const unreadable = isUnreadableEquipmentText(value);
          return (
            <div
              className={`equipmentDetailItem${checked ? ' checked' : ''}${unavailable ? ' unavailable' : ''}${unreadable ? ' unreadable' : ''}`}
              key={`${record.id || record.source_row_number}-${index}`}
            >
              <span>{label}</span>
              <b>
                {isQuantityCell
                  ? `${t('כמות')}: ${quantity}`
                  : unavailable
                    ? t('לא מסומן')
                    : formatEquipmentValue(value)}
              </b>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function EquipmentEditor({ draft, headers, sections, saving, error, onChange, onQuantityChange, onClose, onSave }) {
  const isNew = !draft.id;

  return (
    <div className="equipmentEditorBackdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !saving) onClose();
    }}>
      <section className="equipmentEditor" role="dialog" aria-modal="true" aria-labelledby="equipment-editor-title">
        <header className="equipmentEditorHeader">
          <div className="equipmentEditorTitle">
            <span><Pencil size={20} /></span>
            <div>
              <small>{t(isNew ? 'עובד חדש' : 'עריכת כרטיס ציוד')}</small>
              <h3 id="equipment-editor-title">{draft.worker_name || t('עובד חדש')}</h3>
            </div>
          </div>
          <button type="button" className="equipmentEditorClose" onClick={onClose} disabled={saving} aria-label={t('סגירה')}>
            <X size={21} />
          </button>
        </header>

        <form onSubmit={onSave} className="equipmentEditorForm">
          <div className="equipmentEditorIntro">
            <div>
              <UserRound size={18} />
              <span>{t('פרטי העובד')}</span>
            </div>
            <p>{t('כל שינוי נשמר מיד בריכוז הציוד המשותף.')}</p>
          </div>

          <div className="equipmentEditorBasics">
            <label>
              <span>{t('שם העובד')}</span>
              <input
                value={draft.worker_name}
                onChange={(event) => onChange('worker_name', event.target.value)}
                placeholder={t('שם מלא')}
              />
            </label>
            <label>
              <span>{t('קבוצה')}</span>
              <input
                value={draft.section_name}
                onChange={(event) => onChange('section_name', event.target.value)}
                placeholder={t('לדוגמה: עובדי שטח')}
                list="equipment-section-options"
              />
              <datalist id="equipment-section-options">
                {sections.map((sectionName) => <option value={sectionName} key={sectionName} />)}
              </datalist>
            </label>
          </div>

          <div className="equipmentEditorSection">
            <div className="equipmentEditorSectionTitle">
              <Wrench size={17} />
              <div>
                <b>{t('מכשירים, מזהים והערות')}</b>
                <span>{t('אפשר לעדכן דגמים, מספרים סידוריים ומידע נוסף.')}</span>
              </div>
            </div>
            <div className="equipmentEditorFields">
              {EDITOR_TEXT_COLUMNS.filter((index) => headers[index]).map((index) => (
                <label key={index} className={index >= 34 ? 'wide' : ''}>
                  <span>{headers[index]}</span>
                  <input
                    value={draft.cells[index] || ''}
                    onChange={(event) => onChange('cell', event.target.value, index)}
                    placeholder={t('לא הוזן')}
                    dir="auto"
                  />
                </label>
              ))}
            </div>
          </div>

          <div className="equipmentEditorSection">
            <div className="equipmentEditorSectionTitle">
              <ClipboardCheck size={17} />
              <div>
                <b>{t('ציוד אישי וכלי עבודה')}</b>
                <span>{t('הגדירו כמות לכל אביזר באמצעות כפתורי הפלוס והמינוס.')}</span>
              </div>
              <strong>{draft.checked_item_count} {t('יחידות')}</strong>
            </div>
            <div className="equipmentChecklistEditor">
              {EQUIPMENT_CHECKLIST_COLUMNS.filter((index) => headers[index]).map((index) => {
                const quantity = getEquipmentQuantity(draft.cells[index]);
                return (
                  <div
                    className={`equipmentQuantityItem${quantity > 0 ? ' checked' : ''}`}
                    key={index}
                  >
                    <span className="equipmentChecklistMark">
                      {quantity > 0 ? <CheckCircle size={17} /> : <span />}
                    </span>
                    <span className="equipmentQuantityLabel">
                      <b>{headers[index]}</b>
                      <small>{quantity > 0 ? `${quantity} ${t('יחידות')}` : t('לא הוקצה')}</small>
                    </span>
                    <span className="equipmentQuantityControl">
                      <button
                        type="button"
                        onClick={() => onQuantityChange(index, quantity - 1)}
                        disabled={quantity === 0}
                        aria-label={`${t('הפחתת כמות')} ${headers[index]}`}
                      >
                        <Minus size={14} />
                      </button>
                      <input
                        type="number"
                        min="0"
                        max="999"
                        inputMode="numeric"
                        value={quantity}
                        onChange={(event) => onQuantityChange(index, event.target.value)}
                        aria-label={`${t('כמות')} ${headers[index]}`}
                      />
                      <button
                        type="button"
                        onClick={() => onQuantityChange(index, quantity + 1)}
                        disabled={quantity >= 999}
                        aria-label={`${t('הגדלת כמות')} ${headers[index]}`}
                      >
                        <Plus size={14} />
                      </button>
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {error && (
            <div className="equipmentEditorError" role="alert">
              <AlertTriangle size={16} /> {error}
            </div>
          )}

          <footer className="equipmentEditorFooter">
            <button type="button" className="secondary" onClick={onClose} disabled={saving}>{t('ביטול')}</button>
            <button type="submit" disabled={saving}>
              <Save size={17} /> {saving ? t('שומר...') : t(isNew ? 'הוספת עובד' : 'שמירת שינויים')}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}

export default function EquipmentPage() {
  useTranslation();
  const { profile, isManager } = useAuth();
  const { setMessage } = useMessage();
  const { language } = useLanguage();
  const fileInputRef = useRef(null);
  const [equipmentImport, setEquipmentImport] = useState(null);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');
  const [schemaMissing, setSchemaMissing] = useState(false);
  const [query, setQuery] = useState('');
  const [section, setSection] = useState('all');
  const [expandedId, setExpandedId] = useState(null);
  const [editor, setEditor] = useState(null);
  const [editorError, setEditorError] = useState('');
  const [savingRecord, setSavingRecord] = useState(false);

  useEffect(() => {
    if (!isManager) return;
    let active = true;
    setLoading(true);
    loadLatestEquipmentSnapshot()
      .then((snapshot) => {
        if (!active) return;
        setEquipmentImport(snapshot.equipmentImport);
        setRecords(snapshot.records);
        setSchemaMissing(false);
      })
      .catch((loadError) => {
        if (!active) return;
        setSchemaMissing(hasDatabaseSchemaError(loadError));
        setError(loadError.message || t('לא ניתן לטעון את ריכוז הציוד.'));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [isManager]);

  useEffect(() => {
    if (!editor) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const closeOnEscape = (event) => {
      if (event.key === 'Escape' && !savingRecord) setEditor(null);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [editor, savingRecord]);

  const sections = useMemo(
    () => [...new Set(records.map((record) => record.section_name).filter(Boolean))],
    [records],
  );

  const filteredRecords = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    return records.filter((record) => {
      if (section !== 'all' && record.section_name !== section) return false;
      if (!normalizedQuery) return true;
      return [record.worker_name, record.section_name, ...(record.cells || [])]
        .filter(Boolean)
        .some((value) => String(value).toLocaleLowerCase().includes(normalizedQuery));
    });
  }, [query, records, section]);

  const recordsWithDevices = useMemo(
    () => records.filter((record) => getDeviceValues(record).length > 0).length,
    [records],
  );
  const equipmentUnits = useMemo(
    () => records.reduce((total, record) => total + (record.checked_item_count || 0), 0),
    [records],
  );

  async function importFile(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!/\.(csv|xlsx)$/i.test(file.name)) {
      setError(t('יש לבחור קובץ Excel או CSV.'));
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError(t('קובץ הציוד גדול מדי. הגודל המרבי הוא 10MB.'));
      return;
    }

    setImporting(true);
    setError('');
    try {
      const parsed = await parseEquipmentFile(file);
      const snapshot = await saveEquipmentSnapshot(parsed, profile.id);
      setEquipmentImport(snapshot.equipmentImport);
      setRecords(snapshot.records);
      setSection('all');
      setQuery('');
      setExpandedId(null);
      setMessage(t('ריכוז הציוד יובא בהצלחה.'));
    } catch (importError) {
      setSchemaMissing(hasDatabaseSchemaError(importError));
      setError(importError.message || t('ייבוא קובץ הציוד נכשל.'));
    } finally {
      setImporting(false);
    }
  }

  async function exportWorkbook() {
    if (!equipmentImport || !records.length) return;
    setExporting(true);
    setError('');
    try {
      await exportEquipmentWorkbook({ equipmentImport, records });
      setMessage(t('קובץ ה־Excel יוצא בהצלחה.'));
    } catch (exportError) {
      setError(exportError.message || t('ייצוא קובץ ה־Excel נכשל.'));
    } finally {
      setExporting(false);
    }
  }

  function openRecordEditor(record) {
    const cells = Array.from(
      { length: Math.max(headers.length, record?.cells?.length || 0) },
      (_, index) => record?.cells?.[index] || '',
    );
    setEditor({
      id: record?.id || null,
      source_row_number: record?.source_row_number || null,
      worker_name: record?.worker_name || '',
      section_name: record?.section_name || (sections[0] || 'עובדי שטח'),
      cells,
      checked_item_count: record?.checked_item_count || 0,
    });
    setEditorError('');
  }

  function changeEditorValue(field, value, cellIndex) {
    setEditor((current) => {
      if (!current) return current;
      if (field !== 'cell') return { ...current, [field]: value };
      const cells = [...current.cells];
      cells[cellIndex] = value;
      return { ...current, cells };
    });
  }

  function changeEditorQuantity(cellIndex, value) {
    setEditor((current) => {
      if (!current) return current;
      const cells = [...current.cells];
      cells[cellIndex] = toEquipmentQuantityCell(value);
      return {
        ...current,
        cells,
        checked_item_count: getEquipmentQuantityTotal(cells),
      };
    });
  }

  async function submitRecordEditor(event) {
    event.preventDefault();
    const workerName = editor?.worker_name.trim();
    const sectionName = editor?.section_name.trim();
    if (!workerName || !sectionName) {
      setEditorError(t('יש להזין שם עובד וקבוצה.'));
      return;
    }

    setSavingRecord(true);
    setEditorError('');
    try {
      const cells = [...editor.cells];
      cells[0] = workerName;
      const payload = {
        worker_name: workerName,
        source_name_unreadable: false,
        section_name: sectionName,
        source_section: sectionName,
        checked_item_count: getEquipmentQuantityTotal(cells),
        cells,
      };

      if (editor.id) {
        const savedRecord = await saveEquipmentRecord(editor.id, payload);
        setRecords((current) => current.map((record) => record.id === savedRecord.id ? savedRecord : record));
        setMessage(t('כרטיס הציוד עודכן בהצלחה.'));
      } else {
        const nextRowNumber = Math.max(1, ...records.map((record) => record.source_row_number || 1)) + 1;
        const result = await addEquipmentRecord(
          equipmentImport.id,
          { ...payload, source_row_number: nextRowNumber },
          records.length + 1,
        );
        setRecords((current) => [...current, result.record]);
        setEquipmentImport(result.equipmentImport);
        setMessage(t('העובד נוסף לריכוז הציוד.'));
      }
      setEditor(null);
    } catch (saveError) {
      setEditorError(saveError.message || t('שמירת כרטיס הציוד נכשלה.'));
    } finally {
      setSavingRecord(false);
    }
  }

  if (!isManager) return <Navigate to="/app" replace />;

  const headers = equipmentImport?.display_headers || [];

  return (
    <div className="equipmentPage">
      <section className="equipmentHero">
        <div className="equipmentHeroCopy">
          <span className="equipmentHeroIcon">
            <HardHat size={28} />
          </span>
          <div>
            <span className="equipmentEyebrow"><span /> {t('מלאי שטח')}</span>
            <h2>{t('ריכוז ציוד עובדי שטח')}</h2>
            <p>{t('תמונת מצב מרוכזת של מכשירים, מספרים סידוריים וציוד אישי.')}</p>
          </div>
        </div>
        <div className="equipmentHeroActions">
          <button
            type="button"
            className="equipmentAddButton"
            onClick={() => openRecordEditor()}
            disabled={!equipmentImport || importing || schemaMissing}
          >
            <Plus size={18} /> {t('הוספת עובד')}
          </button>
          <button
            type="button"
            className="equipmentExportButton"
            onClick={exportWorkbook}
            disabled={!equipmentImport || !records.length || exporting || importing}
          >
            <Download size={18} /> {exporting ? t('מייצא...') : t('ייצוא ל־Excel')}
          </button>
          <label className={`equipmentImportButton${importing ? ' importing' : ''}`}>
            <Upload size={18} />
            <span>{importing ? t('מייבא...') : t('ייבוא קובץ חדש')}</span>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
              disabled={importing || schemaMissing}
              onChange={importFile}
            />
          </label>
        </div>
      </section>

      {schemaMissing && (
        <div className="equipmentNotice error" role="alert">
          <Database size={20} />
          <div>
            <b>{t('טבלת הציוד עדיין לא הופעלה')}</b>
            <span>{t('יש להריץ את מיגרציית מסד הנתונים של ריכוז הציוד ב־Supabase.')}</span>
          </div>
        </div>
      )}

      {error && !schemaMissing && (
        <div className="equipmentNotice error" role="alert">
          <AlertTriangle size={20} />
          <div>
            <b>{t('לא ניתן להשלים את הפעולה')}</b>
            <span>{error}</span>
          </div>
        </div>
      )}

      {equipmentImport?.encoding_warning && (
        <div className="equipmentNotice warning" role="status">
          <AlertTriangle size={20} />
          <div>
            <b>{t('חלק מהעברית בקובץ אינו קריא')}</b>
            <span>{t('שמות ושדות שלא ניתן לשחזר מסומנים בבירור. דגמים ומספרים סידוריים תקינים נשמרו.')}</span>
          </div>
        </div>
      )}

      <section className="equipmentMetrics" aria-label={t('סיכום ציוד')}>
        <EquipmentMetric icon={Users} value={records.length} label="עובדים בריכוז" tone="blue" />
        <EquipmentMetric icon={Package} value={recordsWithDevices} label="עובדים עם מזהי ציוד" tone="teal" />
        <EquipmentMetric icon={CheckCircle} value={equipmentUnits} label="סה״כ יחידות ציוד" tone="orange" />
        <EquipmentMetric
          icon={CalendarDays}
          value={equipmentImport ? formatPeriod(equipmentImport.source_period, language) : '—'}
          label="תקופת הריכוז"
          tone="purple"
        />
      </section>

      <section className="card equipmentRegister">
        <div className="equipmentRegisterHeader">
          <div>
            <span className="equipmentEyebrow">{t('רשימת עובדים')}</span>
            <h3>{equipmentImport?.title || t('עדיין לא יובא ריכוז ציוד')}</h3>
            {equipmentImport && (
              <small>
                <FileSpreadsheet size={14} /> {equipmentImport.source_file_name}
              </small>
            )}
          </div>
          <div className="equipmentRegisterMeta">
            <span className="equipmentEditHint"><Pencil size={13} /> {t('ניתן לעריכה')}</span>
            <span className="equipmentResultCount">
              {t('מציג')} {filteredRecords.length} {t('מתוך')} {records.length}
            </span>
          </div>
        </div>

        <div className="equipmentFilters">
          <label className="equipmentSearch">
            <span>{t('חיפוש')}</span>
            <div>
              <Search size={17} />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t('שם עובד, דגם או מספר סידורי...')}
              />
            </div>
          </label>
          <label>
            <span>{t('קבוצה')}</span>
            <select value={section} onChange={(event) => setSection(event.target.value)}>
              <option value="all">{t('כל הקבוצות')}</option>
              {sections.map((sectionName) => (
                <option key={sectionName} value={sectionName}>
                  {sectionName}
                </option>
              ))}
            </select>
          </label>
        </div>

        {loading ? (
          <div className="equipmentEmptyState">
            <span className="projectLoadSpinner" />
            <b>{t('טוען את ריכוז הציוד...')}</b>
          </div>
        ) : !equipmentImport ? (
          <div className="equipmentEmptyState">
            <Boxes size={42} />
            <b>{t('אין עדיין נתוני ציוד')}</b>
            <span>{t('ייבאו קובץ Excel או CSV כדי ליצור את הריכוז הראשון.')}</span>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={schemaMissing || importing}
            >
              <Upload size={17} /> {t('בחירת קובץ Excel או CSV')}
            </button>
          </div>
        ) : filteredRecords.length === 0 ? (
          <div className="equipmentEmptyState">
            <Search size={38} />
            <b>{t('לא נמצאו רשומות מתאימות')}</b>
            <span>{t('נסו לשנות את החיפוש או את סינון הקבוצה.')}</span>
          </div>
        ) : (
          <div className="equipmentTableWrap">
            <table className="equipmentTable">
              <thead>
                <tr>
                  <th>{t('עובד')}</th>
                  <th>{t('קבוצה')}</th>
                  <th>{t('מכשירים ומזהים')}</th>
                  <th>{t('כמות ציוד')}</th>
                  <th>{t('פעולות')}</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords.map((record) => {
                  const recordKey = record.id || record.source_row_number;
                  const expanded = expandedId === recordKey;
                  const devices = getDeviceValues(record);
                  const completion = Math.min(100, Math.round(((record.checked_item_count || 0) / EQUIPMENT_CHECKLIST_COLUMNS.length) * 100));
                  return (
                    <tr className={expanded ? 'expanded' : ''} key={recordKey}>
                      <td colSpan={5}>
                        <div className="equipmentRowShell">
                          <button
                            type="button"
                            className="equipmentRowButton"
                            onClick={() => setExpandedId(expanded ? null : recordKey)}
                            aria-expanded={expanded}
                          >
                            <span className="equipmentWorkerCell">
                              <span className="equipmentWorkerAvatar">{record.worker_name?.[0] || '#'}</span>
                              <span>
                                <b>{record.worker_name}</b>
                                {record.source_name_unreadable && <small>{t('שם לא קריא')}</small>}
                              </span>
                            </span>
                            <span className="equipmentSectionCell"><span />{record.section_name}</span>
                            <span className="equipmentDevicesCell">
                              {devices.length ? (
                                devices.slice(0, 4).map((device, index) => <code key={`${device}-${index}`}>{device}</code>)
                              ) : (
                                <span className="muted">{t('ללא מכשיר משויך')}</span>
                              )}
                              {devices.length > 4 && <small>+{devices.length - 4}</small>}
                            </span>
                            <span className="equipmentCountCell">
                              <span><CheckCircle size={15} /> {record.checked_item_count || 0} {t('יח׳')}</span>
                              <span className="equipmentMiniProgress"><i style={{ width: `${completion}%` }} /></span>
                            </span>
                            <span className="equipmentExpandIcon">
                              {expanded ? <ChevronUp size={19} /> : <ChevronDown size={19} />}
                            </span>
                          </button>
                          <button
                            type="button"
                            className="equipmentEditButton"
                            onClick={() => openRecordEditor(record)}
                            aria-label={`${t('עריכת כרטיס ציוד')} ${record.worker_name}`}
                            title={t('עריכת כרטיס ציוד')}
                          >
                            <Pencil size={17} />
                          </button>
                        </div>
                        {expanded && <EquipmentDetails record={record} headers={headers} />}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {editor && (
        <EquipmentEditor
          draft={editor}
          headers={headers}
          sections={sections}
          saving={savingRecord}
          error={editorError}
          onChange={changeEditorValue}
          onQuantityChange={changeEditorQuantity}
          onClose={() => setEditor(null)}
          onSave={submitRecordEditor}
        />
      )}
    </div>
  );
}
