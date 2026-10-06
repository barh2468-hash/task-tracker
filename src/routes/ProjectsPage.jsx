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
import { getProjectPage } from '../features/projects/utils/projectPage.js';

const PROJECT_BATCH_SIZE = 20;
const LOAD_MORE_DELAY_MS = 650;

export default function ProjectsPage() {
  useTranslation();
  const { isManager, session } = useAuth();
  const { projects, projectsLoaded } = useProjects();
  const { setMessage } = useMessage();
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState('');
  const [visibleLimit, setVisibleLimit] = useState(PROJECT_BATCH_SIZE);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [focusedProjectId, setFocusedProjectId] = useState(null);
  const [linkedProjectTarget, setLinkedProjectTarget] = useState(null);
  const [deepLinkDenied, setDeepLinkDenied] = useState(false);
  const loadMoreRef = useRef(null);
  const loadMoreTimerRef = useRef(null);

  const filter = searchParams.get('filter') || (isManager ? 'all' : 'mine');
  const statusFilter = searchParams.get('status') || '';
  const listViewKey = `${query}\u0000${filter}\u0000${statusFilter}`;
  const previousListViewKeyRef = useRef(listViewKey);

  function setStatusFilter(nextStatus) {
    const next = new URLSearchParams(searchParams);
    if (nextStatus) next.set('status', nextStatus);
    else next.delete('status');
    setSearchParams(next);
  }

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
      setLinkedProjectTarget(null);
      setDeepLinkDenied(true);
      setMessage(t('אין לך הרשאה לצפות בפרויקט זה.'), 'error');
      setSearchParams(next, { replace: true });
      return;
    }

    setDeepLinkDenied(false);
    const linkedFilter = linkedProject.is_archived ? 'archive' : isManager ? 'all' : 'mine';
    setLinkedProjectTarget({ id: projectId, filter: linkedFilter });
    setFocusedProjectId(projectId);
    setQuery('');
    // Cancel a pending load-more batch before replacing the list's target.
    window.clearTimeout(loadMoreTimerRef.current);
    loadMoreTimerRef.current = null;
    setIsLoadingMore(false);
    setVisibleLimit(PROJECT_BATCH_SIZE);
    next.set('filter', linkedFilter);
    next.delete('status');
    setSearchParams(next, { replace: true });
  }, [isManager, projects, projectsLoaded, searchParams, setMessage, setSearchParams]);

  const categoryProjects = projects.filter((p) => {
    const okArchive = filter === 'archive' ? !!p.is_archived : !p.is_archived;
    const okTab =
      filter === 'unassigned'
        ? !p.assigned_to
        : filter !== 'mine' || !isManager || p.assigned_to === session?.user?.id;
    return okArchive && okTab;
  });
  const visibleProjects = categoryProjects.filter((p) => {
    const text =
      `${p.name} ${p.location} ${p.contact_phone || ''} ${p.contact_email || ''} ${p.client_name || ''} ${p.description || ''} ${p.additional_notes || ''}`.toLowerCase();
    const okQuery = !query || text.includes(query.toLowerCase());
    const okStatus = !statusFilter || p.status === statusFilter;
    return okQuery && okStatus;
  });
  // Keep the target in place after its temporary focus highlight expires.
  // Search and other list filters still take precedence over this ordering.
  const linkedProjectId = !query && !statusFilter && filter === linkedProjectTarget?.filter
    ? linkedProjectTarget.id
    : null;
  const pagedProjects = getProjectPage(visibleProjects, visibleLimit, linkedProjectId);
  const hasMoreProjects = visibleLimit < visibleProjects.length;

  useEffect(() => {
    if (!focusedProjectId) return;
    const projectElement = document.getElementById(`project-${focusedProjectId}`);
    if (!projectElement) return;
    const frame = window.requestAnimationFrame(() => {
      projectElement.scrollIntoView({ behavior: 'auto', block: 'start' });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [focusedProjectId]);

  useEffect(() => {
    if (!focusedProjectId) return undefined;
    const timeout = window.setTimeout(() => setFocusedProjectId(null), 4000);
    return () => window.clearTimeout(timeout);
  }, [focusedProjectId]);

  useEffect(() => {
    if (previousListViewKeyRef.current === listViewKey) return;
    previousListViewKeyRef.current = listViewKey;
    if (loadMoreTimerRef.current !== null) {
      window.clearTimeout(loadMoreTimerRef.current);
      loadMoreTimerRef.current = null;
    }
    setIsLoadingMore(false);
    if (!focusedProjectId) setVisibleLimit(PROJECT_BATCH_SIZE);
  }, [focusedProjectId, listViewKey]);

  useEffect(() => {
    const sentinel = loadMoreRef.current;
    if (!sentinel || !hasMoreProjects) return undefined;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting || loadMoreTimerRef.current !== null) return;

        setIsLoadingMore(true);
        loadMoreTimerRef.current = window.setTimeout(() => {
          setVisibleLimit((limit) => Math.min(limit + PROJECT_BATCH_SIZE, visibleProjects.length));
          setIsLoadingMore(false);
          loadMoreTimerRef.current = null;
        }, LOAD_MORE_DELAY_MS);
      },
      { rootMargin: '80px 0px' },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMoreProjects, visibleProjects.length]);

  useEffect(
    () => () => {
      if (loadMoreTimerRef.current !== null) {
        window.clearTimeout(loadMoreTimerRef.current);
      }
    },
    [],
  );

  const heading =
    filter === 'unassigned'
      ? t('פרויקטים ללא שיוך')
      : filter === 'archive'
        ? t('ארכיון פרויקטים')
        : filter === 'mine'
          ? t('הפרויקטים שלי')
          : t('כל הפרויקטים');
  const listLoading = !projectsLoaded && !projects.length;
  const countLabel = listLoading
    ? t('טוען...')
    : query || statusFilter
      ? t(
          categoryProjects.length === 1
            ? '{{count}} מתוך פרויקט אחד'
            : '{{count}} מתוך {{total}} פרויקטים',
          {
            count: visibleProjects.length,
            total: categoryProjects.length,
          },
        )
      : visibleProjects.length === 1
        ? t('פרויקט אחד')
        : t('{{count}} פרויקטים', { count: visibleProjects.length });

  return (
    <section className="card">
      {deepLinkDenied && (
        <div className="projectDeepLinkNotice" role="alert">
          <ShieldAlert size={22} />
          <div>
            <b>{t('אין לך הרשאה לצפות בפרויקט זה')}</b>
            <span>{t('הפרויקט אינו משויך אליך ולכן פרטיו אינם זמינים עבורך.')}</span>
          </div>
          <button type="button" onClick={() => setDeepLinkDenied(false)} aria-label={t('סגירה')}>
            ×
          </button>
        </div>
      )}
      <header className="projectListHeader">
        <div className="projectListHeading">
          <h2>{heading}</h2>
          <span
            className={listLoading || query || statusFilter || !isManager ? 'projectListCount' : 'visuallyHidden'}
            role="status"
            aria-live="polite"
            aria-atomic="true"
          >
            {countLabel}
          </span>
        </div>
        <div className="projectListFilters">
          <div className="projectListSearch">
            <label htmlFor="project-search" className="visuallyHidden">
              {t('חיפוש פרויקטים')}
            </label>
            <Search size={18} aria-hidden="true" />
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
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            <option value="">{t('כל הסטטוסים')}</option>
            {appStatuses.map((status) => (
              <option key={status} value={status}>
                {t(status)}
              </option>
            ))}
          </select>
        </div>
      </header>
      <div className="projects" aria-busy={isLoadingMore}>
        {visibleProjects.length === 0 && (
          <div className="empty">{t('אין פרויקטים להצגה כרגע')}</div>
        )}
        {pagedProjects.map((project) => (
          <div
            key={project.id}
            id={`project-${project.id}`}
            className={project.id === focusedProjectId ? 'projectDeepLinkTarget' : ''}
          >
            <ProjectCard project={project} focused={project.id === focusedProjectId} />
          </div>
        ))}
        {hasMoreProjects && (
          <div
            ref={loadMoreRef}
            className={`projectLoadSentinel${isLoadingMore ? ' loading' : ''}`}
            role={isLoadingMore ? 'status' : undefined}
            aria-live={isLoadingMore ? 'polite' : undefined}
            aria-hidden={isLoadingMore ? undefined : 'true'}
          >
            {isLoadingMore && (
              <>
                <span className="projectLoadSpinner" aria-hidden="true" />
                <span>{t('טוען פרויקטים נוספים...')}</span>
              </>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
