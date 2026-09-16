import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { Download, Eye, FileText, Image as ImageIcon, LoaderCircle, Trash2, Upload, X } from 'lucide-react';
import { t } from '../../language/LanguageContext.jsx';
import { createSignedUrl } from '../../../services/api/storage.js';
import PdfPreviewModal from './PdfPreviewModal.jsx';
import {
  documentTypeAllowsImages,
  isImageDocument,
  MAX_PROJECT_FILE_SIZE,
  PDF_ACCEPT,
  PDF_OR_IMAGE_ACCEPT,
} from '../utils/projectFiles.js';

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
  lockedDocumentType,
  title = 'קבצים לשרטוט ולתיקונים',
  eyebrow = 'מסמכים מהשטח לשרטט',
  compact = false,
}) {
  useTranslation();
  const [links, setLinks] = useState({});
  const [uploading, setUploading] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [documentType, setDocumentType] = useState(lockedDocumentType || defaultDocumentType);
  const [previewDocument, setPreviewDocument] = useState(null);
  const allowsImages = documentTypeAllowsImages(documentType);

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

  useEffect(() => {
    if (!uploadOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [uploadOpen]);

  if (!documents.length && !canUpload) return null;

  async function handleUpload(event) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file || uploading) return;

    setUploading(true);
    try {
      const result = await onUpload(file, lockedDocumentType || documentType);
      if (result?.ok) setUploadOpen(false);
    } finally {
      setUploading(false);
      input.value = '';
    }
  }

  return (
    <>
      <section
        className={`projectSectionPanel projectDocumentsPanel${compact ? ' projectDocumentsPanelCompact' : ''}`}
      >
      <header className="projectSectionHeader projectDocumentsHeader">
        <div>
          <span className="projectDocumentsEyebrow">{t(eyebrow)}</span>
          <h3>
            <FileText size={19} /> {t(title)}
          </h3>
        </div>
        <div className="projectDocumentsHeaderActions">
          <span className="projectDocumentsCount">{documents.length}</span>
          {canUpload && (
            <button
              type="button"
              className="projectDocumentUpload"
              disabled={uploading}
              onClick={() => setUploadOpen(true)}
            >
              {uploading ? <LoaderCircle size={16} /> : <Upload size={16} />}
              {uploading ? t('מעלה קובץ...') : t('העלאת קובץ')}
            </button>
          )}
        </div>
      </header>

      {documents.length === 0 ? (
        <div className="projectDocumentsEmpty">
          <FileText size={24} />
          <span>{t('אין עדיין קבצים בפרויקט')}</span>
        </div>
      ) : (
        <div className="projectDocumentsList">
          {documents.map((document) => (
            <article className="projectDocumentItem" key={document.id}>
              <span className="projectDocumentIcon">
                {isImageDocument(document) ? <ImageIcon size={20} /> : <FileText size={20} />}
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
                      setPreviewDocument({
                        url: links[document.id].view,
                        fileName: document.file_name,
                        isImage: isImageDocument(document),
                      })
                    }
                    title={t('תצוגה מקדימה של הקובץ')}
                  >
                    <Eye size={15} />
                    <span>{t('צפייה')}</span>
                  </button>
                )}
                {links[document.id]?.download && (
                  <a href={links[document.id].download} title={t('הורדת הקובץ')}>
                    <Download size={15} />
                    <span>{t('הורדה')}</span>
                  </a>
                )}
                {canDelete(document) && (
                  <button
                    type="button"
                    className="danger ghost"
                    onClick={() => onDelete(document)}
                    title={t('מחיקת הקובץ')}
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
        fileName={previewDocument?.fileName || t('קובץ')}
        isImage={previewDocument?.isImage}
        onClose={() => setPreviewDocument(null)}
      />
      {uploadOpen &&
        createPortal(
          // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions -- backdrop click-to-close is a pointer convenience; the dialog has a keyboard-accessible close button
          <div
            className="modalBackdrop"
            role="dialog"
            aria-modal="true"
            aria-labelledby={`document-upload-title-${defaultDocumentType}`}
            onClick={() => !uploading && setUploadOpen(false)}
          >
            {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- prevent backdrop dismissal for clicks inside the dialog */}
            <div
              className="statusNoteModal projectDocumentUploadDialog"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="modalHeader statusNoteHeader">
                <div>
                  <span className="projectDocumentsEyebrow">{t('מסמכים משותפים לפרויקט')}</span>
                  <h3 id={`document-upload-title-${defaultDocumentType}`}>
                    {t('העלאת קובץ לפרויקט')}
                  </h3>
                  <p className="muted">
                    {allowsImages
                      ? t('ניתן להעלות PDF או תמונה עד 20MB.')
                      : t('ניתן להעלות PDF עד 20MB.')}
                  </p>
                </div>
                <button
                  type="button"
                  className="ghost iconBtn"
                  disabled={uploading}
                  onClick={() => setUploadOpen(false)}
                  aria-label={t('סגור')}
                >
                  <X size={18} />
                </button>
              </div>
              {!lockedDocumentType && (
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
              )}
              <label className={`filePickerControl documentFilePicker ${uploading ? 'uploading' : ''}`}>
                {uploading ? <LoaderCircle size={19} /> : <Upload size={19} />}
                <span>
                  {uploading
                    ? t('מעלה קובץ...')
                    : allowsImages
                      ? t('בחירת PDF או תמונה')
                      : t('בחירת קובץ PDF')}
                </span>
                <input
                  type="file"
                  accept={allowsImages ? PDF_OR_IMAGE_ACCEPT : PDF_ACCEPT}
                  disabled={uploading}
                  onChange={handleUpload}
                  aria-label={allowsImages ? t('בחירת PDF או תמונה') : t('בחירת קובץ PDF')}
                  data-max-size={MAX_PROJECT_FILE_SIZE}
                />
              </label>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
