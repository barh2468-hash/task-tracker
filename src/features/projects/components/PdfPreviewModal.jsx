import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Download, Eye, LoaderCircle, X } from 'lucide-react';
import { t } from '../../language/LanguageContext.jsx';

export default function PdfPreviewModal({ url, fileName, isImage = false, onClose }) {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!url) return undefined;
    setLoaded(false);
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') onClose();
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [onClose, url]);

  if (!url) return null;

  return createPortal(
    <div className="pdfPreviewBackdrop">
      <section
        className="pdfPreviewDialog"
        role="dialog"
        aria-modal="true"
        aria-label={`${t('תצוגה מקדימה של הקובץ')}: ${fileName}`}
      >
        <header className="pdfPreviewHeader">
          <div>
            <span className="projectDocumentsEyebrow">{t('תצוגה מקדימה של הקובץ')}</span>
            <h3>
              <Eye size={20} />
              <span title={fileName}>{fileName}</span>
            </h3>
          </div>
          <div className="pdfPreviewActions">
            <a href={url} download={fileName} title={t('הורדת הקובץ')}>
              <Download size={17} />
              <span>{t('הורדה')}</span>
            </a>
            <button
              type="button"
              className="iconOnly"
              onClick={onClose}
              aria-label={t('סגירת תצוגה מקדימה')}
            >
              <X size={19} />
            </button>
          </div>
        </header>
        <div className="pdfPreviewFrame">
          {!loaded && (
            <div className="pdfPreviewLoading" role="status">
              <LoaderCircle size={28} />
              <span>{t('טוען את הקובץ...')}</span>
            </div>
          )}
          {isImage ? (
            <img
              className="filePreviewImage"
              src={url}
              alt={fileName}
              onLoad={() => setLoaded(true)}
              onError={() => setLoaded(true)}
            />
          ) : (
            <iframe
              src={url}
              title={`${t('תצוגה מקדימה של הקובץ')}: ${fileName}`}
              onLoad={() => setLoaded(true)}
            />
          )}
        </div>
      </section>
    </div>,
    document.body,
  );
}
