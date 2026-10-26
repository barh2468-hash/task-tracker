import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Fuel, Info, Upload } from 'lucide-react';
import { t } from '../features/language/LanguageContext.jsx';
import AccountingGuide from '../features/accounting/components/AccountingGuide.jsx';
import { FUEL_GUIDE } from '../features/accounting/guides.js';
import { extractPdfLines, parseDelekPages } from '../features/accounting/fuel/parseDelekReport.js';
import { buildFuelJournal } from '../features/accounting/fuel/buildFuelJournal.js';
import { buildWashJournal } from '../features/accounting/fuel/buildWashJournal.js';
import JournalView from '../features/accounting/components/JournalView.jsx';
import { loadManualMap, saveManualMap } from '../features/accounting/fuel/cardMap.js';
import { SEED_VEHICLE_CARDS } from '../features/accounting/fuel/fuelConfig.js';

export default function AccountingFuelPage() {
  useTranslation();
  const inputRef = useRef(null);
  const [report, setReport] = useState(null);
  const [fileName, setFileName] = useState('');
  const [manualMap, setManualMap] = useState(loadManualMap);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const journals = useMemo(() => {
    if (!report) return null;
    const cardFor = (plateDigits) => manualMap[plateDigits] || SEED_VEHICLE_CARDS[plateDigits] || '';
    return { fuel: buildFuelJournal(report, cardFor), wash: buildWashJournal(report, cardFor) };
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

  return (
    <div className="equipmentPage">
      <section className="equipmentHero">
        <div className="equipmentHeroCopy">
          <span className="equipmentHeroIcon"><Fuel size={26} /></span>
          <div>
            <h2>{t('דלק ושטיפומט — יבוא תנועות יומן לסאפ')}</h2>
            <p>{t('מעלים את דוח הריכוז החודשי של דלק (PDF) ומקבלים את קבצי היבוא לדלק, ובחודשים שיש בהם שטיפות גם לשטיפומט.')}</p>
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

      {journals && (
        <>
          <JournalView journal={journals.fuel} fileName={fileName} onSaveCard={saveCard} />
          {journals.wash ? (
            <JournalView journal={journals.wash} fileName={fileName} onSaveCard={saveCard} />
          ) : (
            <div className="equipmentNotice warning" role="status">
              <Info size={20} />
              <div>
                <b>{t('שטיפומט')}</b>
                <span>{t('בחודש הזה אין שטיפות: אין חשבונית שטיפומט ואין דוח רחיצות בקובץ. אין מה לייבא לשטיפומט.')}</span>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
