import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Route, Upload } from 'lucide-react';
import { t } from '../features/language/LanguageContext.jsx';
import AccountingGuide from '../features/accounting/components/AccountingGuide.jsx';
import JournalView from '../features/accounting/components/JournalView.jsx';
import { TOLLS_GUIDE } from '../features/accounting/guides.js';
import { extractPdfLines } from '../features/accounting/fuel/parseDelekReport.js';
import { parseTollPages } from '../features/accounting/tolls/parseTollInvoice.js';
import { buildTollJournal } from '../features/accounting/tolls/buildTollJournal.js';
import { loadManualMap, saveManualMap } from '../features/accounting/fuel/cardMap.js';
import { SEED_VEHICLE_CARDS } from '../features/accounting/fuel/fuelConfig.js';

export default function AccountingTollsPage() {
  useTranslation();
  const inputRef = useRef(null);
  const [invoices, setInvoices] = useState([]);
  const [manualMap, setManualMap] = useState(loadManualMap);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const journals = useMemo(() => {
    const cardFor = (plateDigits) => manualMap[plateDigits] || SEED_VEHICLE_CARDS[plateDigits] || '';
    return invoices.map(({ fileName, invoice }) => ({ fileName, journal: buildTollJournal(invoice, cardFor) }));
  }, [invoices, manualMap]);

  async function onFiles(event) {
    const files = [...(event.target.files || [])];
    if (!files.length) return;
    setBusy(true);
    setError('');
    setInvoices([]);
    try {
      const parsed = [];
      for (const file of files) {
        if (!/\.pdf$/i.test(file.name)) throw new Error(`${file.name}: יש לבחור קובצי PDF של חשבוניות כביש 6.`);
        try {
          parsed.push({ fileName: file.name, invoice: parseTollPages(await extractPdfLines(file)) });
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

  function saveCard(plateDigits, card) {
    const next = { ...manualMap, [plateDigits]: card };
    setManualMap(next);
    saveManualMap(next);
  }

  return (
    <div className="equipmentPage">
      <section className="equipmentHero">
        <div className="equipmentHeroCopy">
          <span className="equipmentHeroIcon"><Route size={26} /></span>
          <div>
            <h2>{t('כביש 6 — יבוא תנועות יומן לסאפ')}</h2>
            <p>{t('מעלים את חשבונית המס של כביש 6 (PDF), אפשר כמה חשבוניות יחד, ומקבלים את קבצי היבוא לסאפ.')}</p>
          </div>
        </div>
        <label className={`equipmentImportButton${busy ? ' importing' : ''}`}>
          <Upload size={18} />
          <span>{busy ? t('מעבד...') : t('העלאת חשבוניות כביש 6')}</span>
          <input ref={inputRef} type="file" accept=".pdf,application/pdf" multiple disabled={busy} onChange={onFiles} />
        </label>
      </section>

      <AccountingGuide guide={TOLLS_GUIDE} />

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
        <JournalView key={journal.invoiceNumber} journal={journal} fileName={fileName} onSaveCard={saveCard} />
      ))}
    </div>
  );
}
