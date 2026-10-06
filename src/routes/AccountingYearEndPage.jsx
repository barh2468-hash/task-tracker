import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AlertTriangle,
  Car,
  Download,
  Link2,
  Link2Off,
  Upload,
} from 'lucide-react';
import { useMessage } from '../context/MessageContext.jsx';
import { t } from '../features/language/LanguageContext.jsx';
import { collectMatchWarnings, matchPayrollToBalances } from '../features/accounting/api.js';
import { parseVehiclePayrollExport } from '../features/accounting/utils/parseVehiclePayrollExport.js';
import { parseSapBalanceExport } from '../features/accounting/utils/parseSapBalanceExport.js';
import { exportYearEndWorkbook } from '../features/accounting/utils/exportYearEndWorkbook.js';
import {
  buildReconciliationRows,
  RECONCILIATION_TITLE,
  sumExpense,
} from '../features/accounting/utils/buildVehicleReconciliation.js';

function formatIls(value) {
  return new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS' }).format(Number(value) || 0);
}

function UnlinkedRow({ record, balanceRecords, onResolve }) {
  const [type, setType] = useState('existing');
  const [balanceIndex, setBalanceIndex] = useState('');
  const [cardNumber, setCardNumber] = useState(record.card_number || '');
  const [ownershipType, setOwnershipType] = useState('');
  const [label, setLabel] = useState('');

  function submit() {
    if (type === 'existing') {
      if (balanceIndex === '') return;
      onResolve(record, { type: 'existing', matchedBalance: balanceRecords[Number(balanceIndex)] });
    } else if (type === 'new') {
      onResolve(record, {
        type: 'new',
        matchedBalance: {
          card_number: cardNumber,
          ownership_type: ownershipType,
          label: label || `${cardNumber} - רכב ${record.plate_number}`,
          balance_ils: 0,
          notes: '',
        },
      });
    } else {
      onResolve(record, { type: 'ignore' });
    }
  }

  return (
    <tr className="accountingUnlinkedRow">
      <td>
        <span className="accountingPlate"><Car size={15} /> {record.plate_number}</span>
        {record.card_number && <small>{t('כרטיס בקובץ')}: {record.card_number}</small>}
      </td>
      <td>
        <select value={type} onChange={(event) => setType(event.target.value)}>
          <option value="existing">{t('שיוך לשורה מטבלת ההכנה')}</option>
          <option value="new">{t('יצירת כרטיס חדש')}</option>
          <option value="ignore">{t('רכב ללא כרטיס')}</option>
        </select>
      </td>
      <td>
        {type === 'existing' && (
          <select value={balanceIndex} onChange={(event) => setBalanceIndex(event.target.value)}>
            <option value="">{t('בחירת שורה')}</option>
            {balanceRecords.map((row, index) => (
              <option key={`${row.card_number}-${index}`} value={index}>
                {row.card_number} — {row.label || row.ownership_type}
              </option>
            ))}
          </select>
        )}
        {type === 'new' && (
          <div className="accountingInlineFields">
            <input
              placeholder={t('מספר כרטיס')}
              value={cardNumber}
              onChange={(event) => setCardNumber(event.target.value)}
            />
            <input
              placeholder={t('ליסינג/ מאיה')}
              value={ownershipType}
              onChange={(event) => setOwnershipType(event.target.value)}
            />
            <input
              placeholder={t('תיאור')}
              value={label}
              onChange={(event) => setLabel(event.target.value)}
            />
          </div>
        )}
      </td>
      <td>
        <button type="button" onClick={submit}>{t('אישור')}</button>
      </td>
    </tr>
  );
}

