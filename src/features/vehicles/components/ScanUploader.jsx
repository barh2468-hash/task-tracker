import { useRef, useState } from 'react';
import { Sparkles } from 'lucide-react';
import Button from '../../../components/ui/Button.jsx';
import { t } from '../../language/LanguageContext.jsx';
import { analyzeScan, discardScan, uploadScan } from '../api.js';

const ERROR_TEXT = {
  ai_not_configured: 'ניתוח אוטומטי עדיין לא הופעל. אפשר למלא את הפרטים ידנית (הקובץ נשמר).',
  ai_failed: 'הניתוח האוטומטי נכשל. אפשר למלא את הפרטים ידנית (הקובץ נשמר).',
  ai_no_result: 'לא הצלחתי לקרוא את המסמך. אפשר למלא את הפרטים ידנית (הקובץ נשמר).',
  unsupported_type: 'סוג הקובץ אינו נתמך לניתוח.',
  file_too_large: 'הקובץ גדול מדי לניתוח.',
};

/**
 * Uploads a scan, asks the AI to read it, and hands the result to the parent
 * for review. The file is kept even when analysis fails so the secretary can
 * fill the fields by hand. `kind`: 'fine' | 'policy' | 'inspection'.
 */
export default function ScanUploader({ kind, onResult, onDiscard, label }) {
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [scan, setScan] = useState(null);

  async function pick(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setNotice('');
    try {
      if (scan) await discardScan(scan);
      const uploaded = await uploadScan(file);
      setScan(uploaded);
      const result = await analyzeScan(uploaded, kind);
      if (result?.ok) {
        onResult({ scan: uploaded, fields: result.fields, uncertain: result.uncertain || [] });
      } else {
        setNotice(t(ERROR_TEXT[result?.error] || ERROR_TEXT.ai_failed));
        onResult({ scan: uploaded, fields: null, uncertain: [] });
      }
    } catch (error) {
      setNotice(error?.message || t('ההעלאה נכשלה.'));
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  async function discard() {
    await discardScan(scan);
    setScan(null);
    setNotice('');
    onDiscard?.();
  }

  return (
    <div className="innerPanel">
      <Button variant="secondary" disabled={busy} onClick={() => inputRef.current?.click()}>
        <Sparkles size={16} /> {busy ? t('קורא את המסמך...') : label || t('מילוי אוטומטי מסריקה')}
      </Button>
      <input ref={inputRef} type="file" accept="application/pdf,image/jpeg,image/png" hidden onChange={pick} />
      {scan && !busy && (
        <span className="muted"> {scan.name} · <button type="button" className="ghost tinyBtn" onClick={discard}>{t('הסרה')}</button></span>
      )}
      {notice && <p className="muted" role="status">{notice}</p>}
    </div>
  );
}
