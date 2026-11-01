import { lazy, Suspense, useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, BookOpen, CheckCircle2, Compass, Lightbulb, Target } from 'lucide-react';
import { t, useLanguage } from '../language/LanguageContext.jsx';
import { localeForLanguage } from '../language/locale.js';
import { articleSections, localizeCaseContent } from './article.js';
import CaseStudyGallery from './CaseStudyGallery.jsx';

const InlineCaseStudyPdf = lazy(() => import('./InlineCaseStudyPdf.jsx'));
const icons = { challenge: Target, work_process: Compass, solution: Lightbulb, outcome: CheckCircle2 };

export default function CaseStudyArticle({ study: sourceStudy, onBack }) {
  useTranslation();
  const { language } = useLanguage();
  const study = localizeCaseContent(sourceStudy, language);
  const id = useId();
  const heading = useRef(null);
  const sections = articleSections(study);
  const [showSource, setShowSource] = useState(false);
  useEffect(() => { heading.current?.focus({ preventScroll: true }); }, []);

  return (
    <article className="caseArticle" aria-labelledby={`${id}-title`}>
      <button className="secondary caseArticleBack" type="button" onClick={onBack}>
        <ArrowLeft size={17} aria-hidden="true" />{t('caseStudy.back')}
      </button>
      <header className="caseArticleHero">
        <span className="caseArticleEyebrow"><BookOpen size={17} aria-hidden="true" />{t('caseStudy.label')}</span>
        <h3 id={`${id}-title`} tabIndex={-1} ref={heading} dir="auto" lang={study.content_language}>{study.title}</h3>
        {study.summary && <p className="demoText" dir="auto" lang={study.content_language}>{study.summary}</p>}
        {study.client_name && <p className="caseArticleClient" dir="auto"><b>{t('caseStudy.client')}</b> {study.client_name}</p>}
        {!!sections.length && <div className="caseArticleSteps" aria-hidden="true">
          {sections.map(({ key }, index) => <span key={key}>
            <b>{(index + 1).toLocaleString(localeForLanguage(language), { minimumIntegerDigits: 2 })}</b>{t(`caseStudy.${key}`)}
          </span>)}
        </div>}
      </header>
      {!!study.demo_case_study_media?.length && <CaseStudyGallery studyId={study.id} />}
      {!!sections.length && <div className="caseArticleLayout">
        <nav className="caseArticleNav" aria-label={t('caseStudy.contents')}>
          <strong>{t('caseStudy.contents')}</strong>
          {sections.map(({ key }) => <a key={key} href={`#${id}-${key}`}>{t(`caseStudy.${key}`)}</a>)}
        </nav>
        <div className="caseArticleSections">
          {sections.map(({ key, text }, index) => {
            const Icon = icons[key];
            return <section key={key} id={`${id}-${key}`} className={`caseArticleSection caseArticleSection--${key}`}>
              <div className="caseArticleSectionHeading">
                <span className="caseArticleSectionIcon"><Icon size={21} aria-hidden="true" /></span>
                <h4>{t(`caseStudy.${key}`)}</h4>
                <span className="caseArticleNumber" aria-hidden="true">{(index + 1).toLocaleString(localeForLanguage(language), { minimumIntegerDigits: 2 })}</span>
              </div>
              <p className="demoText" dir="auto" lang={study.content_language}>{text}</p>
            </section>;
          })}
        </div>
      </div>}
      {study.technical_details && <section className="caseArticleTechnical">
        <h4>{t('caseStudy.technical')}</h4><p className="demoText" dir="auto" lang={study.content_language}>{study.technical_details}</p>
      </section>}
      {/\.pdf$/i.test(study.file_name || '') && <details className="caseArticleSource" open={!sections.length || showSource}
        onToggle={(event) => setShowSource(event.currentTarget.open)}>
        <summary><BookOpen size={18} aria-hidden="true" />{t('caseStudy.source')}</summary>
        {(!sections.length || showSource) && <Suspense fallback={<p role="status">{t('caseStudy.loading')}</p>}>
          <InlineCaseStudyPdf studyId={study.id} />
        </Suspense>}
      </details>}
    </article>
  );
}
