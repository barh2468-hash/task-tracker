import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Download, Eye, FileText, LoaderCircle, Trash2, Upload } from 'lucide-react';
import { t } from '../../language/LanguageContext.jsx';
import { createSignedUrl } from '../../../services/api/storage.js';
import PdfPreviewModal from './PdfPreviewModal.jsx';

const MAX_FILE_SIZE = 20 * 1024 * 1024;

const documentTypes = [
  { value: 'drawing_source', label: 'חומר מהשטח לשרטוט' },
  { value: 'drawing_correction', label: 'מסמך לתיקוני שרטוט' },
  { value: 'boundary_sketch', label: 'סקיצת גבול עבודה' },
  { value: 'general', label: 'מסמך כללי' },
];

function documentTypeLabel(type) {
  return documentTypes.find((item) => item.value === type)?.label || 'מסמך כללי';
}

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
  defaultDocumentType = 'general',
}) {
  useTranslation();
  const [links, setLinks] = useState({});
  const [uploading, setUploading] = useState(false);
  const [documentType, setDocumentType] = useState(defaultDocumentType);
  const [previewDocument, setPreviewDocument] = useState(null);

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
      await onUpload(file, documentType);
    } finally {
      setUploading(false);
      input.value = '';
    }
  }

  return (
    <>
      <section className="projectSectionPanel projectDocumentsPanel">
      <header className="projectSectionHeader projectDocumentsHeader">
        <div>
          <span className="projectDocumentsEyebrow">{t('מסמכים מהשטח לשרטט')}</span>
          <h3>
            <FileText size={19} /> {t('מסמכי PDF לשרטוט ולתיקונים')}
          </h3>
        </div>
        <div className="projectDocumentsHeaderActions">
          <span className="projectDocumentsCount">{documents.length}</span>
          {canUpload && (
            <div className="projectDocumentUploadControls">
              <label className="projectDocumentType">
                <span>{t('מטרת המסמך')}</span>
                <select
                  value={documentType}
                  disabled={uploading}
                  onChange={(event) => setDocumentType(event.target.value)}
                >
                  {documentTypes.map((type) => (
                    <option key={type.value} value={type.value}>
                      {t(type.label)}
                    </option>
                  ))}
                </select>
              </label>
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
            </div>
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
                <span className="projectDocumentTypeBadge">
                  {t(documentTypeLabel(document.document_type))}
                </span>
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
                  <button
                    type="button"
                    onClick={() =>
                      setPreviewDocument({ url: links[document.id].view, fileName: document.file_name })
                    }
                    title={t('תצוגה מקדימה של PDF')}
                  >
                    <Eye size={15} />
                    <span>{t('צפייה')}</span>
                  </button>
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
      <PdfPreviewModal
        url={previewDocument?.url}
        fileName={previewDocument?.fileName || t('קובץ PDF')}
        onClose={() => setPreviewDocument(null)}
      />
    </>
  );
}
