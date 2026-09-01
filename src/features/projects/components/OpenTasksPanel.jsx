import { useState } from 'react';
import {
  CheckCircle,
  Clock,
  FolderKanban,
  MapPin,
  Pencil,
  Search,
  Trash2,
  Users,
} from 'lucide-react';
import { useAuth } from '../../auth/useAuth.js';
import { useProjects } from '../ProjectsContext.jsx';
import { getStatusClass } from '../../../components/StatusPill.jsx';

export default function OpenTasksPanel({ onOpenProject }) {
  const { isManager } = useAuth();
  const { projects, updateProjectTask, toggleProjectTask, deleteProjectTask } = useProjects();
  const activeProjects = projects.filter((p) => !p.is_archived);

  const [query, setQuery] = useState('');
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');

  function openProject(project) {
    if (onOpenProject) onOpenProject(project);
  }

  const openTasks = activeProjects
    .flatMap((project) =>
      (project.project_tasks || [])
        .filter((task) => !task.is_done)
        .map((task) => ({ task, project })),
    )
    .filter(({ task, project }) => {
      const assignedNames = [
        project.profiles?.full_name,
        ...(project.project_workers || []).map(
          (assignment) => assignment.profiles?.full_name,
        ),
      ]
        .filter(Boolean)
        .join(' ');
      const searchable = `${task.title} ${task.description || ''} ${project.name} ${project.location} ${assignedNames}`.toLowerCase();
      return !query.trim() || searchable.includes(query.trim().toLowerCase());
    })
    .sort(
      (a, b) =>
        new Date(b.task.updated_at || b.task.created_at).getTime() -
        new Date(a.task.updated_at || a.task.created_at).getTime(),
    );

  function beginEdit(task) {
    setEditingTaskId(task.id);
    setEditTitle(task.title);
    setEditDescription(task.description || '');
  }

  function cancelEdit() {
    setEditingTaskId(null);
    setEditTitle('');
    setEditDescription('');
  }

  return (
    <section className="card openTasksPanel">
      <div className="reportHeader openTasksHeader">
        <div>
          <h2>משימות פתוחות</h2>
          <p className="muted">
            {isManager
              ? 'כל המשימות הפתוחות במערכת. ניתן לערוך, להשלים או למחוק משימה.'
              : 'המשימות הפתוחות בפרויקטים שאליהם אתה משויך.'}
          </p>
        </div>
        <span className="openTasksCount">{openTasks.length} פתוחות</span>
      </div>

      <div className="toolbar openTasksToolbar">
        <Search size={18} />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="חיפוש משימה, פרויקט, מיקום או עובד..."
        />
      </div>

      <div className="openTasksList">
        {openTasks.length === 0 && (
          <div className="empty">
            {query ? 'לא נמצאו משימות התואמות לחיפוש' : 'אין משימות פתוחות כרגע'}
          </div>
        )}

        {openTasks.map(({ task, project }) => {
          const assignedNames = Array.from(
            new Set(
              [
                project.profiles?.full_name,
                ...(project.project_workers || [])
                  .filter(
                    (assignment) =>
                      !assignment.profiles?.role ||
                      assignment.profiles.role === 'field_worker',
                  )
                  .map((assignment) => assignment.profiles?.full_name),
              ].filter(Boolean),
            ),
          );
          const isEditing = editingTaskId === task.id;

          return (
            <article className="openTaskCard" key={task.id}>
              <div className="openTaskMain">
                <div className="openTaskProjectLine">
                  <button
                    className="openTaskProjectButton"
                    onClick={() => openProject(project)}
                  >
                    <FolderKanban size={16} /> {project.name}
                  </button>
                  <span className={`pill ${getStatusClass(project.status)}`}>
                    {project.status}
                  </span>
                </div>

                {isEditing ? (
                  <div className="openTaskEditForm">
                    <label>
                      כותרת המשימה
                      <input
                        value={editTitle}
                        onChange={(event) => setEditTitle(event.target.value)}
                      />
                    </label>
                    <label>
                      פירוט
                      <textarea
                        value={editDescription}
                        onChange={(event) => setEditDescription(event.target.value)}
                        placeholder="פירוט המשימה, אופציונלי"
                      />
                    </label>
                  </div>
                ) : (
                  <div className="openTaskContent">
                    <h3>{task.title}</h3>
                    {task.description && <p>{task.description}</p>}
                  </div>
                )}

                <div className="openTaskMeta">
                  <span><MapPin size={14} /> {project.location}</span>
                  <span><Users size={14} /> {assignedNames.join(', ') || 'ללא עובד משויך'}</span>
                  <span><Clock size={14} /> {new Date(task.created_at).toLocaleDateString('he-IL')}</span>
                </div>
              </div>

              <div className="openTaskActions">
                {isManager && isEditing ? (
                  <>
                    <button
                      className="smallBtn"
                      disabled={!editTitle.trim()}
                      onClick={async () => {
                        await updateProjectTask(task, project, editTitle, editDescription);
                        cancelEdit();
                      }}
                    >
                      <CheckCircle size={16} /> שמירה
                    </button>
                    <button className="ghost smallBtn" onClick={cancelEdit}>
                      ביטול
                    </button>
                  </>
                ) : (
                  <>
                    <button className="ghost smallBtn" onClick={() => openProject(project)}>
                      פתיחת פרויקט
                    </button>
                    {!isManager && (
                      <button className="smallBtn" onClick={() => toggleProjectTask(task, project)}>
                        <CheckCircle size={15} /> סמן כבוצע
                      </button>
                    )}
                    {isManager && (
                      <>
                        <button className="ghost smallBtn" onClick={() => beginEdit(task)}>
                          <Pencil size={15} /> עריכה
                        </button>
                        <button className="smallBtn" onClick={() => toggleProjectTask(task, project)}>
                          <CheckCircle size={15} /> סמן כבוצע
                        </button>
                        <button className="danger ghost smallBtn" onClick={() => deleteProjectTask(task)}>
                          <Trash2 size={15} /> מחיקה
                        </button>
                      </>
                    )}
                  </>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
