import { useTranslation } from 'react-i18next';
import { t } from '../../language/LanguageContext.jsx';
import { useEffect, useState } from 'react';
import { CheckCircle2, Eye, FileText, Trash2 } from 'lucide-react';
import { createSignedUrl } from '../../../services/api/storage.js';
import PdfPreviewModal from './PdfPreviewModal.jsx';

export default function ReviewFilesPanel({ files, canDelete, onDelete, canApprove, onApprove }) {
  useTranslation();
  const [urls, setUrls] = useState({});
  const [previewFile, setPreviewFile] = useState(null);
  const [approving, setApproving] = useState(false);

  async function handleApprove() {
    if (approving) return;
    if (!window.confirm(t('להעביר את סטטוס הפרויקט ל"עבר לבקרה"?'))) return;
    setApproving(true);
    try {
      await onApprove();
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
              disabled={approving}
              onClick={handleApprove}
            >
              <CheckCircle2 size={16} />
              {approving ? t('מעדכן...') : t('אישור הגהה')}
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
    </>
  );
}
