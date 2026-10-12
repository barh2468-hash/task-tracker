import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../features/auth/useAuth.js';
import { useProjects } from '../features/projects/ProjectsContext.jsx';
import { getPersonalNotes, savePersonalNote, deletePersonalNote } from '../services/api/personalNotes.js';
import '../features/attendance/personal.css';

const empty = { title: '', body: '', project_id: '' };
export default function PersonalNotesPage() {
  const { session } = useAuth();
  const { projects } = useProjects();
  const [notes, setNotes] = useState([]);
  const [form, setForm] = useState(empty);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState('');
  useEffect(() => {
    let active = true;
    setLoading(true);
    getPersonalNotes().then(({ data, error: loadError }) => {
      if (!active) return;
      if (loadError) setError(`טעינת ההערות נכשלה: ${loadError.message}`);
      else setNotes(data || []);
      setLoading(false);
    }).catch((err) => { if (active) { setError(err.message); setLoading(false); } });
    return () => { active = false; };
  }, [session?.user?.id]);
  async function save(event) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError('');
    try {
      const { data, error: saveError } = await savePersonalNote(editingId, { owner_id: session.user.id, title: form.title.trim(), body: form.body.trim(), project_id: form.project_id || null });
      if (saveError) throw saveError;
      setNotes((current) => [data, ...current.filter((note) => note.id !== data.id)]);
      setForm(empty); setEditingId(null);
    } catch (err) { setError(`שמירת ההערה נכשלה: ${err.message}`); } finally { setBusy(false); }
  }
  async function remove(note) {
    if (busy || !window.confirm(`למחוק את ההערה „${note.title}”?`)) return;
    setBusy(true);
    try {
      const { error: deleteError } = await deletePersonalNote(note.id);
      if (deleteError) throw deleteError;
      setNotes((current) => current.filter((item) => item.id !== note.id));
      if (editingId === note.id) { setEditingId(null); setForm(empty); }
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  return <section className="card personalPage"><h2>ההערות שלי</h2><p className="muted">הערות אישיות שרק אתה יכול לראות, עם קישור לפרויקט לפי הצורך.</p>
    {error && <p role="alert">{error}</p>}
    <form className="personalNoteForm" onSubmit={save}>
      <label>כותרת<input required maxLength={200} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></label>
      <label>הערה<textarea required maxLength={10000} rows={4} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} /></label>
      <label>קישור לפרויקט<select value={form.project_id} onChange={(e) => setForm({ ...form, project_id: e.target.value })}><option value="">ללא פרויקט</option>{form.project_id && !projects.some((project) => project.id === form.project_id) && <option value={form.project_id}>פרויקט שאינו זמין כרגע</option>}{projects.map((project) => <option key={project.id} value={project.id}>{project.name}{project.is_archived ? ' · ארכיון' : ''}</option>)}</select></label>
      <div className="personalNoteActions"><button disabled={busy || !form.title.trim() || !form.body.trim()}>{busy ? 'שומר...' : editingId ? 'שמירת שינויים' : 'הוספת הערה'}</button>{editingId && <button type="button" className="ghost" disabled={busy} onClick={() => { setForm(empty); setEditingId(null); }}>ביטול עריכה</button>}</div>
    </form>
    <label>סינון לפי פרויקט<select value={filter} onChange={(e) => setFilter(e.target.value)}><option value="">כל ההערות</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label>
    {loading ? <p role="status">טוען הערות...</p> : notes.filter((note) => !filter || note.project_id === filter).map((note) => {
      const project = projects.find((item) => item.id === note.project_id);
      return <article key={note.id} className="personalEntry"><div><b>{note.title}</b><p className="personalNoteText">{note.body}</p>{project && <Link to={`/app/projects?project=${encodeURIComponent(project.id)}`}>{project.name}</Link>}<p className="muted">{new Date(note.updated_at).toLocaleString('he-IL')}</p></div><div className="personalNoteActions"><button className="ghost" disabled={busy} onClick={() => { setEditingId(note.id); setForm({ title: note.title, body: note.body, project_id: note.project_id || '' }); }}>עריכה</button><button className="danger ghost" disabled={busy} onClick={() => void remove(note)}>מחיקה</button></div></article>;
    })}
    {!loading && !notes.length && <p className="empty">עדיין אין הערות אישיות.</p>}
  </section>;
}
