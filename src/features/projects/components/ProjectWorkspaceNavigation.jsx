import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react';
import { t } from '../../language/LanguageContext.jsx';
import { useAuth } from '../../auth/useAuth.js';
import { useProjects } from '../ProjectsContext.jsx';

export default function ProjectWorkspaceNavigation({ stats }) {
  useTranslation();
  const { isManager, session } = useAuth();
  const { projects, projectsLoaded } = useProjects();
  const { pathname } = useLocation();
  const [searchParams] = useSearchParams();

  if (!isManager) return null;

  const filter = searchParams.get('filter') || 'all';
  const myProjectCount = projects.filter(
    (project) => !project.is_archived && project.assigned_to === session?.user?.id,
  ).length;
  const views = [
    { filter: 'all', label: 'כל הפרויקטים', count: stats.total },
    { filter: 'mine', label: 'הפרויקטים שלי', count: myProjectCount },
    { filter: 'unassigned', label: 'ללא שיוך', count: stats.unassigned },
    { filter: 'archive', label: 'ארכיון', count: stats.archived },
    { path: '/app/assignments', label: 'לפי עובד' },
  ];

  return (
    <div className="projectWorkspaceNavigation">
      <nav className="projectViewLinks" aria-label={t('תצוגות פרויקטים')}>
        {views.map((view) => {
          const path = view.path || `/app/projects?filter=${view.filter}`;
          const active = view.path
            ? pathname === view.path
            : pathname === '/app/projects' && filter === view.filter;
          return (
            <Link
              key={path}
              to={path}
              className={`projectViewLink${active ? ' active' : ''}`}
              aria-current={active ? 'page' : undefined}
            >
              <span>{t(view.label)}</span>
              {(projectsLoaded || projects.length > 0) && typeof view.count === 'number' && (
                <span className="projectViewCount">{view.count}</span>
              )}
            </Link>
          );
        })}
      </nav>
      <Link
        to="/app/projects/new"
        className="projectCreateLink"
        aria-current={pathname === '/app/projects/new' ? 'page' : undefined}
      >
        <Plus size={17} aria-hidden="true" />
        {t('פרויקט חדש')}
      </Link>
    </div>
  );
}
