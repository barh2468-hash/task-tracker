import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, CheckCircle2, Download, Fuel, Upload, XCircle } from 'lucide-react';
import { t } from '../features/language/LanguageContext.jsx';
import AccountingGuide from '../features/accounting/components/AccountingGuide.jsx';
import { FUEL_GUIDE } from '../features/accounting/guides.js';
import { extractPdfLines, parseDelekPages } from '../features/accounting/fuel/parseDelekReport.js';
import { buildFuelJournal, money } from '../features/accounting/fuel/buildFuelJournal.js';
import { downloadBytes, entriesToRows, makeZip, rowsToUnicodeText, rowsToXlsxBytes } from '../features/accounting/fuel/exportSapImport.js';
import { SEED_VEHICLE_CARDS } from '../features/accounting/fuel/fuelConfig.js';

const STORAGE_KEY = 'maya-fuel-card-map';
const cellStyle = { padding: '8px 12px', borderBottom: '1px solid #e3ebf1', textAlign: 'right', fontSize: 13 };
const numStyle = { ...cellStyle, direction: 'ltr', fontVariantNumeric: 'tabular-nums' };

function loadManualMap() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
}

function saveManualMap(map) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // Mapping still works for this session if storage is unavailable.
  }
}

function UnmappedRow({ vehicle, onSave }) {
  const [card, setCard] = useState('');
  return (
    <tr>
      <td style={cellStyle}>{vehicle.plate}</td>
      <td style={cellStyle}>
        <input
          value={card}
          onChange={(event) => setCard(event.target.value.replace(/\D/g, ''))}
          placeholder={t('קוד כרטיס')}
          style={{ width: 130 }}
          inputMode="numeric"
        />
      </td>
      <td style={cellStyle}>
        <button type="button" className="secondary" disabled={!card} onClick={() => onSave(vehicle.plateDigits, card)}>
          {t('שמירה')}
        </button>
      </td>
    </tr>
  );
}

