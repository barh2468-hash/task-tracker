import { useTranslation } from 'react-i18next';
import { t, useLanguage } from '../../language/LanguageContext.jsx';
import { localeForLanguage } from '../../language/locale.js';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, Eye, FileText, Trash2, Upload, X } from 'lucide-react';
import { createSignedUrl } from '../../../services/api/storage.js';
import PdfPreviewModal from './PdfPreviewModal.jsx';
import { getReviewFileVersions } from '../utils/reviewFiles.js';

export default function ReviewFilesPanel({
  files,
  canDelete,
  onDelete,
  canApprove,
  onApprove,
  uploadInputId,
  approvalDescription = 'להעביר את סטטוס הפרויקט ל"עבר לבקרה"?',
}) {
  useTranslation();
  const { language } = useLanguage();
  const [urls, setUrls] = useState({});
  const [previewFile, setPreviewFile] = useState(null);
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [approving, setApproving] = useState(false);

  async function confirmApprove() {
    if (approving) return;
    setApproving(true);
    try {
      await onApprove();
      setApproveDialogOpen(false);
    } finally {
      setApproving(false);
    }
  }

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
    <>
      <section className="projectSectionPanel reviewFilesBox">
        <header className="projectSectionHeader projectDocumentsHeader">
          <div>
            <span className="projectDocumentsEyebrow">{t('מסמכים מהשרטט')}</span>
            <h3>
              <FileText size={19} /> {t('קבצי הגהה')}
            </h3>
          </div>
          <div className="projectDocumentsHeaderActions">
            <span className="projectDocumentsCount">{files.length}</span>
            {uploadInputId && (
              <button
                type="button"
                className="projectDocumentUpload"
                onClick={() => {
                  const input = document.getElementById(uploadInputId);
                  if (!input || input.disabled) return;
                  input.closest('section')?.scrollIntoView({ block: 'nearest' });
                  input.click();
                }}
              >
                <Upload size={16} aria-hidden="true" />
                {t('הוספת קובצי PDF')}
              </button>
            )}
            {canApprove && (
              <button
                type="button"
                className="projectDocumentUpload reviewApproveButton"
                onClick={() => setApproveDialogOpen(true)}
              >
                <CheckCircle2 size={16} />
                {t('אישור הגהה')}
              </button>
            )}
          </div>
        </header>
        <p className="muted reviewFilesVersionHint">
          {t('הקבצים מההעלאה האחרונה הם העדכניים. קבצים מהעלאות קודמות נשמרים לצפייה.')}
        </p>
        <div className="projectDocumentsList">
          {getReviewFileVersions(files).map(({ file, isSuperseded }) => (
            <article
              className={`projectDocumentItem${isSuperseded ? ' reviewFileSuperseded' : ''}`}
              key={file.id}
            >
              <span className="projectDocumentIcon reviewFileIcon">
                <FileText size={20} />
              </span>
              <div className="projectDocumentInfo">
                <span className="reviewFileVersionLabel">
                  {isSuperseded ? t('העלאה קודמת') : t('העלאה עדכנית')}
                </span>
                <b title={file.file_name || t('קובץ PDF')}>
                  {isSuperseded ? (
                    <s>{file.file_name || t('קובץ PDF')}</s>
                  ) : (
                    file.file_name || t('קובץ PDF')
                  )}
                </b>
                <small>
                  {t('הועלה על ידי {{name}}', { name: file.profiles?.full_name || t('שרטט') })} ·{' '}
                  {new Date(file.created_at).toLocaleString(localeForLanguage(language))}
                </small>
              </div>
              <div className="projectDocumentActions">
                {urls[file.id] && (
                  <button
                    type="button"
                    onClick={() =>
                      setPreviewFile({
                        url: urls[file.id],
                        fileName: file.file_name || t('קובץ PDF'),
                      })
                    }
                    title={t('תצוגה מקדימה של PDF')}
                  >
                    <Eye size={15} />
                    <span>{t('צפייה')}</span>
                  </button>
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
      <PdfPreviewModal
        url={previewFile?.url}
        fileName={previewFile?.fileName || t('קובץ PDF')}
        onClose={() => setPreviewFile(null)}
      />
      {approveDialogOpen &&
        createPortal(
          // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions -- backdrop click-to-close is a pointer convenience; the dialog has a keyboard-accessible close button
          <div
            className="modalBackdrop"
            role="dialog"
            aria-modal="true"
            aria-labelledby="review-approve-title"
            onClick={() => !approving && setApproveDialogOpen(false)}
          >
            {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- prevent backdrop dismissal for clicks inside the dialog */}
            <div
              className="statusNoteModal reviewApproveDialog projectDialogControls"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="statusNoteHeader">
                <div>
                  <h3 id="review-approve-title">{t('אישור הגהה')}</h3>
                  <p className="muted">{t(approvalDescription)}</p>
                </div>
                <button
                  type="button"
                  className="ghost iconBtn"
                  disabled={approving}
                  onClick={() => setApproveDialogOpen(false)}
                  aria-label={t('סגור')}
                >
                  <X size={18} />
                </button>
              </div>
              <div className="reviewApproveDialogActions">
                <button
                  type="button"
                  className="ghost"
                  disabled={approving}
                  onClick={() => setApproveDialogOpen(false)}
                >
                  {t('ביטול')}
                </button>
                <button
                  type="button"
                  className="reviewApproveButton projectPrimaryAction"
                  disabled={approving}
                  onClick={confirmApprove}
                >
                  <CheckCircle2 size={16} />
                  {approving ? t('מעדכן...') : t('אישור')}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
