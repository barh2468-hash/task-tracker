import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BookOpen, FileText, Pencil, Trash2 } from 'lucide-react';
import { t, useLanguage } from '../language/LanguageContext.jsx';
import { localizeCaseContent } from './article.js';
import CaseStudyArticle from './CaseStudyArticle.jsx';

export default function CaseStudies({ studies = [], onDelete, onEdit, disabled = false }) {
  useTranslation();
  const { language } = useLanguage();
  const displayStudies = studies.map((study) => localizeCaseContent(study, language));
  const [selectedId, setSelectedId] = useState(null);
  const trigger = useRef(null);
  const selected = studies.find((study) => study.id === selectedId);
  if (selected) return <CaseStudyArticle key={selected.id} study={selected} onBack={() => {
    setSelectedId(null);
    requestAnimationFrame(() => trigger.current?.focus());
  }} />;

  return (
    <section className="projectSectionPanel projectDocumentsPanel demoStudies" aria-label={t('demo.caseStudies')}>
      <h3><BookOpen size={20} aria-hidden="true" />{t('demo.caseStudies')}</h3>
      {!studies.length && <p className="muted">{t('demo.noStudies')}</p>}
      <div className="projectDocumentsList">
        {displayStudies.map((study) => (
          <article className="projectDocumentItem demoStudy" key={study.id}>
            <span className="projectDocumentIcon"><FileText size={20} aria-hidden="true" /></span>
            <div className="projectDocumentInfo">
              <b title={study.title} dir="auto">{study.title}</b>
              {study.summary && <p className="demoText" dir="auto">{study.summary}</p>}
            </div>
            <div className="projectDocumentActions">
              <button type="button" className="secondary" disabled={disabled}
                ref={selectedId === study.id ? trigger : undefined}
                onClick={() => setSelectedId(study.id)} aria-label={t('demo.viewStudy', { title: study.title })}>
                <BookOpen size={16} aria-hidden="true" />{t('caseStudy.read')}
              </button>
              {onEdit && <button type="button" className="secondary" disabled={disabled}
                onClick={() => onEdit(studies.find((item) => item.id === study.id))} aria-label={t('caseStudy.editNamed', { title: study.title })}>
                <Pencil size={16} aria-hidden="true" />{t('caseStudy.edit')}
              </button>}
              {onDelete && <button type="button" className="danger ghost" disabled={disabled}
                onClick={() => onDelete(study)} aria-label={t('demo.deleteStudy', { title: study.title })}>
                <Trash2 size={16} aria-hidden="true" />{t('demo.delete')}
              </button>}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
