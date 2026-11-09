import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import { CalendarDays, FileText, Paperclip, Send, X } from 'lucide-react';
import { t, useLanguage } from '../../language/LanguageContext.jsx';
import { localeForLanguage } from '../../language/locale.js';
import { PDF_OR_IMAGE_ACCEPT } from '../utils/projectFiles.js';
import useProjectDialog from '../hooks/useProjectDialog.js';
import { projectName } from '../utils/projectName.js';

const updateTypes = [
  { value: 'addition', label: 'תוספת לעבודה שכבר דווחה' },
  { value: 'correction', label: 'תיקון למידע שכבר נשלח' },
  { value: 'new_phase', label: 'שלב חדש ונפרד בפרויקט' },
];

const reviewImpacts = [
  { value: 'no_change', label: 'לא — זו תוספת נפרדת' },
  { value: 'changes_review', label: 'כן — נדרש לעדכן את השרטוט שבהגהה' },
  { value: 'unsure', label: 'לא בטוח — החלטה של אחראי השרטוט' },
];

function todayInputValue() {
  const now = new Date();
  const timezoneOffset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - timezoneOffset).toISOString().slice(0, 10);
}

export default function ContinuationReportDialog({ project, submitting, onClose, onSubmit }) {
  useTranslation();
  const { language } = useLanguage();
  const dialogRef = useProjectDialog(true, () => {
    if (!submitting) onClose();
  });
  const [workDate, setWorkDate] = useState(todayInputValue);
  const [updateType, setUpdateType] = useState('addition');
  const [reviewImpact, setReviewImpact] = useState('no_change');
  const [summary, setSummary] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [savedBatch, setSavedBatch] = useState(null);
  const [requestId] = useState(() => crypto.randomUUID());
  const [failure, setFailure] = useState(null);
  const detailsLocked = submitting || Boolean(savedBatch);

  const canSubmit = summary.trim().length >= 5 && workDate && !submitting;

  async function submit() {
    if (!canSubmit) return;
    setFailure(null);
    try {
      const result = await onSubmit({
        workDate,
        updateType,
        reviewImpact,
        summary,
        attachments,
        drawingBatchId: savedBatch?.id,
        requestId,
      });
      if (result?.drawingBatch) setSavedBatch(result.drawingBatch);
      if (result?.failedAttachments) setAttachments(result.failedAttachments);
      if (!result?.ok) setFailure(result || {});
    } catch {
      setFailure({});
    }
  }

  return (
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions -- the close button provides keyboard access
    <div
      className="modalBackdrop"
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={`continuation-report-title-${project.id}`}
      onClick={() => !submitting && onClose()}
    >
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- prevent backdrop dismissal for clicks inside the dialog */}
      <div
        className="statusNoteModal continuationReportDialog projectDialogControls"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modalHeader statusNoteHeader">
          <div>
            <span className="projectDocumentsEyebrow">{t('מנת שרטוט חדשה')}</span>
            <h3 id={`continuation-report-title-${project.id}`}>{t('העברת המשך עבודה לשרטוט')}</h3>
            <p className="muted">
              {savedBatch
                ? t('השלמת קבצים למנה {{number}}', {
                    number: savedBatch.batch_number.toLocaleString(localeForLanguage(language)),
                  })
                : t('תיווצר מנה עצמאית בפרויקט {{name}}, בלי לשנות את הסטטוס „{{status}}”.', {
                    name: projectName(project),
                    status: t(project.status),
                  })}
            </p>
          </div>
          <button
            type="button"
            className="ghost iconBtn"
            disabled={submitting}
            onClick={onClose}
            aria-label={t('סגור')}
          >
            <X size={18} />
          </button>
        </div>

        <div className="continuationReportGrid">
          <label>
            <span>{t('תאריך העבודה')}</span>
            <span className="continuationDateField">
              <CalendarDays size={17} />
              <input
                type="date"
                value={workDate}
                max={todayInputValue()}
                disabled={detailsLocked}
                onChange={(event) => setWorkDate(event.target.value)}
              />
            </span>
          </label>

          <label>
            <span>{t('סוג העדכון')}</span>
            <select
              value={updateType}
              disabled={detailsLocked}
              onChange={(event) => setUpdateType(event.target.value)}
            >
              {updateTypes.map((option) => (
                <option key={option.value} value={option.value}>
                  {t(option.label)}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label>
          <span>{t('האם המידע החדש משפיע על השרטוט שנמצא בהגהה?')}</span>
          <select
            value={reviewImpact}
            disabled={detailsLocked}
            onChange={(event) => setReviewImpact(event.target.value)}
          >
            {reviewImpacts.map((option) => (
              <option key={option.value} value={option.value}>
                {t(option.label)}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>{t('חומרים למנת השרטוט, אופציונלי')}</span>
          <span className="filePickerControl continuationAttachmentPicker">
            <Paperclip size={18} />
            <span>
              {attachments.length
                ? t('{{count}} קבצים נבחרו', { count: attachments.length })
                : t('בחירת PDF או תמונות מהשטח')}
            </span>
            <input
              type="file"
              multiple
              accept={PDF_OR_IMAGE_ACCEPT}
              disabled={submitting}
              onChange={(event) => {
                const selectedFiles = Array.from(event.target.files || []);
                setAttachments((files) => [...files, ...selectedFiles]);
                event.target.value = '';
              }}
            />
          </span>
        </label>

        {attachments.length > 0 && (
          <ul className="reviewSelectedFiles continuationAttachmentList">
            {attachments.map((file, index) => (
              <li key={`${file.name}-${file.size}-${file.lastModified}-${index}`}>
                <FileText size={15} />
                <span>{file.name}</span>
                <button
                  type="button"
                  className="reviewSelectedFileRemove"
                  disabled={submitting}
                  onClick={() =>
                    setAttachments((files) => files.filter((_, fileIndex) => fileIndex !== index))
                  }
                  aria-label={t('הסרת הקובץ {{name}}', { name: file.name })}
                >
                  <X size={14} />
                </button>
              </li>
            ))}
          </ul>
        )}

        <label>
          <span>{t('מה בוצע ומה צריך להעביר לשרטוט?')}</span>
          <textarea
            value={summary}
            disabled={detailsLocked}
            maxLength={2000}
            onChange={(event) => setSummary(event.target.value)}
            placeholder={t('לדוגמה: הושלמו מדידות בצד המזרחי ונוספו שתי נקודות חיבור חדשות...')}
          />
          <small className="continuationReportHint">
            {t('לפחות 5 תווים · {{count}}/2000', { count: summary.length })}
          </small>
        </label>

        <div className="continuationReportNotice">
          {t(
            'המנה תקבל מספר וסטטוס משלה. השרטוט שבהגהה לא יוחזר אוטומטית, ואם המידע משפיע עליו השרטט והמנהל יקבלו התראה ברורה.',
          )}
        </div>

        {failure && (
          <div className="continuationUploadError" role="alert">
            <b>
              {failure.errorKey
                ? t(failure.errorKey, failure.errorOptions)
                : savedBatch
                  ? t('מנה {{number}} נשמרה, אך חלק מהקבצים לא הועלו.', {
                      number: savedBatch.batch_number.toLocaleString(localeForLanguage(language)),
                    })
                  : t('שליחת הדיווח נכשלה. הפרטים והקבצים נשארו בחלון.')}
            </b>
            <span>
              {t(
                failure.reasonKey ||
                  'הקבצים שנותרו ברשימה לא הועלו. בדוק את החיבור ואת הקבצים ונסה שוב. ניתן להעלות PDF או תמונה עד 20MB.',
              )}
            </span>
          </div>
        )}

        <div className="modalActions">
          <button
            type="button"
            className="projectPrimaryAction"
            disabled={!canSubmit}
            onClick={submit}
          >
            <Send size={17} />
            {submitting
              ? t('שומר דיווח ומעלה קבצים...')
              : savedBatch
                ? t('נסה שוב באותה מנה')
                : t('צור ושלח לשרטוט')}
          </button>
          <button type="button" className="ghost" disabled={submitting} onClick={onClose}>
            {t('ביטול')}
          </button>
        </div>
      </div>
    </div>
  );
}
