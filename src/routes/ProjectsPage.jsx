import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search } from 'lucide-react';
import { useAuth } from '../features/auth/useAuth.js';
import { useProjects } from '../features/projects/ProjectsContext.jsx';
import { appStatuses } from '../services/supabase.js';
import ProjectCard from '../features/projects/components/ProjectCard.jsx';

export default function ProjectsPage() {
  const { isManager, session } = useAuth();
  const { projects } = useProjects();
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState('');
  const handledPushProjectRef = useRef(null);

  const filter = searchParams.get('filter') || (isManager ? 'all' : 'mine');
  const statusFilter = searchParams.get('status') || '';

  // Mirrors the old one-shot ?project=<id> deep-link handling from push
  // notifications: land on the right filter, then scroll the card into view.
  useEffect(() => {
    if (!projects.length) return;
    const projectId = searchParams.get('project');
    if (!projectId || handledPushProjectRef.current === projectId) return;
    handledPushProjectRef.current = projectId;
    const linkedProject = projects.find((p) => p.id === projectId);
    if (!linkedProject) return;

    const next = new URLSearchParams(searchParams);
    next.delete('project');
    next.set('filter', linkedProject.is_archived ? 'archive' : isManager ? 'all' : 'mine');
    next.delete('status');
    setSearchParams(next, { replace: true });

    window.requestAnimationFrame(() => {
      document.getElementById(`project-${projectId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projects]);

  function setStatusFilter(nextStatus) {
    const next = new URLSearchParams(searchParams);
    if (nextStatus) next.set('status', nextStatus);
    else next.delete('status');
    setSearchParams(next);
  }

  const visibleProjects = projects.filter((p) => {
    const text = `${p.name} ${p.location} ${p.contact_phone || ''} ${p.contact_email || ''} ${p.client_name || ''} ${p.description || ''}`.toLowerCase();
    const okQuery = !query || text.includes(query.toLowerCase());
    const okStatus = !statusFilter || p.status === statusFilter;
    const okArchive = filter === 'archive' ? !!p.is_archived : !p.is_archived;
    const okTab = filter === 'unassigned' ? !p.assigned_to : filter !== 'mine' || !isManager || p.assigned_to === session?.user?.id;
    return okQuery && okStatus && okArchive && okTab;
  });

  const heading =
    filter === 'unassigned'
      ? 'פרויקטים ללא שיוך'
      : filter === 'archive'
        ? 'ארכיון פרויקטים'
        : filter === 'mine' && !isManager
          ? 'הפרויקטים שלי'
          : 'כל הפרויקטים';

  return (
    <section className="card">
      <div className="toolbar">
        <div style={{ minWidth: 260, flex: 1 }}>
          <label htmlFor="project-search" className="visuallyHidden">
            חיפוש פרויקטים
          </label>
          <input
            id="project-search"
            placeholder="חיפוש לפי שם, לקוח או מיקום..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <label htmlFor="project-status-filter" className="visuallyHidden">
          סינון לפי סטטוס
        </label>
        <select
          id="project-status-filter"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{ maxWidth: 220 }}
        >
          <option value="">כל הסטטוסים</option>
          {appStatuses.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <button className="ghost">
          <Search size={16} /> סינון
        </button>
      </div>
      <h2>{heading}</h2>
      <div className="projects">
        {visibleProjects.length === 0 && <div className="empty">אין פרויקטים להצגה כרגע</div>}
        {visibleProjects.map((project) => (
          <div key={project.id} id={`project-${project.id}`}>
            <ProjectCard project={project} />
          </div>
        ))}
      </div>
    </section>
  );
}
