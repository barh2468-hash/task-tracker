import { useTranslation } from 'react-i18next';
import { t } from '../../language/LanguageContext.jsx';
import { useState } from 'react';
import { FolderKanban } from 'lucide-react';
import { useProjects } from '../ProjectsContext.jsx';
import { appStatuses } from '../../../services/supabase.js';
import StatusPill from '../../../components/StatusPill.jsx';

export default function WorkerAssignmentsPanel({ onOpenProject }) {
  useTranslation();
  const { projects, workers } = useProjects();
  const [search, setSearch] = useState('');
  const [assignmentStatus, setAssignmentStatus] = useState('');
  const [includeArchived, setIncludeArchived] = useState(false);
  const normalizedSearch = search.trim().toLowerCase();
  const fieldWorkers = workers.filter((worker) => worker.role === 'field_worker');

  const workerRows = fieldWorkers
    .map((worker) => {
      const workerMatches =
        !normalizedSearch ||
        `${worker.full_name} ${worker.email || ''}`.toLowerCase().includes(normalizedSearch);
      const assignedProjects = projects
        .filter(
          (project) =>
            project.assigned_to === worker.id ||
            project.project_workers?.some((assignment) => assignment.worker_id === worker.id),
        )
        .filter((project) => includeArchived || !project.is_archived)
        .filter((project) => !assignmentStatus || project.status === assignmentStatus)
        .filter((project) => {
          if (workerMatches) return true;
          const projectText = `${project.name} ${project.client_name || ''} ${project.location} ${project.status}`;
          return projectText.toLowerCase().includes(normalizedSearch);
        })
        .sort((a, b) => a.name.localeCompare(b.name, 'he'));

      return { worker, projects: assignedProjects, workerMatches };
    })
    .filter(
      ({ projects: assignedProjects, workerMatches }) =>
        assignedProjects.length > 0 || (workerMatches && !assignmentStatus && !normalizedSearch),
    );

  const assignedActiveProjects = new Set(
    projects
      .filter((project) => !project.is_archived)
      .filter((project) => project.assigned_to || (project.project_workers?.length || 0) > 0)
      .map((project) => project.id),
  ).size;
  const workersWithoutProjects = fieldWorkers.filter(
    (worker) =>
      !projects.some(
        (project) =>
          !project.is_archived &&
          (project.assigned_to === worker.id ||
            project.project_workers?.some((assignment) => assignment.worker_id === worker.id)),
      ),
  ).length;

  return (
    <section className="card assignmentsPanel">
      <div className="panelHeader">
        <div>
          <h2>{t('פרויקטים משויכים לפי עובד')}</h2>
          <p className="muted">
            {t('תמונת מצב של כל עובד שטח, כולל פרויקטים שבהם הוא אחראי ראשי או עובד נוסף.')}
          </p>
        </div>
      </div>

      <div className="assignmentSummary">
        <div>
          <strong>{fieldWorkers.length}</strong>
          <span>{t('עובדי שטח')}</span>
        </div>
        <div>
          <strong>{assignedActiveProjects}</strong>
          <span>{t('פרויקטים פעילים משויכים')}</span>
        </div>
        <div>
          <strong>{workersWithoutProjects}</strong>
          <span>{t('עובדים ללא פרויקט פעיל')}</span>
        </div>
      </div>

      <div className="toolbar assignmentToolbar">
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={t('חיפוש עובד, פרויקט, לקוח או מיקום...')}
        />

        <select
          value={assignmentStatus}
          onChange={(event) => setAssignmentStatus(event.target.value)}
        >
          <option value="">{t('כל הסטטוסים')}</option>
          {appStatuses.map((status) => (
            <option key={status} value={status}>
              {t(status)}
            </option>
          ))}
        </select>
        <label className="archiveToggle">
          <input
            type="checkbox"
            checked={includeArchived}
            onChange={(event) => setIncludeArchived(event.target.checked)}
          />

          {t('הצג גם פרויקטים בארכיון')}
        </label>
      </div>

      <div className="workerAssignmentGrid">
        {workerRows.map(({ worker, projects: assignedProjects }) => (
          <article className="workerAssignmentCard" key={worker.id}>
            <header>
              <div className="avatar">{worker.full_name?.[0] || t('ע')}</div>
              <div>
                <h3>{worker.full_name}</h3>
                <p>{worker.email || t('ללא כתובת מייל')}</p>
              </div>
              <span className="assignmentCount">
                {assignedProjects.length}
                {t('פרויקטים')}
              </span>
            </header>

            <div className="assignedProjectList">
              {assignedProjects.map((project) => {
                const isPrimary = project.assigned_to === worker.id;
                return (
                  <div className="assignedProjectRow" key={project.id}>
                    <div className="assignedProjectHeading">
                      <div>
                        <b>{project.name}</b>
                        <span>
                          {project.client_name || t('ללא לקוח')} · {project.location}
                        </span>
                      </div>
                      <StatusPill status={project.status} />
                    </div>
                    <div className="assignedProjectMeta">
                      <span className={isPrimary ? 'primaryAssignment' : 'extraAssignment'}>
                        {isPrimary ? t('אחראי ראשי') : t('עובד נוסף')}
                      </span>
                      <span>
                        {project.progress}
                        {t('% התקדמות')}
                      </span>
                      <span>
                        {t('יעד:')}
                        {project.due_date
                          ? new Date(project.due_date).toLocaleDateString('he-IL')
                          : t('לא הוגדר')}
                      </span>
                      {project.is_archived && <span className="archiveBadge">{t('בארכיון')}</span>}
                    </div>
                    <div className="progress assignmentProgress">
                      <i style={{ width: `${project.progress}%` }} />
                    </div>
                    <button
                      type="button"
                      className="ghost smallBtn assignedProjectOpen"
                      onClick={() => onOpenProject?.(project)}
                    >
                      <FolderKanban size={16} />
                      {t('פתיחת פרויקט')}
                    </button>
                  </div>
                );
              })}
              {assignedProjects.length === 0 && (
                <div className="assignmentEmpty">{t('אין לעובד פרויקטים פעילים משויכים')}</div>
              )}
            </div>
          </article>
        ))}
        {workerRows.length === 0 && (
          <div className="empty">{t('לא נמצאו עובדים או פרויקטים התואמים לסינון.')}</div>
        )}
      </div>
    </section>
  );
}
