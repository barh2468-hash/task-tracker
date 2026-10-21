import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Download, Maximize2, Share2, ZoomIn, ZoomOut } from 'lucide-react';
import { t, useLanguage } from '../language/LanguageContext.jsx';
import { localeForLanguage } from '../language/locale.js';
import { planColumns } from './localPlans.js';
import { renderPlanImage } from './planImage.js';

export default function PublishedPlanImage({ rows, workers, date, title }) {
  useTranslation();
  const { language } = useLanguage();
  const [image, setImage] = useState({ loading: true });
  const [attempt, setAttempt] = useState(0);
  const [zoom, setZoom] = useState(null);
  const [shareError, setShareError] = useState(false);
  useEffect(() => {
    let active = true;
    let url;
    setImage({ loading: true });
    const formattedRows = rows.map((row) => ({ ...row, start: row.start === '__after__' ? t('workPlan.after') : row.start }));
    renderPlanImage({ rows: formattedRows, workers, title, rtl: language === 'he',
      labels: Object.fromEntries(planColumns.map((column) => [column, t(`workPlan.${column}`)])),
      footer: t('workPlan.count', { count: new Intl.NumberFormat(localeForLanguage(language)).format(rows.length) }),
    }).then((result) => {
      if (!active) return;
      url = URL.createObjectURL(result.blob);
      setImage({ ...result, url, loading: false });
    }).catch(() => { if (active) setImage({ loading: false, error: true }); });
    return () => { active = false; if (url) URL.revokeObjectURL(url); };
  }, [rows, workers, title, language, attempt]);

  function download() {
    const anchor = document.createElement('a');
    anchor.href = image.url;
    anchor.download = t('workPlan.imageFilename', { date });
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
  }

  async function share() {
    setShareError(false);
    const file = new File([image.blob], t('workPlan.imageFilename', { date }), { type: 'image/png' });
    if (!navigator.canShare?.({ files: [file] })) { download(); return; }
    try { await navigator.share({ files: [file], title }); }
    catch (error) { if (error.name !== 'AbortError') setShareError(true); }
  }

  const ready = Boolean(image.url);
  return <div className="workPlanImageView">
    <div className="workPlanImageControls" role="group" aria-label={t('workPlan.imageControls')}>
      <button type="button" className="ghost" disabled={!ready || zoom >= 200} aria-label={t('workPlan.imageZoomIn')} onClick={() => setZoom((value) => value === null ? 100 : Math.min(200, value + 25))}><ZoomIn size={17} aria-hidden="true" /></button>
      <button type="button" className="ghost" disabled={!ready || zoom === null || zoom <= 25} aria-label={t('workPlan.imageZoomOut')} onClick={() => setZoom((value) => Math.max(25, value - 25))}><ZoomOut size={17} aria-hidden="true" /></button>
      <button type="button" className="ghost" disabled={!ready} aria-pressed={zoom === null} onClick={() => setZoom(null)}><Maximize2 size={16} aria-hidden="true" />{t('workPlan.imageFit')}</button>
      <span role="status">{zoom === null ? '' : new Intl.NumberFormat(localeForLanguage(language), { style: 'percent' }).format(zoom / 100)}</span>
      <button type="button" className="secondary" disabled={!ready} onClick={download}><Download size={16} aria-hidden="true" />{t('workPlan.imageDownload')}</button>
      {typeof navigator.share === 'function' && <button type="button" className="secondary" disabled={!ready} onClick={share}><Share2 size={16} aria-hidden="true" />{t('workPlan.imageShare')}</button>}
    </div>
    {image.loading && <p role="status">{t('workPlan.imageLoading')}</p>}
    {image.error && <div className="workPlanError" role="alert"><p>{t('workPlan.imageError')}</p><button type="button" onClick={() => setAttempt((value) => value + 1)}>{t('workPlan.imageRetry')}</button></div>}
    {shareError && <p className="workPlanError" role="alert">{t('workPlan.imageShareError')}</p>}
    {/* Keyboard focus lets readers scroll an enlarged image. */}
    {/* eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex */}
    {ready && <div className="workPlanImageViewport" role="region" aria-label={t('workPlan.imageRegion')} tabIndex={0}>
      <img src={image.url} alt={t('workPlan.imageAlt', { title })} draggable={false} className={zoom === null ? 'fit' : 'zoomed'}
        style={zoom === null ? undefined : { width: image.width * zoom / 100, height: image.height * zoom / 100 }} />
    </div>}
  </div>;
}
