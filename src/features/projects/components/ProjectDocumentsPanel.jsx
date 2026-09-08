import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Download, ExternalLink, FileText, LoaderCircle, Trash2, Upload } from 'lucide-react';
import { t } from '../../language/LanguageContext.jsx';
import { createSignedUrl } from '../../../services/api/storage.js';

const MAX_FILE_SIZE = 20 * 1024 * 1024;

function formatFileSize(size) {
  if (!Number.isFinite(size) || size <= 0) return '';
  if (size < 1024 * 1024) return `${Math.ceil(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export default function ProjectDocumentsPanel({
  documents,
  canUpload,
  canDelete,
  onUpload,
  onDelete,
}) {
  useTranslation();
  const [links, setLinks] = useState({});
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadLinks() {
      const entries = await Promise.all(
        documents.map(async (document) => {
          const [viewResult, downloadResult] = await Promise.all([
            createSignedUrl('project-documents', document.file_path, 60 * 60),
            createSignedUrl('project-documents', document.file_path, 60 * 60, {
              download: document.file_name,
            }),
          ]);
          return [
            document.id,
            {
              view: viewResult.data?.signedUrl || '',
              download: downloadResult.data?.signedUrl || '',
            },
          ];
        }),
      );
      if (!cancelled) setLinks(Object.fromEntries(entries));
    }

    loadLinks();
    return () => {
      cancelled = true;
    };
  }, [documents]);

  if (!documents.length && !canUpload) return null;

  async function handleUpload(event) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file || uploading) return;

    setUploading(true);
    try {
      await onUpload(file);
    } finally {
      setUploading(false);
      input.value = '';
    }
  }

  return (
    <section className="projectDocumentsPanel">
      <header className="projectDocumentsHeader">
        <div>
          <span className="projectDocumentsEyebrow">{t('מסמכים משותפים לפרויקט')}</span>
          <h3>
            <FileText size={19} /> {t('מסמכי PDF')}
          </h3>
        </div>
        <div className="projectDocumentsHeaderActions">
          <span className="projectDocumentsCount">{documents.length}</span>
          {canUpload && (
            <label className={`projectDocumentUpload ${uploading ? 'uploading' : ''}`}>
              {uploading ? <LoaderCircle size={16} /> : <Upload size={16} />}
              {uploading ? t('מעלה PDF...') : t('העלאת PDF')}
              <input
                type="file"
                accept="application/pdf,.pdf"
                disabled={uploading}
                onChange={handleUpload}
                aria-label={t('העלאת PDF')}
                data-max-size={MAX_FILE_SIZE}
              />
            </label>
          )}
        </div>
      </header>

      {documents.length === 0 ? (
        <div className="projectDocumentsEmpty">
          <FileText size={24} />
          <span>{t('אין עדיין מסמכי PDF בפרויקט')}</span>
        </div>
      ) : (
        <div className="projectDocumentsList">
          {documents.map((document) => (
            <article className="projectDocumentItem" key={document.id}>
              <span className="projectDocumentIcon">
                <FileText size={20} />
              </span>
              <div className="projectDocumentInfo">
                <b title={document.file_name}>{document.file_name}</b>
                <small>
                  {formatFileSize(Number(document.file_size))}
                  {document.profiles?.full_name
                    ? ` · ${t('הועלה על ידי')} ${document.profiles.full_name}`
                    : ''}
                  {' · '}
                  {new Date(document.created_at).toLocaleString('he-IL')}
                </small>
              </div>
              <div className="projectDocumentActions">
                {links[document.id]?.view && (
                  <a
                    href={links[document.id].view}
                    target="_blank"
                    rel="noreferrer"
                    title={t('פתיחת PDF')}
                  >
                    <ExternalLink size={15} />
                    <span>{t('פתח PDF')}</span>
                  </a>
                )}
                {links[document.id]?.download && (
                  <a href={links[document.id].download} title={t('הורדת PDF')}>
                    <Download size={15} />
                    <span>{t('הורדה')}</span>
                  </a>
                )}
                {canDelete(document) && (
                  <button
                    type="button"
                    className="danger ghost"
                    onClick={() => onDelete(document)}
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
      )}
    </section>
  );
}
