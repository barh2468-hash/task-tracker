import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Images, Maximize2, X } from 'lucide-react';
import { t, useLanguage } from '../language/LanguageContext.jsx';
import { loadCaseStudyMedia } from './api.js';

export default function CaseStudyGallery({ studyId }) {
  useTranslation();
  const { language } = useLanguage();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [selected, setSelected] = useState(null);
  const dialog = useRef(null);
  const caption = (item) => language === 'he' ? item.caption : item.caption_en;
  useEffect(() => {
    let active = true;
    setLoading(true); setError(false); setItems([]);
    loadCaseStudyMedia(studyId).then((rows) => {
      if (active) setItems(rows);
    }).catch(() => { if (active) setError(true); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [studyId, retry]);
  useEffect(() => {
    if (selected) dialog.current?.showModal();
    else dialog.current?.close();
  }, [selected]);
  return <section className="caseGallery" aria-label={t('caseStudy.gallery')}>
    <h4><Images size={19} aria-hidden="true" />{t('caseStudy.gallery')}</h4>
    {loading && <p role="status">{t('caseStudy.imagesLoading')}</p>}
    {error && <div role="alert"><p>{t('caseStudy.imagesError')}</p><button type="button" className="secondary" onClick={() => { setSelected(null); setRetry((value) => value + 1); }}>{t('caseStudy.retry')}</button></div>}
    <div className="caseGalleryGrid">{items.map((item) => <figure key={item.id}>
      <button type="button" disabled={!item.url} onClick={() => setSelected(item)} aria-label={t('caseStudy.enlarge', { caption: caption(item) })}>
        <img src={item.url} alt={caption(item)} onError={() => setError(true)} />
        <span><Maximize2 size={17} aria-hidden="true" /></span>
      </button>
      <figcaption dir="auto" lang={language === 'he' ? 'he' : 'en'}>{caption(item)}</figcaption>
    </figure>)}</div>
    <dialog className="caseImageDialog" ref={dialog} aria-label={t('caseStudy.imagePreview')} onCancel={() => setSelected(null)} onClose={() => setSelected(null)}>
      <button type="button" className="secondary" onClick={() => setSelected(null)} aria-label={t('caseStudy.closeImage')}><X size={20} aria-hidden="true" />{t('caseStudy.closeImage')}</button>
      {selected && <figure><img src={selected.url} alt={caption(selected)} /><figcaption dir="auto">{caption(selected)}</figcaption></figure>}
    </dialog>
  </section>;
}