export default function AccountingYearEndPage() {
  useTranslation();
  const { setMessage } = useMessage();
  const payrollInputRef = useRef(null);
  const balanceInputRef = useRef(null);

  // A year-end closing report for year Y is built sometime during Y+1, once
  // that year's books are final — default to last year, not the current one.
  const [year, setYear] = useState(new Date().getFullYear() - 1);
  const [payrollFile, setPayrollFile] = useState(null); // { fileName, records }
  const [balanceFile, setBalanceFile] = useState(null); // { fileName, records }
  const [matchedRecords, setMatchedRecords] = useState(null);
  const [error, setError] = useState('');
  const [importingPayroll, setImportingPayroll] = useState(false);
  const [importingBalance, setImportingBalance] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Nothing is stored between years — changing the year starts a clean slate.
  useEffect(() => {
    setPayrollFile(null);
    setBalanceFile(null);
    setMatchedRecords(null);
    setError('');
  }, [year]);

  const unlinkedRecords = useMemo(
    () => (matchedRecords || []).filter((record) => record.link_status === 'unlinked'),
    [matchedRecords],
  );
  const reconciliationRows = useMemo(
    () => (matchedRecords ? buildReconciliationRows(matchedRecords) : []),
    [matchedRecords],
  );
  const reconciliationTotal = useMemo(() => sumExpense(reconciliationRows), [reconciliationRows]);
  const matchWarnings = useMemo(
    () => (matchedRecords ? collectMatchWarnings(matchedRecords, balanceFile?.records) : []),
    [matchedRecords, balanceFile],
  );
  const linkedCount = matchedRecords ? matchedRecords.length - unlinkedRecords.length : 0;
  const readyToExport = matchedRecords && matchedRecords.length > 0 && unlinkedRecords.length === 0;

  function recomputeMatch(nextPayrollFile, nextBalanceFile) {
    if (nextPayrollFile && nextBalanceFile) {
      setMatchedRecords(matchPayrollToBalances(nextPayrollFile.records, nextBalanceFile.records, year));
    } else {
      setMatchedRecords(null);
    }
  }

  async function importPayrollFile(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setImportingPayroll(true);
    setError('');
    try {
      const records = await parseVehiclePayrollExport(file, year);
      const nextPayrollFile = { fileName: file.name, records };
      setPayrollFile(nextPayrollFile);
      recomputeMatch(nextPayrollFile, balanceFile);
    } catch (importError) {
      setError(importError.message || t('ייבוא קובץ השכר/רכבים נכשל.'));
    } finally {
      setImportingPayroll(false);
    }
  }

  async function importBalanceFile(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setImportingBalance(true);
    setError('');
    try {
      const records = await parseSapBalanceExport(file, year);
      const nextBalanceFile = { fileName: file.name, records };
      setBalanceFile(nextBalanceFile);
      recomputeMatch(payrollFile, nextBalanceFile);
    } catch (importError) {
      setError(importError.message || t('ייבוא קובץ ההכנה/יתרות נכשל.'));
    } finally {
      setImportingBalance(false);
    }
  }

  function handleResolve(record, resolution) {
    setMatchedRecords((current) =>
      current.map((row) =>
        row === record
          ? {
              ...row,
              link_status: resolution.type === 'ignore' ? 'ignored' : 'resolved_manual',
              matchedBalance: resolution.type === 'ignore' ? null : resolution.matchedBalance,
            }
          : row,
      ),
    );
  }

  async function exportTable() {
    if (!readyToExport) return;
    setExporting(true);
    setError('');
    try {
      await exportYearEndWorkbook({ year, records: matchedRecords });
      setMessage(t('קובץ ה־Excel יוצא בהצלחה.'));
    } catch (exportError) {
      setError(exportError.message || t('ייצוא קובץ ה־Excel נכשל.'));
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="equipmentPage">
      <section className="equipmentHero">
        <div className="equipmentHeroCopy">
          <span className="equipmentHeroIcon">
            <Car size={28} />
          </span>
          <div>
            <span className="equipmentEyebrow"><span /> {t('סוף שנה')}</span>
            <h2>{t('טבלת רכבים למאזן')}</h2>
            <p>{t('מעלים את טבלת השכר/רכבים ואת טבלת ההכנה ליתרות יחד, והמערכת בונה מהן את הטבלה לרו"ח.')}</p>
          </div>
        </div>
        <div className="equipmentHeroActions">
          <label>
            <span>{t('שנה')}</span>
            <input
              type="number"
              className="accountingYearInput"
              value={year}
              onChange={(event) => setYear(Number(event.target.value) || year)}
            />
          </label>
          <button
            type="button"
            className="equipmentExportButton"
            onClick={exportTable}
            disabled={!readyToExport || exporting}
            title={matchedRecords && unlinkedRecords.length > 0 ? t('יש לשייך את כל הרכבים לפני הייצוא') : ''}
          >
            <Download size={18} /> {exporting ? t('מייצא...') : t('ייצוא ל־Excel')}
          </button>
        </div>
      </section>

      <section className="card accountingUploadPanel">
        <div className="accountingUploadRow">
          <div>
            <b>{t('שלב 1: טבלת שכר/רכבים')}</b>
            <span>{payrollFile ? `${payrollFile.fileName} — ${payrollFile.records.length} ${t('רכבים')}` : t('טרם הועלה קובץ')}</span>
          </div>
          <label className={`equipmentImportButton${importingPayroll ? ' importing' : ''}`}>
            <Upload size={18} />
            <span>{importingPayroll ? t('מעבד...') : t('העלאת קובץ שכר/רכבים')}</span>
            <input ref={payrollInputRef} type="file" accept=".xls,.xlsx" disabled={importingPayroll} onChange={importPayrollFile} />
          </label>
        </div>
        <div className="accountingUploadRow">
          <div>
            <b>{t('שלב 2: טבלת הכנה/יתרות')}</b>
            <span>{balanceFile ? `${balanceFile.fileName} — ${balanceFile.records.length} ${t('כרטיסים')}` : t('טרם הועלה קובץ')}</span>
          </div>
          <label className={`equipmentImportButton${importingBalance ? ' importing' : ''}`}>
            <Upload size={18} />
            <span>{importingBalance ? t('מעבד...') : t('העלאת קובץ הכנה/יתרות')}</span>
            <input ref={balanceInputRef} type="file" accept=".xls,.xlsx" disabled={importingBalance} onChange={importBalanceFile} />
          </label>
        </div>
      </section>

      {error && (
        <div className="equipmentNotice error" role="alert">
          <AlertTriangle size={20} />
          <div>
            <b>{t('לא ניתן להשלים את הפעולה')}</b>
            <span>{error}</span>
          </div>
        </div>
      )}

      {matchedRecords && (
        <section className="equipmentMetrics" aria-label={t('סיכום שיוך')}>
          <div className="equipmentMetric blue">
            <span className="equipmentMetricIcon"><Link2 size={21} /></span>
            <div>
              <strong>{linkedCount}</strong>
              <span>{t('רכבים מקושרים')}</span>
            </div>
          </div>
          <div className={`equipmentMetric ${unlinkedRecords.length ? 'orange' : 'teal'}`}>
            <span className="equipmentMetricIcon"><Link2Off size={21} /></span>
            <div>
              <strong>{unlinkedRecords.length}</strong>
              <span>{t('רכבים לא מקושרים')}</span>
            </div>
          </div>
        </section>
      )}

      {matchWarnings.length > 0 && (
        <div className="equipmentNotice warning" role="status">
          <AlertTriangle size={20} />
          <div>
            <b>{t('יומן עיבוד')} — {matchWarnings.length} {t('אזהרות')}</b>
            {matchWarnings.map((warning, index) => (
              <span key={`${warning.type}-${warning.card_number}-${index}`}>{warning.message}</span>
            ))}
          </div>
        </div>
      )}

      {unlinkedRecords.length > 0 && (
        <section className="card accountingUnlinkedPanel">
          <div className="equipmentRegisterHeader">
            <div>
              <span className="equipmentEyebrow">{t('דורש טיפול')}</span>
              <h3>{t('רכבים לא מקושרים')}</h3>
            </div>
          </div>
          <div className="equipmentTableWrap">
            <table className="equipmentTable">
              <thead>
                <tr>
                  <th>{t('רכב')}</th>
                  <th>{t('פעולה')}</th>
                  <th>{t('פרטים')}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {unlinkedRecords.map((record) => (
                  <UnlinkedRow
                    key={record.plate_number}
                    record={record}
                    balanceRecords={balanceFile?.records || []}
                    onResolve={handleResolve}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {reconciliationRows.length > 0 && (
        <section className="card equipmentRegister">
          <div className="equipmentRegisterHeader">
            <div>
              <span className="equipmentEyebrow">{t('תצוגה מקדימה')}</span>
              <h3>{t(RECONCILIATION_TITLE)} {year}</h3>
            </div>
          </div>
          <div className="equipmentTableWrap">
            <table className="equipmentTable">
              <thead>
                <tr>
                  <th>{t('כרטיס')}</th>
                  <th>{t('ליסינג/ מאיה')}</th>
                  <th>{t('מס\' רכב')}</th>
                  <th>{t('פרטים')}</th>
                  <th>{t('הוצאה במאזן')}</th>
                  <th>{t('הערות')}</th>
                </tr>
              </thead>
              <tbody>
                {reconciliationRows.map((row, index) => (
                  <tr key={`${row.card_number}-${index}`}>
                    <td>{row.card_number}</td>
                    <td>{row.ownership}</td>
                    <td>{row.plate}</td>
                    <td>{row.details}</td>
                    <td>{formatIls(row.expense)}</td>
                    <td>{row.notes}</td>
                  </tr>
                ))}
                <tr>
                  <td />
                  <td />
                  <td />
                  <td><b>{t('סה"כ - אחזקת כלי רכב')}</b></td>
                  <td><b>{formatIls(reconciliationTotal)}</b></td>
                  <td />
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
