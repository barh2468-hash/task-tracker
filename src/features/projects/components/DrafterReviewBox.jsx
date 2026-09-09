import { useTranslation } from 'react-i18next';
import { t } from '../../language/LanguageContext.jsx';
import { useRef, useState } from 'react';
import { FileText, LoaderCircle, Send } from 'lucide-react';
export default function DrafterReviewBox({
  reviewFile,
  setReviewFile,
  reviewNote,
  setReviewNote,
  onSend,
}) {
  useTranslation();
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef(null);

  async function handleSend() {
    if (!reviewFile || uploading) return;
    setUploading(true);
    try {
      const result = await onSend();
      if (result?.ok && inputRef.current) inputRef.current.value = '';
    } finally {
      setUploading(false);
    }
  }

  return (
    <section className={`projectSectionPanel reviewBox drafterReviewBox ${uploading ? 'uploading' : ''}`}>
      <div>
        <b>{t('שליחה להגהה')}</b>
        <p className="muted" style={{ margin: '4px 0 0' }}>
          {t('העלה PDF ושלח התראה לעובדי השטח, למנהלים ולשרטטים.')}
        </p>
      </div>
      <label>
        {t('קובץ PDF להגהה')}

        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          disabled={uploading}
          onChange={(e) => setReviewFile(e.target.files?.[0] || null)}
        />
      </label>
      {reviewFile && (
        <span className="muted">
          {t('נבחר:')}
          {reviewFile.name}
        </span>
      )}
      <textarea
        value={reviewNote}
        disabled={uploading}
        onChange={(e) => setReviewNote(e.target.value)}
        placeholder={t('הערה לעובדי השטח, אופציונלי')}
      />

      {uploading && (
        <div className="reviewUploadAnimation" role="status" aria-live="polite">
          <span className="reviewDocumentPulse">
            <FileText size={26} />
            <LoaderCircle className="reviewUploadSpinner" size={18} />
          </span>
          <span>
            <b>{t('מעלה את מסמך ההגהה...')}</b>
            <small>{t('הקובץ נשמר והפרויקט מועבר לסטטוס הגהה')}</small>
          </span>
        </div>
      )}

      <button className="smallBtn danger" onClick={handleSend} disabled={!reviewFile || uploading}>
        {uploading ? <LoaderCircle className="spinIcon" size={17} /> : <Send size={17} />}
        {uploading ? t('שולח להגהה...') : t('שלח להגהה')}
      </button>
    </section>
  );
}
