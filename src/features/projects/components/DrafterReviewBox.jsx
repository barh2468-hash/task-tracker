import { useTranslation } from 'react-i18next';
import { t } from '../../language/LanguageContext.jsx';
import { useRef, useState } from 'react';
import { FileText, LoaderCircle, Send, Upload, X } from 'lucide-react';
import { appendReviewFiles } from '../utils/reviewFiles.js';
export default function DrafterReviewBox({
  reviewFiles,
  setReviewFiles,
  reviewNote,
  setReviewNote,
  onSend,
  title = 'שליחה להגהה',
  description = 'העלה קובץ PDF אחד או יותר ושלח התראה לעובדי השטח, למנהלים ולשרטטים.',
  progressDescription = 'הקבצים נשמרים והפרויקט מועבר לסטטוס הגהה',
}) {
  useTranslation();
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef(null);
  const selectedFiles = Array.isArray(reviewFiles) ? reviewFiles : [];

  async function handleSend() {
    if (!selectedFiles.length || uploading) return;
    setUploading(true);
    try {
      const result = await onSend();
      if (result?.ok && inputRef.current) inputRef.current.value = '';
    } finally {
      setUploading(false);
    }
  }

  function removeSelectedFile(fileIndex) {
    if (uploading) return;
    const nextFiles = selectedFiles.filter((_, index) => index !== fileIndex);
    setReviewFiles(nextFiles);
    if (!nextFiles.length && inputRef.current) inputRef.current.value = '';
  }

  return (
    <section
      className={`projectSectionPanel reviewBox drafterReviewBox ${uploading ? 'uploading' : ''}`}
    >
      <div>
        <b>{t(title)}</b>
        <p className="muted" style={{ margin: '4px 0 0' }}>
          {t(description)}
        </p>
        <p className="muted">{t('אפשר לבחור כמה קבצים יחד או להוסיף קבצים בבחירות נפרדות.')}</p>
      </div>
      <label className="reviewFileField">
        {t('קובצי PDF להגהה')}
        <span className={`reviewFilePicker ${selectedFiles.length ? 'hasFile' : ''}`}>
          {selectedFiles.length ? <FileText size={18} /> : <Upload size={18} />}
          <span>
            {selectedFiles.length
              ? t('{{count}} קובצי PDF נבחרו · הוספת קבצים', { count: selectedFiles.length })
              : t('בחירת קובצי PDF')}
          </span>
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf,.pdf"
            multiple
            disabled={uploading}
            onChange={(e) => {
              setReviewFiles(appendReviewFiles(selectedFiles, Array.from(e.target.files || [])));
              e.target.value = '';
            }}
            aria-label={selectedFiles.length ? t('הוספת קובצי PDF') : t('בחירת קובצי PDF')}
          />
        </span>
      </label>
      {selectedFiles.length > 0 && (
        <ul className="reviewSelectedFiles" aria-label={t('קובצי PDF שנבחרו')}>
          {selectedFiles.map((file, index) => (
            <li key={`${file.name}-${file.size}-${file.lastModified}-${index}`}>
              <span>{file.name}</span>
              <button
                type="button"
                className="reviewSelectedFileRemove"
                disabled={uploading}
                onClick={() => removeSelectedFile(index)}
                aria-label={t('הסרת הקובץ {{value0}}', { value0: file.name })}
                title={t('הסרת קובץ')}
              >
                <X size={15} />
              </button>
            </li>
          ))}
        </ul>
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
            <b>
              {selectedFiles.length > 1 ? t('מעלה את קובצי ההגהה...') : t('מעלה את מסמך ההגהה...')}
            </b>
            <small>{t(progressDescription)}</small>
          </span>
        </div>
      )}

      <button
        className="smallBtn projectPrimaryAction"
        onClick={handleSend}
        disabled={!selectedFiles.length || uploading}
      >
        {uploading ? <LoaderCircle className="spinIcon" size={17} /> : <Send size={17} />}
        {uploading ? t('שולח להגהה...') : t('שלח להגהה')}
      </button>
    </section>
  );
}