export default function AccountingFuelPage() {
  useTranslation();
  const inputRef = useRef(null);
  const [report, setReport] = useState(null);
  const [fileName, setFileName] = useState('');
  const [manualMap, setManualMap] = useState(loadManualMap);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const journal = useMemo(() => {
    if (!report) return null;
    return buildFuelJournal(report, (plateDigits) => manualMap[plateDigits] || SEED_VEHICLE_CARDS[plateDigits] || '');
  }, [report, manualMap]);

  async function onFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setError('');
    setReport(null);
    try {
      if (!/\.pdf$/i.test(file.name)) throw new Error('יש לבחור קובץ PDF של דוח הריכוז מדלק.');
      const pages = await extractPdfLines(file);
      setReport(parseDelekPages(pages));
      setFileName(file.name);
    } catch (caught) {
      setError(caught.message || 'שגיאה בקריאת הקובץ.');
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  function saveCard(plateDigits, card) {
    const next = { ...manualMap, [plateDigits]: card };
    setManualMap(next);
    saveManualMap(next);
  }

  // SAP accepts a single header record per file: one file per journal entry.
  function fileBase(entry, index) {
    const stamp = `${journal.period.year}-${String(journal.period.month).padStart(2, '0')}`;
    return `${String(index + 1).padStart(2, '0')}_step${entry.step}_${entry.key}_${stamp}`;
  }

  async function downloadEntry(entry, index, format) {
    const rows = entriesToRows([entry]);
    if (format === 'txt') {
      downloadBytes(rowsToUnicodeText(rows), `${fileBase(entry, index)}.txt`, 'text/plain;charset=utf-16le');
    } else {
      downloadBytes(await rowsToXlsxBytes(rows), `${fileBase(entry, index)}.xlsx`, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    }
  }

  function downloadZip() {
    const files = journal.entries.map((entry, index) => ({
      name: `${fileBase(entry, index)}.txt`,
      bytes: rowsToUnicodeText(entriesToRows([entry])),
    }));
    const stamp = `${journal.period.year}-${String(journal.period.month).padStart(2, '0')}`;
    downloadBytes(makeZip(files), `fuel-sap-import-${stamp}.zip`);
  }

  return (
    <div className="equipmentPage">
      <section className="equipmentHero">
        <div className="equipmentHeroCopy">
          <span className="equipmentHeroIcon"><Fuel size={26} /></span>
          <div>
            <h2>{t('דלק — יבוא תנועות יומן לסאפ')}</h2>
            <p>{t('מעלים את דוח הריכוז החודשי של דלק (PDF) ומקבלים את קבצי היבוא לשלב 1 ולשלב 2.')}</p>
          </div>
        </div>
        <label className={`equipmentImportButton${busy ? ' importing' : ''}`}>
          <Upload size={18} />
          <span>{busy ? t('מעבד...') : t('העלאת דוח דלק')}</span>
          <input ref={inputRef} type="file" accept=".pdf,application/pdf" disabled={busy} onChange={onFile} />
        </label>
      </section>

      <AccountingGuide guide={FUEL_GUIDE} />

      {error && (
        <div className="equipmentNotice error" role="alert">
          <AlertTriangle size={20} />
          <div>
            <b>{t('לא ניתן להשלים את הפעולה')}</b>
            <span>{error}</span>
          </div>
        </div>
      )}

      {journal && (
        <>
          <section className="equipmentMetrics" aria-label={t('סיכום הדוח')}>
            <div className="equipmentMetric blue">
              <div>
                <strong>{String(journal.period.month).padStart(2, '0')}/{journal.period.year}</strong>
                <span>{t('חודש הדוח')} · {fileName}</span>
              </div>
            </div>
            <div className="equipmentMetric teal">
              <div>
                <strong>{journal.invoiceNumber}</strong>
                <span>{t('חשבונית ריכוז')}</span>
              </div>
            </div>
            <div className="equipmentMetric purple">
              <div>
                <strong>{money(journal.totalDueCents)}</strong>
                <span>{t('סה"כ לחיוב')}</span>
              </div>
            </div>
            <div className="equipmentMetric orange">
              <div>
                <strong>{money(journal.gapCents)}</strong>
                <span>{t('פער מע"מ שנכנס לרכב האחרון')} ({journal.lastPlate})</span>
              </div>
            </div>
          </section>

          <section className="card" style={{ padding: 18 }}>
            <h3 style={{ marginTop: 0 }}>{t('בדיקות')}</h3>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 6 }}>
              {journal.checks.map((check) => (
                <li key={check.label} style={{ display: 'flex', alignItems: 'center', gap: 8, color: check.ok ? '#087c66' : '#9f2920' }}>
                  {check.ok ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
                  <span>{check.label}</span>
                </li>
              ))}
            </ul>
          </section>

          {journal.unmappedPlates.length > 0 && (
            <section className="card" style={{ padding: 18 }}>
              <h3 style={{ marginTop: 0 }}>{t('רכבים ללא כרטיס — יש להזין קוד כרטיס')}</h3>
              <table style={{ borderCollapse: 'collapse' }}>
                <tbody>
                  {journal.unmappedPlates.map((vehicle) => (
                    <UnmappedRow key={vehicle.plateDigits} vehicle={vehicle} onSave={saveCard} />
                  ))}
                </tbody>
              </table>
            </section>
          )}

          <section className="card" style={{ padding: 18, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <button type="button" className="equipmentExportButton" disabled={!journal.ok} onClick={downloadZip}>
              <Download size={16} /> {t('הורדת כל קבצי היבוא (ZIP)')}
            </button>
            <small>{t('כל פקודה היא קובץ נפרד — סאפ מקבל כותרת אחת בלבד בכל קובץ. יש לייבא אותם בזה אחר זה.')}</small>
            {!journal.ok && <small>{t('אפשר להוריד רק כשכל הבדיקות עוברות.')}</small>}
          </section>

          {journal.entries.map((entry, index) => (
            <section className="card" key={entry.key} style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', background: '#edf4f8', display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
                <span>
                <b>{index + 1}. {t('שלב')} {entry.step} · {entry.title}</b>
                <small style={{ display: 'block', color: '#52677d' }}>
                  {t('אסמכתא')} 2: {entry.ref2} · {entry.remarks} · {entry.posting} → {entry.due}
                </small>
                </span>
                <span style={{ display: 'inline-flex', gap: 6 }}>
                  <button type="button" className="secondary" disabled={!journal.ok} onClick={() => downloadEntry(entry, index, 'txt')}>TXT</button>
                  <button type="button" className="secondary" disabled={!journal.ok} onClick={() => downloadEntry(entry, index, 'xlsx')}>Excel</button>
                </span>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      {['סוג', 'קוד', 'חשבון', 'חובה', 'זכות'].map((head) => (
                        <th key={head} style={{ ...cellStyle, background: '#f8fbfd' }}>{t(head)}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {entry.lines.map((line, index) => (
                      <tr key={`${line.code}-${index}`}>
                        <td style={cellStyle}>{line.type}</td>
                        <td style={cellStyle}>{line.code || '—'}</td>
                        <td style={cellStyle}>{line.name}</td>
                        <td style={numStyle}>{line.debit !== undefined ? money(line.debit) : ''}</td>
                        <td style={numStyle}>{line.credit !== undefined ? money(line.credit) : ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
        </>
      )}
    </div>
  );
}
