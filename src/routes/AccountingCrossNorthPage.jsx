import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Compass, Upload } from 'lucide-react';
import { t } from '../features/language/LanguageContext.jsx';
import useFileDrop from '../hooks/useFileDrop.js';
import AccountingGuide from '../features/accounting/components/AccountingGuide.jsx';
import JournalView from '../features/accounting/components/JournalView.jsx';
import { CROSS_NORTH_GUIDE } from '../features/accounting/guides.js';
import { extractPdfLines } from '../features/accounting/fuel/parseDelekReport.js';
import {
  combineCrossNorth,
  parseCrossNorthPages,
  parseCrossNorthSummary,
} from '../features/accounting/crossnorth/parseCrossNorthInvoice.js';
import { buildCrossNorthJournal } from '../features/accounting/crossnorth/buildCrossNorthJournal.js';
import { loadManualMap, saveManualMap } from '../features/accounting/fuel/cardMap.js';
import { SEED_VEHICLE_CARDS } from '../features/accounting/fuel/fuelConfig.js';

const digitsOf = (value) => String(value).replace(/\D/g, '');

export default function AccountingCrossNorthPage() {
  useTranslation();
  const inputRef = useRef(null);
  const [invoices, setInvoices] = useState([]);
  const [manualMap, setManualMap] = useState(loadManualMap);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const journals = useMemo(() => {
    const cardFor = (plateDigits) => manualMap[plateDigits] || SEED_VEHICLE_CARDS[plateDigits] || '';
    return invoices.map(({ fileName, invoice }) => ({
      fileName,
      journal: buildCrossNorthJournal(invoice, cardFor),
    }));
  }, [invoices, manualMap]);

  async function loadFiles(files) {
    if (!files.length) return;
    setBusy(true);
    setError('');
    setInvoices([]);
    try {
      const pdfs = [];
      const summaries = new Map(); // invoice digits -> vehicle rows
      for (const file of files) {
        try {
          if (/\.pdf$/i.test(file.name)) {
            pdfs.push({ fileName: file.name, invoice: parseCrossNorthPages(await extractPdfLines(file)) });
          } else if (/\.xlsx?$/i.test(file.name)) {
            for (const [invoiceDigits, vehicles] of await parseCrossNorthSummary(file)) {
              if (summaries.has(invoiceDigits)) throw new Error(`הסיכום של חשבונית ${invoiceDigits} הועלה פעמיים.`);
              summaries.set(invoiceDigits, vehicles);
            }
          } else {
            throw new Error('יש לבחור את ה-PDF של החשבונית ואת קובץ האקסל המסכם.');
          }
        } catch (caught) {
          throw new Error(`${file.name}: ${caught.message || 'שגיאה בקריאת הקובץ.'}`);
        }
      }
      if (!pdfs.length) throw new Error('לא נבחר PDF של חשבונית חוצה צפון.');

      const seen = new Set();
      const parsed = pdfs.map(({ fileName, invoice }) => {
        const key = digitsOf(invoice.invoiceNumber);
        if (seen.has(key)) throw new Error(`חשבונית ${invoice.invoiceNumber} הועלתה פעמיים (${fileName}).`);
        seen.add(key);
        const vehicles = summaries.get(key);
        if (!vehicles) throw new Error(`${fileName}: לא נמצא קובץ אקסל מסכם לחשבונית ${invoice.invoiceNumber}. יש לבחור יחד את ה-PDF ואת האקסל.`);
        return { fileName, invoice: combineCrossNorth(invoice, vehicles) };
      });
      for (const key of summaries.keys()) {
        if (!seen.has(key)) throw new Error(`קובץ האקסל כולל את חשבונית ${key}, אך ה-PDF שלה לא נבחר.`);
      }
      setInvoices(parsed);
    } catch (caught) {
      setError(caught.message || 'שגיאה בקריאת הקובץ.');
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  const onFiles = (event) => loadFiles([...(event.target.files || [])]);

  const { dropProps, dropStyle } = useFileDrop(loadFiles, busy);

  function saveCard(plateDigits, card) {
    const next = { ...manualMap, [plateDigits]: card };
    setManualMap(next);
    saveManualMap(next);
  }

  return (
    <div className="equipmentPage">
      <section className="equipmentHero" style={dropStyle} {...dropProps}>
        <div className="equipmentHeroCopy">
          <span className="equipmentHeroIcon"><Compass size={26} /></span>
          <div>
            <h2>{t('חוצה צפון — יבוא תנועות יומן לסאפ')}</h2>
            <p>{t('מעלים יחד את ה-PDF של חשבונית חוצה צפון ואת קובץ האקסל המסכם — בלחיצה על הכפתור או בגרירה ישירות מ-Outlook לאזור הזה — ומקבלים את קבצי היבוא לסאפ.')}</p>
          </div>
        </div>
        <label className={`equipmentImportButton${busy ? ' importing' : ''}`}>
          <Upload size={18} />
          <span>{busy ? t('מעבד...') : t('העלאת חשבוניות חוצה צפון')}</span>
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,application/pdf,.xls,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
            multiple
            disabled={busy}
            onChange={onFiles}
          />
        </label>
      </section>

      <AccountingGuide guide={CROSS_NORTH_GUIDE} />

      {error && (
        <div className="equipmentNotice error" role="alert">
          <AlertTriangle size={20} />
          <div>
            <b>{t('לא ניתן להשלים את הפעולה')}</b>
            <span>{error}</span>
          </div>
        </div>
      )}

      {journals.map(({ fileName, journal }) => (
        <div key={journal.invoiceNumber} style={{ display: 'contents' }}>
          <JournalView journal={journal} fileName={fileName} onSaveCard={saveCard} />
        </div>
      ))}
    </div>
  );
}
