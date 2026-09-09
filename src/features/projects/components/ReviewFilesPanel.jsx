import { useTranslation } from 'react-i18next';
import { t } from '../../language/LanguageContext.jsx';
import { useEffect, useState } from 'react';
import { ExternalLink, FileText, Trash2 } from 'lucide-react';
import { createSignedUrl } from '../../../services/api/storage.js';

export default function ReviewFilesPanel({ files, canDelete, onDelete }) {
  useTranslation();
  const [urls, setUrls] = useState({});

  useEffect(() => {
    let cancelled = false;
    async function loadUrls() {
      const next = {};
      for (const file of files) {
        const { data } = await createSignedUrl('project-review-files', file.file_path, 60 * 60);
        if (data?.signedUrl) next[file.id] = data.signedUrl;
      }
      if (!cancelled) setUrls(next);
    }
    loadUrls();
    return () => {
      cancelled = true;
    };
  }, [files]);

  if (!files.length) return null;
  return (
    <section className="projectSectionPanel reviewFilesBox">
      <header className="projectSectionHeader projectDocumentsHeader">
        <div>
          <span className="projectDocumentsEyebrow">{t('מסמכים מהשרטט')}</span>
          <h3>
            <FileText size={19} /> {t('קבצי הגהה')}
          </h3>
        </div>
        <span className="projectDocumentsCount">{files.length}</span>
      </header>
      <div className="projectDocumentsList">
        {files.map((file) => (
          <article className="projectDocumentItem" key={file.id}>
            <span className="projectDocumentIcon reviewFileIcon">
              <FileText size={20} />
            </span>
            <div className="projectDocumentInfo">
              <b title={file.file_name || t('קובץ PDF')}>
                {file.file_name || t('קובץ PDF')}
              </b>
              <small>
                {t('הועלה על ידי')} {file.profiles?.full_name || t('שרטט')} ·{' '}
                {new Date(file.created_at).toLocaleString('he-IL')}
              </small>
            </div>
            <div className="projectDocumentActions">
              {urls[file.id] && (
                <a href={urls[file.id]} target="_blank" rel="noreferrer" title={t('פתיחת PDF')}>
                  <ExternalLink size={15} />
                  <span>{t('פתח PDF')}</span>
                </a>
              )}
              {canDelete && (
                <button
                  type="button"
                  className="danger ghost"
                  onClick={() => onDelete(file)}
                  title={t('מחיקת PDF')}
                >
                  <Trash2 size={15} />
                  <span>{t('מחיקה')}</span>
                </button>
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
