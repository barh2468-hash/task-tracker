import { useTranslation } from 'react-i18next';
import { t } from '../features/language/LanguageContext.jsx';
import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, MapPin, MessageCircle, Search, ShieldAlert, UserRound, X } from 'lucide-react';
import { useAuth } from '../features/auth/useAuth.js';
import { useProjects } from '../features/projects/ProjectsContext.jsx';
import { useChat } from '../features/chat/ChatContext.jsx';
import { useMessage } from '../context/MessageContext.jsx';
import { appStatuses } from '../services/supabase.js';
import ProjectCard from '../features/projects/components/ProjectCard.jsx';
import StatusPill, { getStatusClass } from '../components/StatusPill.jsx';
import '../features/projects/project-workspace.css';
import '../features/projects/project-search.css';
import { getProjectPage } from '../features/projects/utils/projectPage.js';
import {
  hasProjectAssignment,
  isProjectAssignedTo,
} from '../features/projects/utils/assignments.js';
import { assignmentReturnLocation } from '../features/projects/utils/assignmentNavigation.js';

const PROJECT_BATCH_SIZE = 20;
const LOAD_MORE_DELAY_MS = 650;

export default function ProjectsPage() {
  useTranslation();
  const { isManager, session } = useAuth();
  const { projects, projectsLoaded } = useProjects();
  const { projectRoomsByProjectId } = useChat();
  const { setMessage } = useMessage();
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const searchInputRef = useRef(null);
  const [query, setQuery] = useState('');
  const [visibleLimit, setVisibleLimit] = useState(PROJECT_BATCH_SIZE);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const selectedProjectId = searchParams.get('project');
  const selectedProject = projects.find((project) => project.id === selectedProjectId);
  const projectVisible = Boolean(selectedProject);
  const listScrollRef = useRef(0);
  const lastOpenedProjectRef = useRef(null);
  const previousSelectedRef = useRef(selectedProjectId);
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

  // Resolve links against the permitted project list before showing any details.
  useEffect(() => {
    if (!projectsLoaded || !selectedProjectId) return;
    const next = new URLSearchParams(searchParams);
    if (!selectedProject) {
      next.delete('project');
      setDeepLinkDenied(true);
      setMessage(t('אין לך הרשאה לצפות בפרויקט זה.'), 'error');
      setSearchParams(next, { replace: true, state: location.state });
      return;
    }
    setDeepLinkDenied(false);
    const linkedFilter = selectedProject.is_archived ? 'archive' : isManager ? filter : 'mine';
    if (filter !== linkedFilter) {
      next.set('filter', linkedFilter);
      setSearchParams(next, { replace: true, state: location.state });
    }
  }, [
    filter,
    location.state,
    isManager,
    projectsLoaded,
    selectedProject,
    selectedProjectId,
    searchParams,
    setMessage,
    setSearchParams,
  ]);

  function openProject(project) {
    listScrollRef.current = window.scrollY;
    lastOpenedProjectRef.current = project.id;
    const next = new URLSearchParams(searchParams);
    next.set('project', project.id);
    setSearchParams(next);
  }

  function closeProject() {
    const origin = isManager && assignmentReturnLocation(location.state);
    if (origin) {
      navigate(
        { pathname: origin.pathname, search: origin.search },
        { replace: true, state: origin.state },
      );
      return;
    }
    const next = new URLSearchParams(searchParams);
    next.delete('project');
    next.delete('tab');
    setSearchParams(next);
  }

  useEffect(() => {
    const previous = previousSelectedRef.current;
    previousSelectedRef.current = selectedProjectId;
    if (!selectedProjectId && !previous) return;
    const frame = window.requestAnimationFrame(() => {
      if (selectedProjectId) {
        window.scrollTo({ top: 0, behavior: 'instant' });
        document
          .getElementById(`project-title-${selectedProjectId}`)
          ?.focus({ preventScroll: true });
      } else {
        document
          .getElementById(`open-project-${lastOpenedProjectRef.current}`)
          ?.focus({ preventScroll: true });
        window.scrollTo({ top: listScrollRef.current, behavior: 'instant' });
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [selectedProjectId, projectVisible]);

  const categoryProjects = projects.filter((p) => {
    const okArchive = filter === 'archive' ? !!p.is_archived : !p.is_archived;
    const okTab =
      filter === 'unassigned'
        ? !hasProjectAssignment(p)
        : filter !== 'mine' || !isManager || isProjectAssignedTo(p, session?.user?.id);
    return okArchive && okTab;
  });
  const visibleProjects = categoryProjects.filter((p) => {
    const text =
      `${p.name} ${p.location} ${p.contact_phone || ''} ${p.contact_email || ''} ${p.client_name || ''} ${p.description || ''} ${p.additional_notes || ''}`.toLowerCase();
    const okQuery = !query || text.includes(query.toLowerCase());
    const okStatus = !statusFilter || p.status === statusFilter;
    return okQuery && okStatus;
  });
  const pagedProjects = getProjectPage(visibleProjects, visibleLimit);
  const hasMoreProjects = visibleLimit < visibleProjects.length;

  useEffect(() => {
    if (previousListViewKeyRef.current === listViewKey) return;
    previousListViewKeyRef.current = listViewKey;
    if (loadMoreTimerRef.current !== null) {
      window.clearTimeout(loadMoreTimerRef.current);
      loadMoreTimerRef.current = null;
    }
    setIsLoadingMore(false);
    if (!selectedProjectId) setVisibleLimit(PROJECT_BATCH_SIZE);
  }, [selectedProjectId, listViewKey]);

  useEffect(() => {
    if (selectedProjectId) return undefined;
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
  }, [hasMoreProjects, selectedProjectId, visibleProjects.length]);

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
    <section className={`card projectsPage${selectedProject ? ' projectsPageDetail' : ''}`}>
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
      {selectedProject && (
        <ProjectCard
          key={selectedProject.id}
          project={selectedProject}
          onBack={closeProject}
          initialTab={searchParams.get('tab')}
        />
      )}
      <div hidden={Boolean(selectedProject)}>
        <header className="projectListHeader">
          <div className="projectListHeading">
            <h2>{heading}</h2>
            <span
              className={
                listLoading || query || statusFilter || !isManager
                  ? 'projectListCount'
                  : 'visuallyHidden'
              }
              role="status"
              aria-live="polite"
              aria-atomic="true"
            >
              {countLabel}
            </span>
          </div>
          <div className="projectListFilters">
            <div className={`projectListSearch${query ? ' hasQuery' : ''}`}>
              <label htmlFor="project-search" className="visuallyHidden">
                {t('חיפוש פרויקטים')}
              </label>
              <Search size={18} aria-hidden="true" />
              <input
                id="project-search"
                ref={searchInputRef}
                placeholder={t('חיפוש לפי שם, לקוח או מיקום...')}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              {query && (
                <button
                  type="button"
                  className="projectSearchClear"
                  aria-label={t('ניקוי חיפוש פרויקטים')}
                  title={t('ניקוי חיפוש פרויקטים')}
                  onClick={() => {
                    setQuery('');
                    searchInputRef.current?.focus();
                  }}
                >
                  <X size={15} aria-hidden="true" />
                </button>
              )}
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
          {pagedProjects.map((project) => {
            const chatUnread = Number(projectRoomsByProjectId.get(project.id)?.unread_count || 0);
            return (
              <div key={project.id} id={`project-${project.id}`} className="projectListRow">
                <button
                  type="button"
                  className={`projectListItem status-${getStatusClass(project.status)}`}
                  id={`open-project-${project.id}`}
                  onClick={() => openProject(project)}
                  aria-label={t('פתיחת פרויקט {{name}}', { name: project.name })}
                >
                  <span className="projectListItemName">
                    <b dir="auto">
                      {project.name}
                      {chatUnread > 0 && (
                        <span
                          className="projectListChatBadge"
                          title={t('{{value0}} הודעות חדשות בדיון', { value0: chatUnread })}
                        >
                          <MessageCircle size={12} aria-hidden="true" />
                          {chatUnread > 99 ? '99+' : chatUnread}
                        </span>
                      )}
                    </b>
                    {project.location && (
                      <span className="projectListLocation">
                        <MapPin size={14} aria-hidden="true" />
                        <bdi>{project.location}</bdi>
                      </span>
                    )}
                  </span>
                  <span className="projectListItemOwner">
                    <UserRound size={15} aria-hidden="true" />
                    <bdi>{project.profiles?.full_name || t('לא משויך')}</bdi>
                  </span>
                  <StatusPill status={project.status} />
                  <span className="projectListOpenIcon" aria-hidden="true">
                    <ArrowLeft size={18} />
                  </span>
                </button>
              </div>
            );
          })}
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
      </div>
    </section>
  );
}
