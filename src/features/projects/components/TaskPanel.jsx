import { PlusCircle } from 'lucide-react';

export default function TaskPanel({
  tasks,
  isManager,
  canAddTasks,
  canCompleteTasks,
  showTaskForm,
  setShowTaskForm,
  taskTitle,
  setTaskTitle,
  taskDescription,
  setTaskDescription,
  onAdd,
  onToggle,
  onDelete,
}) {
  const sortedTasks = [...tasks].sort(
    (a, b) =>
      Number(a.is_done) - Number(b.is_done) ||
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );

  return (
    <div className="tasksBox">
      <div className="tasksHeader">
        <b>משימות</b>
        {canAddTasks && (
          <button
            className="ghost tinyBtn"
            onClick={() => setShowTaskForm(!showTaskForm)}
          >
            <PlusCircle size={15} /> {isManager ? 'משימה לעובד' : 'משימה למנהלים'}
          </button>
        )}
      </div>
      {showTaskForm && canAddTasks && (
        <div className="taskForm">
          <input
            value={taskTitle}
            onChange={(e) => setTaskTitle(e.target.value)}
            placeholder="כותרת משימה"
          />
          <textarea
            value={taskDescription}
            onChange={(e) => setTaskDescription(e.target.value)}
            placeholder="פירוט המשימה, אופציונלי"
          />
          <div className="actionsRow">
            <button className="smallBtn" onClick={onAdd}>
              {isManager ? 'הוסף משימה' : 'שלח משימה למנהלים'}
            </button>
            <button
              className="ghost smallBtn"
              onClick={() => setShowTaskForm(false)}
            >
              ביטול
            </button>
          </div>
        </div>
      )}
      {sortedTasks.length === 0 && (
        <div className="muted taskEmpty">אין משימות בפרויקט</div>
      )}
      {sortedTasks.map((task) => (
        <div
          className={`taskItem ${task.is_done ? 'doneTask' : ''}`}
          key={task.id}
        >
          <div>
            <b>{task.title}</b>
            {task.description && <p className="muted">{task.description}</p>}
            <span className="muted">
              נוצר על ידי {task.profiles?.full_name || 'מנהל'} ·{' '}
              {new Date(task.created_at).toLocaleDateString('he-IL')}
            </span>
          </div>
          {canCompleteTasks && (
            <div className="taskActions">
              <button className="ghost tinyBtn" onClick={() => onToggle(task)}>
                {task.is_done ? 'פתח' : 'בוצע'}
              </button>
              {isManager && (
                <button
                  className="danger ghost tinyBtn"
                  onClick={() => onDelete(task)}
                >
                  מחיקה
                </button>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
