import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, MapPin, Upload } from 'lucide-react';
import { t } from '../features/language/LanguageContext.jsx';
import useFileDrop from '../hooks/useFileDrop.js';
import AccountingGuide from '../features/accounting/components/AccountingGuide.jsx';
import JournalView from '../features/accounting/components/JournalView.jsx';
import { ITURAN_GUIDE } from '../features/accounting/guides.js';
import { extractPdfLines } from '../features/accounting/fuel/parseDelekReport.js';
import { parseIturanPages } from '../features/accounting/ituran/parseIturanInvoice.js';
import { buildIturanJournal } from '../features/accounting/ituran/buildIturanJournal.js';
import { loadManualMap, saveManualMap } from '../features/accounting/fuel/cardMap.js';
import { SEED_VEHICLE_CARDS } from '../features/accounting/fuel/fuelConfig.js';

export default function AccountingIturanPage() {
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
      journal: buildIturanJournal(invoice, cardFor),
    }));
  }, [invoices, manualMap]);

  async function loadFiles(files) {
    if (!files.length) return;
    setBusy(true);
    setError('');
    setInvoices([]);
    try {
      const parsed = [];
      for (const file of files) {
        if (!/\.pdf$/i.test(file.name)) throw new Error(`${file.name}: יש לבחור קובצי PDF של חשבוניות איתוראן.`);
        try {
          parsed.push({ fileName: file.name, invoice: parseIturanPages(await extractPdfLines(file)) });
        } catch (caught) {
          throw new Error(`${file.name}: ${caught.message || 'שגיאה בקריאת הקובץ.'}`);
        }
      }
      const seen = new Set();
      for (const { fileName, invoice } of parsed) {
        if (seen.has(invoice.invoiceNumber)) throw new Error(`חשבונית ${invoice.invoiceNumber} הועלתה פעמיים (${fileName}).`);
        seen.add(invoice.invoiceNumber);
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
          <span className="equipmentHeroIcon"><MapPin size={26} /></span>
          <div>
            <h2>{t('איתוראן — יבוא תנועות יומן לסאפ')}</h2>
            <p>{t('מעלים את חשבונית המס של איתוראן (PDF) — בלחיצה על הכפתור או בגרירה ישירות מ-Outlook לאזור הזה — אפשר כמה חשבוניות יחד, ומקבלים את קבצי היבוא לסאפ.')}</p>
          </div>
        </div>
        <label className={`equipmentImportButton${busy ? ' importing' : ''}`}>
          <Upload size={18} />
          <span>{busy ? t('מעבד...') : t('העלאת חשבוניות איתוראן')}</span>
          <input ref={inputRef} type="file" accept=".pdf,application/pdf" multiple disabled={busy} onChange={onFiles} />
        </label>
      </section>

      <AccountingGuide guide={ITURAN_GUIDE} />

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
