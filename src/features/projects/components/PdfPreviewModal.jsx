import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Download, Eye, LoaderCircle, Minus, Plus, RotateCcw, X } from 'lucide-react';
import { t } from '../../language/LanguageContext.jsx';

const MIN_ZOOM = 0.75;
const MAX_ZOOM = 2.5;
const ZOOM_STEP = 0.25;

export default function PdfPreviewModal({ url, fileName, onClose }) {
  const [loaded, setLoaded] = useState(false);
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    if (!url) return undefined;
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
        aria-label={`${t('תצוגה מקדימה של PDF')}: ${fileName}`}
      >
        <header className="pdfPreviewHeader">
          <div>
            <span className="projectDocumentsEyebrow">{t('תצוגה מקדימה של PDF')}</span>
            <h3>
              <Eye size={20} />
              <span title={fileName}>{fileName}</span>
            </h3>
          </div>
          <div className="pdfPreviewActions">
            <a href={url} download={fileName} title={t('הורדת PDF')}>
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
              <span>{t('טוען את מסמך ה־PDF...')}</span>
            </div>
          )}
          <div className="pdfPreviewViewport">
            <div
              className="pdfPreviewZoomSurface"
              style={{ width: `${zoom * 100}%`, height: `${zoom * 100}%` }}
            >
              <iframe
                src={url}
                title={`${t('תצוגה מקדימה של PDF')}: ${fileName}`}
                onLoad={() => setLoaded(true)}
              />
            </div>
          </div>
          <div className="pdfPreviewZoomControls" aria-label={t('בקרי זום')}>
            <button
              type="button"
              onClick={() => setZoom((value) => Math.max(MIN_ZOOM, value - ZOOM_STEP))}
              disabled={zoom <= MIN_ZOOM}
              aria-label={t('הקטנת תצוגה')}
              title={t('הקטנת תצוגה')}
            >
              <Minus size={19} />
            </button>
            <output aria-live="polite">{Math.round(zoom * 100)}%</output>
            <button
              type="button"
              onClick={() => setZoom((value) => Math.min(MAX_ZOOM, value + ZOOM_STEP))}
              disabled={zoom >= MAX_ZOOM}
              aria-label={t('הגדלת תצוגה')}
              title={t('הגדלת תצוגה')}
            >
              <Plus size={19} />
            </button>
            <button
              type="button"
              onClick={() => setZoom(1)}
              disabled={zoom === 1}
              aria-label={t('איפוס זום')}
              title={t('איפוס זום')}
            >
              <RotateCcw size={17} />
            </button>
          </div>
        </div>
      </section>
    </div>,
    document.body,
  );
}
