import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { t, useLanguage } from '../language/LanguageContext.jsx';
import { localeForLanguage } from '../language/locale.js';
import { openCaseStudy } from './api.js';

function PdfPage({ document, number }) {
  useTranslation();
  const { language } = useLanguage();
  const container = useRef(null);
  const canvas = useRef(null);
  const [width, setWidth] = useState(0);
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState(false);
  const [ready, setReady] = useState(false);
  // Keep page height while resizing: hiding a canvas must not toggle the scrollbar
  // and continuously change the width observed by ResizeObserver.
  const [aspectRatio, setAspectRatio] = useState(1 / Math.sqrt(2));
  const [text, setText] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const resize = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)));
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setVisible(true); observer.disconnect(); }
    }, { rootMargin: '600px' });
    resize.observe(container.current);
    observer.observe(container.current);
    return () => { resize.disconnect(); observer.disconnect(); };
  }, []);

  useEffect(() => {
    if (!visible || width < 1) return;
    let active = true;
    let render;
    setReady(false);
    setError(false);
    (async () => {
      const page = await document.getPage(number);
      if (!active) return;
      const base = page.getViewport({ scale: 1 });
      setAspectRatio(base.width / base.height);
      const ratio = Math.min(window.devicePixelRatio || 1, 2, Math.sqrt(4000000 / (width * width * base.height / base.width)));
      const viewport = page.getViewport({ scale: width / base.width * ratio });
      canvas.current.width = Math.floor(viewport.width);
      canvas.current.height = Math.floor(viewport.height);
      render = page.render({ canvasContext: canvas.current.getContext('2d'), viewport });
      await render.promise;
      if (!active) return;
      setReady(true);
      try {
        const content = await page.getTextContent();
        if (active) setText(content.items.map((item) => item.str || '').join(' '));
      } catch {
        // A missing text layer must not hide an otherwise readable scanned page.
      }
    })().catch((failure) => {
      if (active && failure.name !== 'RenderingCancelledException') setError(true);
    });
    return () => { active = false; render?.cancel(); };
  }, [document, number, width, visible, retry]);

  const locale = localeForLanguage(language);
  const label = t('caseStudy.page', { page: number.toLocaleString(locale), total: document.numPages.toLocaleString(locale) });
  return <section className="casePdfPage" ref={container} aria-label={label} aria-busy={!ready && !error}>
    <small>{label}</small>
    {error && <div role="alert"><p>{t('caseStudy.pdfError')}</p><button type="button" className="secondary" onClick={() => setRetry((value) => value + 1)}>{t('caseStudy.retry')}</button></div>}
    <div className="casePdfCanvas" style={{ aspectRatio }}>
        {!ready && !error && <p role="status">{t('caseStudy.loading')}</p>}
        <canvas ref={canvas} aria-label={label} role="img" hidden={!ready} />
    </div>
    {text && <p className="casePdfAccessibleText" dir="auto">{text}</p>}
  </section>;
}

export default function InlineCaseStudyPdf({ studyId, resolveUrl = openCaseStudy }) {
  useTranslation();
  const [document, setDocument] = useState(null);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    let task;
    const controller = new AbortController();
    setDocument(null);
    setError(false);
    (async () => {
      // Resolve permission on each opening/retry; fetch once before the short URL expires.
      const url = await resolveUrl(studyId);
      if (!active) return;
      const response = await fetch(url, { signal: controller.signal, cache: 'no-store' });
      if (!response.ok) throw new Error('PDF unavailable');
      const data = new Uint8Array(await response.arrayBuffer());
      if (!active) return;
      const pdfjs = await import('pdfjs-dist');
      const worker = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
      if (!active) return;
      pdfjs.GlobalWorkerOptions.workerSrc = worker;
      task = pdfjs.getDocument({ data, isEvalSupported: false });
      const pdf = await task.promise;
      if (active) setDocument(pdf);
    })().catch(() => { if (active) setError(true); });
    return () => { active = false; controller.abort(); task?.destroy().catch(() => {}); };
  }, [studyId, resolveUrl, retry]);
  if (error) return <div role="alert"><p>{t('caseStudy.pdfError')}</p><button type="button" className="secondary" onClick={() => setRetry((value) => value + 1)}>{t('caseStudy.retry')}</button></div>;
  if (!document) return <p role="status">{t('caseStudy.loading')}</p>;
  return <div className="casePdfViewer">{Array.from({ length: document.numPages }, (_, index) =>
    <PdfPage key={`${studyId}-${retry}-${index}`} document={document} number={index + 1} />)}</div>;
}
