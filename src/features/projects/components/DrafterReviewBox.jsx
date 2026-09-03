import { useTranslation } from 'react-i18next';
import { t } from '../../language/LanguageContext.jsx';
export default function DrafterReviewBox({
  reviewFile,
  setReviewFile,
  reviewNote,
  setReviewNote,
  onSend,
}) {
  useTranslation();
  return (
    <div
      className="reviewBox"
      style={{
        border: '1px solid #fecdd3',
        background: '#fff7f7',
        borderRadius: 18,
        padding: 16,
        display: 'grid',
        gap: 12,
      }}
    >
      <div>
        <b>{t('שליחה להגהה')}</b>
        <p className="muted" style={{ margin: '4px 0 0' }}>
          {t('העלה PDF ושלח התראה לעובדי השטח, למנהלים ולשרטטים.')}
        </p>
      </div>
      <label>
        {t('קובץ PDF להגהה')}

        <input
          type="file"
          accept="application/pdf,.pdf"
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
        onChange={(e) => setReviewNote(e.target.value)}
        placeholder={t('הערה לעובדי השטח, אופציונלי')}
      />

      <button className="smallBtn danger" onClick={onSend} disabled={!reviewFile}>
        {t('שלח להגהה')}
      </button>
    </div>
  );
}
