import { useProjects } from '../../projects/ProjectsContext.jsx';

export default function HistoryPanel() {
  const { historyItems, projects } = useProjects();
  const projectName = (id) =>
    projects.find((p) => p.id === id)?.name || 'פרויקט';
  return (
    <section className="card">
      <h2>היסטוריית שינויים</h2>
      <div className="projects">
        {historyItems.length === 0 && (
          <div className="empty">אין היסטוריה להצגה</div>
        )}
        {historyItems.map((h) => (
          <div className="historyItem" key={h.id}>
            <b>{projectName(h.project_id)}</b> · {h.new_status}
            <br />
            <span className="muted">
              {h.profiles?.full_name || 'משתמש'} ·{' '}
              {new Date(h.created_at).toLocaleString('he-IL')}
            </span>
            {h.note && <p className="muted">{h.note}</p>}
          </div>
        ))}
      </div>
    </section>
  );
}
