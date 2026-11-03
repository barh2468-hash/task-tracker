import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { t, useLanguage } from '../../language/LanguageContext.jsx';
import { localeForLanguage } from '../../language/locale.js';
import { createSignedUrl } from '../../../services/api/storage.js';
import { outcomeLabels, latestTaskReport } from './model.js';
import './task-reports.css';

export default function TaskReportHistory({ task }) {
  useTranslation();
  const { language } = useLanguage();
  const [error, setError] = useState(false);
  const [opening, setOpening] = useState(null);
  const latest = latestTaskReport(task);
  if (!latest) return null;
  async function openDocument(attachment) {
    setOpening(attachment.id);
    setError(false);
    // Open synchronously to avoid mobile popup blocking after the URL request.
    const tab = window.open('about:blank', '_blank');
    if (tab) tab.opener = null;
    try {
      const { data, error: failure } = await createSignedUrl(
        'project-documents',
        attachment.file_path,
      );
      if (failure || !data?.signedUrl) throw failure;
      if (tab) tab.location.href = data.signedUrl;
      else window.location.assign(data.signedUrl);
    } catch {
      tab?.close();
      setError(true);
    } finally {
      setOpening(null);
    }
  }
  return (
    <div className="taskReportHistory">
      <span className="taskReportState">
        {t(outcomeLabels[latest.outcome])}
        {latest.pending_sync ? ` · ${t('ממתין לסנכרון')}` : ''}
      </span>
      <p>{latest.summary}</p>
      <details>
        <summary>
          {t('דיווחי ביצוע והמשך טיפול ({{count}})', {
            count: task.project_task_reports.length.toLocaleString(localeForLanguage(language)),
          })}
        </summary>
        {[...task.project_task_reports]
          .sort((a, b) => b.created_at.localeCompare(a.created_at))
          .map((report) => (
            <article key={report.id}>
              <b>{t(outcomeLabels[report.outcome])}</b>
              <small>
                {' '}
                · {report.reporter?.full_name} ·{' '}
                {new Date(report.created_at).toLocaleString(localeForLanguage(language), {
                  timeZone: 'Asia/Jerusalem',
                })}
              </small>
              <h4>{t('הבקשה המקורית')}</h4>
              <p>{report.request_title || task.title}</p>
              {report.request_description && <p>{report.request_description}</p>}
              <h4>{t('דיווח העובד')}</h4>
              <p>{report.summary}</p>
              {report.next_steps && (
                <>
                  <h4>{t('המשך טיפול')}</h4>
                  <p>{report.next_steps}</p>
                </>
              )}
              {report.file_reference && (
                <>
                  <h4>{t('הפניה לקובץ קיים')}</h4>
                  <p>{report.file_reference}</p>
                </>
              )}
              {report.ready_for_drafting && (
                <p>
                  {t(
                    report.pending_sync
                      ? 'מנת השרטוט תיווצר לאחר הסנכרון.'
                      : 'הדיווח הועבר למנת שרטוט.',
                  )}
                </p>
              )}
              {(report.files || []).map(({ id, file }) => (
                <small key={id}>{t('הקובץ {{name}} ממתין להעלאה.', { name: file.name })}</small>
              ))}
              {(report.attachments || []).map((attachment) => (
                <button
                  key={attachment.id}
                  type="button"
                  className="ghost smallBtn"
                  disabled={opening === attachment.id}
                  onClick={() => void openDocument(attachment)}
                >
                  {opening === attachment.id
                    ? t('פותח קובץ...')
                    : t('פתיחת הקובץ {{name}}', { name: attachment.file_name })}
                </button>
              ))}
            </article>
          ))}
        {error && <p role="alert">{t('פתיחת הקובץ נכשלה. ניתן לנסות שוב מתוך מסמכי הפרויקט.')}</p>}
      </details>
    </div>
  );
}
