import { useTranslation } from 'react-i18next';
import { t, useLanguage } from '../../language/LanguageContext.jsx';
import { localeForLanguage } from '../../language/locale.js';
import { projectWorkNotes } from '../utils/workNotes.js';

export default function ProjectWorkNotes({ sessions, loading, error, onRetry }) {
  useTranslation();
  const { language } = useLanguage();
  const notes = projectWorkNotes(sessions);
  return (
    <section className="projectWorkNotes" aria-label={t('projectWorkNotes.title')} aria-busy={loading}>
      <h3>{t('projectWorkNotes.title')}</h3>
      {error ? (
        <div role="alert">
          <p>{t('projectWorkNotes.error')}</p>
          <button type="button" className="ghost smallBtn" onClick={onRetry}>{t('נסה שוב')}</button>
        </div>
      ) : loading && !notes.length ? (
        <p className="muted" role="status">{t('projectWorkNotes.loading')}</p>
      ) : !Array.isArray(sessions) ? (
        <p className="muted" role="status">{t('projectWorkNotes.unavailable')}</p>
      ) : !notes.length ? (
        <p className="muted">{t('projectWorkNotes.empty')}</p>
      ) : (
        <ul className="projectWorkNotesList">
          {notes.map((session) => (
            <li key={session.id}>
              <div className="projectWorkNoteMeta">
                <bdi>{session.profiles?.full_name || t('עובד')}</bdi>
                <time dateTime={session.started_at}>
                  {new Date(session.started_at).toLocaleString(localeForLanguage(language), { timeZone: 'Asia/Jerusalem' })}
                </time>
              </div>
              <p dir="auto">{session.end_note}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
