import { useState } from 'react';
import { CalendarDays, FileText, Paperclip, Send, X } from 'lucide-react';
import { t } from '../../language/LanguageContext.jsx';
import { PDF_OR_IMAGE_ACCEPT } from '../utils/projectFiles.js';

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
  const [workDate, setWorkDate] = useState(todayInputValue);
  const [updateType, setUpdateType] = useState('addition');
  const [reviewImpact, setReviewImpact] = useState('no_change');
  const [summary, setSummary] = useState('');
  const [attachments, setAttachments] = useState([]);

  const canSubmit = summary.trim().length >= 5 && workDate && !submitting;

  return (
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions -- the close button provides keyboard access
    <div
      className="modalBackdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby={`continuation-report-title-${project.id}`}
      onClick={() => !submitting && onClose()}
    >
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- prevent backdrop dismissal for clicks inside the dialog */}
      <div className="statusNoteModal continuationReportDialog" onClick={(event) => event.stopPropagation()}>
        <div className="modalHeader statusNoteHeader">
          <div>
            <span className="projectDocumentsEyebrow">מנת שרטוט חדשה</span>
            <h3 id={`continuation-report-title-${project.id}`}>העברת המשך עבודה לשרטוט</h3>
            <p className="muted">
              תיווצר מנה עצמאית בפרויקט {project.name}, בלי לשנות את הסטטוס „{t(project.status)}”.
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
            <span>תאריך העבודה</span>
            <span className="continuationDateField">
              <CalendarDays size={17} />
              <input
                type="date"
                value={workDate}
                max={todayInputValue()}
                disabled={submitting}
                onChange={(event) => setWorkDate(event.target.value)}
              />
            </span>
          </label>

          <label>
            <span>סוג העדכון</span>
            <select
              value={updateType}
              disabled={submitting}
              onChange={(event) => setUpdateType(event.target.value)}
            >
              {updateTypes.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
        </div>

        <label>
          <span>האם המידע החדש משפיע על השרטוט שנמצא בהגהה?</span>
          <select
            value={reviewImpact}
            disabled={submitting}
            onChange={(event) => setReviewImpact(event.target.value)}
          >
            {reviewImpacts.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>

        <label>
          <span>חומרים למנת השרטוט, אופציונלי</span>
          <span className="filePickerControl continuationAttachmentPicker">
            <Paperclip size={18} />
            <span>
              {attachments.length
                ? `${attachments.length} קבצים נבחרו`
                : 'בחירת PDF או תמונות מהשטח'}
            </span>
            <input
              type="file"
              multiple
              accept={PDF_OR_IMAGE_ACCEPT}
              disabled={submitting}
              onChange={(event) => setAttachments(Array.from(event.target.files || []))}
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
                  aria-label={`הסרת הקובץ ${file.name}`}
                >
                  <X size={14} />
                </button>
              </li>
            ))}
          </ul>
        )}

        <label>
          <span>מה בוצע ומה צריך להעביר לשרטוט?</span>
          <textarea
            value={summary}
            disabled={submitting}
            maxLength={2000}
            onChange={(event) => setSummary(event.target.value)}
            placeholder="לדוגמה: הושלמו מדידות בצד המזרחי ונוספו שתי נקודות חיבור חדשות..."
          />
          <small className="continuationReportHint">לפחות 5 תווים · {summary.length}/2000</small>
        </label>

        <div className="continuationReportNotice">
          המנה תקבל מספר וסטטוס משלה. השרטוט שבהגהה לא יוחזר אוטומטית, ואם המידע משפיע עליו השרטט והמנהל יקבלו התראה ברורה.
        </div>

        <div className="modalActions">
          <button
            type="button"
            disabled={!canSubmit}
            onClick={() =>
              onSubmit({ workDate, updateType, reviewImpact, summary, attachments })
            }
          >
            <Send size={17} />
            {submitting ? 'יוצר מנת שרטוט...' : 'צור ושלח לשרטוט'}
          </button>
          <button type="button" className="ghost" disabled={submitting} onClick={onClose}>
            {t('ביטול')}
          </button>
        </div>
      </div>
    </div>
  );
}
