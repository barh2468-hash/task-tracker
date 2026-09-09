import { useTranslation } from 'react-i18next';
import { t } from '../features/language/LanguageContext.jsx';
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, ShieldAlert } from 'lucide-react';
import { useAuth } from '../features/auth/useAuth.js';
import { useProjects } from '../features/projects/ProjectsContext.jsx';
import { useMessage } from '../context/MessageContext.jsx';
import { appStatuses } from '../services/supabase.js';
import ProjectCard from '../features/projects/components/ProjectCard.jsx';

export default function ProjectsPage() {
  useTranslation();
  const { isManager, session } = useAuth();
  const { projects, projectsLoaded } = useProjects();
  const { setMessage } = useMessage();
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState('');
  const [visibleLimit, setVisibleLimit] = useState(20);
  const [focusedProjectId, setFocusedProjectId] = useState(null);
  const [deepLinkDenied, setDeepLinkDenied] = useState(false);
  const loadMoreRef = useRef(null);

  const filter = searchParams.get('filter') || (isManager ? 'all' : 'mine');
  const statusFilter = searchParams.get('status') || '';

  // A project reference can arrive from chat, notifications, reports or a push link.
  // Resolve it only after the permitted project list has finished loading.
  useEffect(() => {
    if (!projectsLoaded) return;
    const projectId = searchParams.get('project');
    if (!projectId) return;
    const linkedProject = projects.find((p) => p.id === projectId);

    const next = new URLSearchParams(searchParams);
    next.delete('project');
    if (!linkedProject) {
      setFocusedProjectId(null);
      setDeepLinkDenied(true);
      setMessage(t('אין לך הרשאה לצפות בפרויקט זה.'));
      setSearchParams(next, { replace: true });
      return;
    }

    setDeepLinkDenied(false);
    setFocusedProjectId(projectId);
    next.set('filter', linkedProject.is_archived ? 'archive' : isManager ? 'all' : 'mine');
    next.delete('status');
    setSearchParams(next, { replace: true });
    const linkedIndex = projects.findIndex((p) => p.id === projectId);
    if (linkedIndex >= 0) setVisibleLimit((limit) => Math.max(limit, linkedIndex + 1));
  }, [isManager, projects, projectsLoaded, searchParams, setMessage, setSearchParams]);

  function setStatusFilter(nextStatus) {
    const next = new URLSearchParams(searchParams);
    if (nextStatus) next.set('status', nextStatus);
    else next.delete('status');
    setSearchParams(next);
  }

  const visibleProjects = projects.filter((p) => {
    const text =
      `${p.name} ${p.location} ${p.contact_phone || ''} ${p.contact_email || ''} ${p.client_name || ''} ${p.description || ''}`.toLowerCase();
    const okQuery = !query || text.includes(query.toLowerCase());
    const okStatus = !statusFilter || p.status === statusFilter;
    const okArchive = filter === 'archive' ? !!p.is_archived : !p.is_archived;
    const okTab =
      filter === 'unassigned'
        ? !p.assigned_to
        : filter !== 'mine' || !isManager || p.assigned_to === session?.user?.id;
    return okQuery && okStatus && okArchive && okTab;
  });
  const pagedProjects = visibleProjects.slice(0, visibleLimit);
  const hasMoreProjects = visibleLimit < visibleProjects.length;

  useEffect(() => {
    if (!focusedProjectId) return;
    const projectElement = document.getElementById(`project-${focusedProjectId}`);
    if (!projectElement) return;
    window.requestAnimationFrame(() => {
      projectElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }, [focusedProjectId, pagedProjects.length]);

  useEffect(() => {
    if (!focusedProjectId) return undefined;
    const timeout = window.setTimeout(() => setFocusedProjectId(null), 4000);
    return () => window.clearTimeout(timeout);
  }, [focusedProjectId]);

  useEffect(() => {
    if (!focusedProjectId) setVisibleLimit(20);
  }, [focusedProjectId, query, filter, statusFilter]);

  useEffect(() => {
    const sentinel = loadMoreRef.current;
    if (!sentinel || !hasMoreProjects) return undefined;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisibleLimit((limit) => Math.min(limit + 20, visibleProjects.length));
        }
      },
      { rootMargin: '300px 0px' },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMoreProjects, visibleProjects.length]);

  const heading =
    filter === 'unassigned'
      ? t('פרויקטים ללא שיוך')
      : filter === 'archive'
        ? t('ארכיון פרויקטים')
        : filter === 'mine' && !isManager
          ? t('הפרויקטים שלי')
          : t('כל הפרויקטים');

  return (
    <section className="card">
      <div className="toolbar">
        <div style={{ minWidth: 260, flex: 1 }}>
          <label htmlFor="project-search" className="visuallyHidden">
            {t('חיפוש פרויקטים')}
          </label>
          <input
            id="project-search"
            placeholder={t('חיפוש לפי שם, לקוח או מיקום...')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <label htmlFor="project-status-filter" className="visuallyHidden">
          {t('סינון לפי סטטוס')}
        </label>
        <select
          id="project-status-filter"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{ maxWidth: 220 }}
        >
          <option value="">{t('כל הסטטוסים')}</option>
          {appStatuses.map((s) => (
            <option key={s} value={s}>
              {t(s)}
            </option>
          ))}
        </select>
        <button className="ghost">
          <Search size={16} />
          {t('סינון')}
        </button>
      </div>
      {deepLinkDenied && (
        <div className="projectDeepLinkNotice" role="alert">
          <ShieldAlert size={22} />
          <div>
            <b>{t('אין לך הרשאה לצפות בפרויקט זה')}</b>
            <span>{t('הפרויקט אינו משויך אליך ולכן פרטיו אינם זמינים עבורך.')}</span>
          </div>
          <button
            type="button"
            onClick={() => setDeepLinkDenied(false)}
            aria-label={t('סגירה')}
          >
            ×
          </button>
        </div>
      )}
      <h2>{heading}</h2>
      <div className="projects">
        {visibleProjects.length === 0 && (
          <div className="empty">{t('אין פרויקטים להצגה כרגע')}</div>
        )}
        {pagedProjects.map((project) => (
          <div
            key={project.id}
            id={`project-${project.id}`}
            className={project.id === focusedProjectId ? 'projectDeepLinkTarget' : ''}
          >
            <ProjectCard
              project={project}
              focused={project.id === focusedProjectId}
            />
          </div>
        ))}
        {hasMoreProjects && (
          <div ref={loadMoreRef} className="projectLoadSentinel" aria-hidden="true" />
        )}
      </div>
    </section>
  );
}
