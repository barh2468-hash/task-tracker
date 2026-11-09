import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { t, useLanguage } from '../../language/LanguageContext.jsx';
import useProjectDialog from '../hooks/useProjectDialog.js';
import { PDF_OR_IMAGE_ACCEPT } from '../utils/projectFiles.js';
import { validateTaskReport, outcomeLabels } from './model.js';
import './task-reports.css';
import { projectName } from '../utils/projectName.js';

export default function TaskExecutionDialog({ task, project, onClose, onSubmit, loadAssets }) {
  useTranslation();
  const { language } = useLanguage();
  const initialFocus = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [assetsError, setAssetsError] = useState(false);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState(() => ({
    id: crypto.randomUUID(),
    task_id: task.id,
    outcome: task.is_done ? 'reopened' : 'completed',
    summary: '',
    next_steps: '',
    ready_for_drafting: false,
    review_impact: 'no_change',
    document_ids: [],
    file_reference: '',
    files: [],
  }));
  const dialogRef = useProjectDialog(
    true,
    () => {
      if (!busy) onClose();
    },
    initialFocus,
  );
  useEffect(() => {
    let active = true;
    if (!navigator.onLine) {
      setLoading(false);
      return;
    }
    loadAssets(project.id)
      .then((assets) => {
        if (active) setDocuments(assets.project_documents || []);
      })
      .catch(() => {
        if (active) setAssetsError(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [loadAssets, project.id]);
  useEffect(() => {
    const old = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = old;
    };
  }, []);
  function change(key, value) {
    setDraft((previous) => ({ ...previous, [key]: value }));
  }
  async function save(event) {
    event.preventDefault();
    if (busy) return;
    const validation = validateTaskReport(draft);
    if (validation) {
      setError(validation);
      return;
    }
    setBusy(true);
    setError('');
    try {
      const result = await onSubmit({ ...draft, language });
      if (!result?.ok)
        setError(
          result?.errorKey || 'שמירת דיווח הביצוע נכשלה. הפרטים נשארו בחלון וניתן לנסות שוב.',
        );
    } catch {
      setError('שמירת דיווח הביצוע נכשלה. הפרטים נשארו בחלון וניתן לנסות שוב.');
    } finally {
      setBusy(false);
    }
  }
  return createPortal(
    <div
      className="modalBackdrop taskReportBackdrop"
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="task-report-title"
    >
      <form className="taskReportDialog" onSubmit={save} noValidate>
        <header>
          <h2 id="task-report-title">
            {t(task.is_done ? 'פתיחת משימה מחדש' : 'דיווח ביצוע משימה')}
          </h2>
          <p>{projectName(project)}</p>
        </header>
        <div className="taskReportBody">
          <section className="taskReportRequest">
            <h3>{t('הבקשה המקורית')}</h3>
            <b>{task.title}</b>
            {task.description && <p>{task.description}</p>}
          </section>
          <label>
            {t('מצב הביצוע')}
            <select
              ref={initialFocus}
              value={draft.outcome}
              disabled={busy || task.is_done}
              onChange={(event) =>
                setDraft((previous) => ({
                  ...previous,
                  outcome: event.target.value,
                  next_steps: ['partial', 'blocked'].includes(event.target.value)
                    ? previous.next_steps
                    : '',
                  ready_for_drafting: ['blocked', 'reopened'].includes(event.target.value)
                    ? false
                    : previous.ready_for_drafting,
                }))
              }
            >
              {Object.entries(outcomeLabels)
                .filter(([key]) => (task.is_done ? key === 'reopened' : key !== 'reopened'))
                .map(([key, label]) => (
                  <option key={key} value={key}>
                    {t(label)}
                  </option>
                ))}
            </select>
          </label>
          <label>
            {t(task.is_done ? 'סיבת הפתיחה מחדש (חובה)' : 'מה בוצע בפועל או מה מנע ביצוע? (חובה)')}
            <textarea
              dir="auto"
              rows={4}
              required
              minLength={5}
              maxLength={4000}
              disabled={busy}
              value={draft.summary}
              placeholder={t('יש לענות לבקשה המקורית ולתאר את התוצאה בפועל.')}
              onChange={(event) => change('summary', event.target.value)}
            />
          </label>
          {['partial', 'blocked'].includes(draft.outcome) && (
            <label>
              {t('מה נשאר להמשך או איזו הבהרה נדרשת? (חובה)')}
              <textarea
                dir="auto"
                rows={3}
                required
                minLength={5}
                maxLength={4000}
                disabled={busy}
                value={draft.next_steps}
                onChange={(event) => change('next_steps', event.target.value)}
              />
              <small>{t('המשימה תישאר פתוחה להמשך טיפול.')}</small>
            </label>
          )}
          {!task.is_done && (
            <>
              <label>
                {t('צירוף תמונות או PDF')}
                <input
                  type="file"
                  multiple
                  accept={PDF_OR_IMAGE_ACCEPT}
                  disabled={busy}
                  onChange={(event) => {
                    change('files', [
                      ...draft.files,
                      ...Array.from(event.target.files || []).map((file) => ({
                        id: crypto.randomUUID(),
                        file,
                      })),
                    ]);
                    event.target.value = '';
                  }}
                />
                <small>{t('עד 10 קבצים, עד 20MB לקובץ. אפשר לשמור גם ללא חיבור לאינטרנט.')}</small>
              </label>
              {draft.files.map(({ id, file }) => (
                <div className="taskReportFile" key={id}>
                  <span>{file.name}</span>
                  <button
                    className="ghost"
                    type="button"
                    disabled={busy}
                    aria-label={t('הסרת הקובץ {{name}} מהדיווח', { name: file.name })}
                    onClick={() =>
                      change(
                        'files',
                        draft.files.filter((f) => f.id !== id),
                      )
                    }
                  >
                    {t('הסרה')}
                  </button>
                </div>
              ))}
              {loading && <p role="status">{t('טוען קבצים קיימים...')}</p>}
              {assetsError && (
                <p role="status">
                  {t('לא ניתן לטעון קבצים קיימים. אפשר לצרף קובץ או לציין את שמו בהפניה.')}
                </p>
              )}
              {!!documents.length && (
                <fieldset disabled={busy}>
                  <legend>{t('קבצים שכבר נמצאים בפרויקט')}</legend>
                  {documents.map((doc) => (
                    <label className="taskReportCheck" key={doc.id}>
                      <input
                        type="checkbox"
                        checked={draft.document_ids.includes(doc.id)}
                        onChange={(event) =>
                          change(
                            'document_ids',
                            event.target.checked
                              ? [...draft.document_ids, doc.id]
                              : draft.document_ids.filter((id) => id !== doc.id),
                          )
                        }
                      />
                      <span>{doc.file_name}</span>
                    </label>
                  ))}
                </fieldset>
              )}
              <label>
                {t('הפניה לתמונה או לקובץ קיים (לא חובה)')}
                <input
                  value={draft.file_reference}
                  maxLength={1000}
                  disabled={busy}
                  placeholder={t('לדוגמה: תמונה 2 בתמונות הפרויקט, או שם הסקיצה')}
                  onChange={(event) => change('file_reference', event.target.value)}
                />
              </label>
              {['completed', 'partial'].includes(draft.outcome) && (
                <label className="taskReportCheck taskReportDrafting">
                  <input
                    type="checkbox"
                    checked={draft.ready_for_drafting}
                    disabled={busy}
                    onChange={(event) => change('ready_for_drafting', event.target.checked)}
                  />
                  <span>
                    {t('החלק שבוצע מוכן לשרטוט')}
                    <small>
                      {t('תיווצר מנת שרטוט עם הדיווח והקבצים. אפשר להעביר גם ביצוע חלקי.')}
                    </small>
                  </span>
                </label>
              )}
              {draft.ready_for_drafting && (
                <label>
                  {t('השפעה על שרטוט שכבר נמצא בהגהה')}
                  <select
                    value={draft.review_impact}
                    disabled={busy}
                    onChange={(event) => change('review_impact', event.target.value)}
                  >
                    <option value="no_change">{t('תוספת נפרדת — אין שינוי בהגהה')}</option>
                    <option value="changes_review">{t('נדרש עדכון לשרטוט שבהגהה')}</option>
                    <option value="unsure">{t('נדרשת החלטה של אחראי השרטוט')}</option>
                  </select>
                </label>
              )}
            </>
          )}
          {error && <p role="alert">{t(error)}</p>}
        </div>
        <footer>
          <button type="button" className="ghost" disabled={busy} onClick={onClose}>
            {t('ביטול')}
          </button>
          <button disabled={busy}>
            {busy ? t('שומר דיווח וקבצים...') : t('שמירת דיווח הביצוע')}
          </button>
        </footer>
      </form>
    </div>,
    document.body,
  );
}
