import { useTranslation } from 'react-i18next';
import { t } from '../../language/LanguageContext.jsx';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, Eye, FileText, Trash2, X } from 'lucide-react';
import { createSignedUrl } from '../../../services/api/storage.js';
import PdfPreviewModal from './PdfPreviewModal.jsx';

export default function ReviewFilesPanel({ files, canDelete, onDelete, canApprove, onApprove }) {
  useTranslation();
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
              className="statusNoteModal reviewApproveDialog"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="statusNoteHeader">
                <div>
                  <h3 id="review-approve-title">{t('אישור הגהה')}</h3>
                  <p className="muted">{t('להעביר את סטטוס הפרויקט ל"עבר לבקרה"?')}</p>
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
                  className="reviewApproveButton"
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
