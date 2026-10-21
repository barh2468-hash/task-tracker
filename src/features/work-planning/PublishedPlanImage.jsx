import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Download, Maximize2, Share2, ZoomIn, ZoomOut } from 'lucide-react';
import { t, useLanguage } from '../language/LanguageContext.jsx';
import { localeForLanguage } from '../language/locale.js';
import { planColumns } from './localPlans.js';
import { planImageInputKey, renderPlanImage } from './planImage.js';

export default function PublishedPlanImage({ rows, workers, date, title }) {
  useTranslation();
  const { language } = useLanguage();
  const [image, setImage] = useState({ loading: true });
  const [attempt, setAttempt] = useState(0);
  const [zoom, setZoom] = useState('width');
  const [shareError, setShareError] = useState(false);
  const renderKey = planImageInputKey({
    rows: rows.map((row) => ({ ...row, start: row.start === '__after__' ? t('workPlan.after') : row.start })),
    workers, title, rtl: language === 'he',
    labels: Object.fromEntries(planColumns.map((column) => [column, t(`workPlan.${column}`)])),
    footer: t('workPlan.count', { count: new Intl.NumberFormat(localeForLanguage(language)).format(rows.length) }),
  });
  useEffect(() => {
    let active = true;
    // Keep the current image and its height while a real content change is rendered.
    setImage((previous) => ({ ...previous, loading: true, error: false }));
    renderPlanImage(JSON.parse(renderKey)).then((result) => {
      if (!active) return;
      const url = URL.createObjectURL(result.blob);
      setImage({ ...result, url, loading: false });
    }).catch(() => { if (active) setImage((previous) => ({ ...previous, loading: false, error: true })); });
    return () => { active = false; };
  }, [renderKey, attempt]);
  useEffect(() => {
    const url = image.url;
    return () => { if (url) URL.revokeObjectURL(url); };
  }, [image.url]);

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

  const ready = Boolean(image.url) && !image.loading && !image.error;
  return <div className="workPlanImageView">
    <div className="workPlanImageControls" role="group" aria-label={t('workPlan.imageControls')}>
      <button type="button" className="ghost" disabled={!ready || zoom >= 200} aria-label={t('workPlan.imageZoomIn')} onClick={() => setZoom((value) => typeof value === 'number' ? Math.min(200, value + 25) : 100)}><ZoomIn size={17} aria-hidden="true" /></button>
      <button type="button" className="ghost" disabled={!ready || typeof zoom !== 'number' || zoom <= 25} aria-label={t('workPlan.imageZoomOut')} onClick={() => setZoom((value) => Math.max(25, value - 25))}><ZoomOut size={17} aria-hidden="true" /></button>
      <button type="button" className="ghost" disabled={!ready} aria-pressed={zoom === 'width'} onClick={() => setZoom('width')}><Maximize2 size={16} aria-hidden="true" />{t('workPlan.imageFitWidth')}</button>
      <button type="button" className="ghost" disabled={!ready} aria-pressed={zoom === null} onClick={() => setZoom(null)}><Maximize2 size={16} aria-hidden="true" />{t('workPlan.imageFit')}</button>
      <span role="status">{typeof zoom === 'number' ? new Intl.NumberFormat(localeForLanguage(language), { style: 'percent' }).format(zoom / 100) : ''}</span>
      <button type="button" className="secondary" disabled={!ready} onClick={download}><Download size={16} aria-hidden="true" />{t('workPlan.imageDownload')}</button>
      {typeof navigator.share === 'function' && <button type="button" className="secondary" disabled={!ready} onClick={share}><Share2 size={16} aria-hidden="true" />{t('workPlan.imageShare')}</button>}
    </div>
    {image.loading && <p role="status" className={image.url ? 'visuallyHidden' : undefined}>{t('workPlan.imageLoading')}</p>}
    {image.error && <div className="workPlanError" role="alert"><p>{t('workPlan.imageError')}</p><button type="button" onClick={() => setAttempt((value) => value + 1)}>{t('workPlan.imageRetry')}</button></div>}
    {shareError && <p className="workPlanError" role="alert">{t('workPlan.imageShareError')}</p>}
    {/* Keyboard focus lets readers scroll an enlarged image. */}
    {/* eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex */}
    {image.url && <div className={`workPlanImageViewport${zoom === 'width' ? ' widthFit' : ''}`} role="region" aria-label={t('workPlan.imageRegion')} aria-busy={image.loading} tabIndex={0}>
      <img src={image.url} width={image.width} height={image.height} alt={t('workPlan.imageAlt', { title })} draggable={false} className={zoom === 'width' ? 'widthFit' : zoom === null ? 'fit' : 'zoomed'}
        style={typeof zoom !== 'number' ? undefined : { width: image.width * zoom / 100, height: image.height * zoom / 100 }} />
    </div>}
  </div>;
}
