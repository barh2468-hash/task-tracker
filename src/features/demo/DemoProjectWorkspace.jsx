import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, ArrowRight, BookOpen, Eye, FolderOpen, MapPin, Search, X } from 'lucide-react';
import { t, useLanguage } from '../language/LanguageContext.jsx';
import { localeForLanguage } from '../language/locale.js';
import ProjectSectionTabs from '../projects/components/ProjectSectionTabs.jsx';
import CaseStudies from './CaseStudies.jsx';
import { selectDemoProjects } from './workspace.js';
import { localizeCaseContent } from './article.js';

function DemoProjectDetail({ project, onBack, initialSection = 'overview' }) {
  useTranslation();
  const [tab, setTab] = useState(initialSection);
  const headingRef = useRef(null);
  const studies = project.demo_case_studies || [];
  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, []);
  return (
    <article className="project projectWorkspace demoProjectWorkspace">
      <div className="projectWorkspaceTop">
        <button type="button" className="ghost projectBackButton" onClick={onBack}>
          <ArrowRight size={17} aria-hidden="true" />
          {t('חזרה לרשימת הפרויקטים')}
        </button>
        <span className="demoReadOnlyLabel">
          <Eye size={15} aria-hidden="true" />
          {t('demo.readOnly')}
        </span>
      </div>
      <header className="projectWorkspaceHeader">
        <h2 ref={headingRef} tabIndex={-1} dir="auto">
          {project.title}
        </h2>
        {project.location && (
          <p className="projectWorkspaceLocation" dir="auto">
            {project.location}
          </p>
        )}
        <div className="projectWorkspaceMeta">
          <span className="pill demoStudyPill">{t('demo.clientApproved')}</span>
        </div>
      </header>
      <div className="projectExpandedBody">
        <ProjectSectionTabs>
          {['overview', 'studies'].map((value) => (
            <button
              type="button"
              key={value}
              role="tab"
              id={'demo-tab-' + value}
              aria-controls={'demo-panel-' + value}
              aria-selected={tab === value}
              tabIndex={tab === value ? 0 : -1}
              className={tab === value ? 'active' : ''}
              onClick={() => setTab(value)}
            >
              <span>{t(value === 'overview' ? 'סקירה כללית' : 'demo.caseStudies')}</span>
            </button>
          ))}
        </ProjectSectionTabs>
        <div
          className={'projectWorkspacePanel projectWorkspacePanel-' + tab}
          role="tabpanel"
          id={'demo-panel-' + tab}
          aria-labelledby={'demo-tab-' + tab}
        >
          {tab === 'overview' ? (
            <div className="projectOverviewGrid">
              <section className="projectOverviewWork">
                <h3>{t('תיאור העבודה')}</h3>
                <p className="projectWorkDescription demoText" dir="auto">
                  {project.summary || t('אין תיאור')}
                </p>
              </section>
              <section className="projectOverviewTeam">
                <h3>{t('demo.projectMaterial')}</h3>
                <p className="muted">{t('demo.studyHelp')}</p>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => {
                    setTab('studies');
                    window.requestAnimationFrame(() =>
                      document.getElementById('demo-tab-studies')?.focus(),
                    );
                  }}
                >
                  <BookOpen size={17} aria-hidden="true" />
                  {t('demo.caseStudies')}
                </button>
              </section>
            </div>
          ) : (
            <CaseStudies studies={studies} />
          )}
        </div>
      </div>
    </article>
  );
}

export default function DemoProjectWorkspace({
  projects: sourceProjects,
  selectedId,
  onlyCases = false,
  onOpen,
  onBack,
}) {
  useTranslation();
  const { language } = useLanguage();
  const projects = sourceProjects.map((project) => localizeCaseContent(project, language));
  const [query, setQuery] = useState('');
  const searchRef = useRef(null);
  const lastSelectedRef = useRef(null);
  const selected = projects.find((project) => project.project_id === selectedId);
  const visible = selectDemoProjects(projects, { query, onlyCases });
  useEffect(() => {
    if (selectedId) lastSelectedRef.current = selectedId;
    else if (lastSelectedRef.current)
      document.getElementById('demo-open-' + lastSelectedRef.current)?.focus();
  }, [selectedId]);
  return (
    <section className={'card projectsPage' + (selected ? ' projectsPageDetail' : '')}>
      {selected ? (
        <DemoProjectDetail key={selected.project_id} project={selected} onBack={onBack} initialSection={onlyCases ? 'studies' : 'overview'} />
      ) : (
        <>
          {selectedId && <p role="alert">{t('demo.projectUnavailable')}</p>}
          <header className="projectListHeader">
            <div className="projectListHeading">
              <h2>{t(onlyCases ? 'demo.caseStudies' : 'כל הפרויקטים')}</h2>
              <span className="projectListCount" role="status">
                {t('demo.projectCount', {
                  count: visible.length.toLocaleString(localeForLanguage(language)),
                })}
              </span>
            </div>
            <div className="projectListFilters">
              <div className={'projectListSearch' + (query ? ' hasQuery' : '')}>
                <label htmlFor="demo-project-search" className="visuallyHidden">
                  {t('demo.search')}
                </label>
                <Search size={18} aria-hidden="true" />
                <input
                  ref={searchRef}
                  id="demo-project-search"
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={t('demo.searchPlaceholder')}
                />
                {query && (
                  <button
                    type="button"
                    className="projectSearchClear"
                    aria-label={t('demo.clearSearch')}
                    onClick={() => {
                      setQuery('');
                      searchRef.current?.focus();
                    }}
                  >
                    <X size={15} aria-hidden="true" />
                  </button>
                )}
              </div>
            </div>
          </header>
          <div className="projects">
            {!visible.length && (
              <div className="empty demoWorkspaceEmpty">
                <FolderOpen size={28} aria-hidden="true" />
                <p>{t(query ? 'demo.noResults' : onlyCases ? 'demo.noStudies' : 'demo.empty')}</p>
              </div>
            )}
            {visible.map((project) => (
              <div className="projectListRow" key={project.project_id}>
                <button
                  type="button"
                  className="projectListItem demoProjectListItem"
                  id={'demo-open-' + project.project_id}
                  aria-label={t('demo.openProject', { title: project.title })}
                  onClick={() => onOpen(project.project_id)}
                >
                  <span className="projectListItemName">
                    <b dir="auto">{project.title}</b>
                    {project.location && (
                      <span className="projectListLocation">
                        <MapPin size={14} aria-hidden="true" />
                        <bdi>{project.location}</bdi>
                      </span>
                    )}
                  </span>
                  <span className="projectListItemOwner">
                    <Eye size={15} aria-hidden="true" />
                    <span>{t('demo.viewOnly')}</span>
                  </span>
                  <span className="pill demoStudyPill">
                    <BookOpen size={13} aria-hidden="true" />
                    {t('demo.studyCount', {
                      count: (project.demo_case_studies?.length || 0).toLocaleString(
                        localeForLanguage(language),
                      ),
                    })}
                  </span>
                  <span className="projectListOpenIcon" aria-hidden="true">
                    <ArrowLeft size={18} />
                  </span>
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
