import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../features/auth/useAuth.js';
import { useProjects } from '../features/projects/ProjectsContext.jsx';
import { getPersonalNotes, savePersonalNote, deletePersonalNote } from '../services/api/personalNotes.js';
import '../features/attendance/personal.css';
import useFormDraft from '../features/drafts/useFormDraft.js';
import DraftNotice from '../features/drafts/DraftNotice.jsx';
import { useTranslation } from 'react-i18next';
import { t, useLanguage } from '../features/language/LanguageContext.jsx';
import { localeForLanguage } from '../features/language/locale.js';

const empty = { title: '', body: '', project_id: '' };
const emptyDraft = { form: empty, editingId: null };
export default function PersonalNotesPage() {
  useTranslation();
  const { language } = useLanguage();
  const locale = localeForLanguage(language);
  const { session } = useAuth();
  const { projects } = useProjects();
  const [notes, setNotes] = useState([]);
  const draft = useFormDraft({ userId: session?.user?.id, formId: 'personal-note', initialValue: emptyDraft });
  const { form, editingId } = draft.value;
  function setForm(form) { draft.setValue((current) => ({ ...current, form })); }
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState('');
  useEffect(() => {
    let active = true;
    setLoading(true);
    getPersonalNotes().then(({ data, error: loadError }) => {
      if (!active) return;
      if (loadError) setError({ key: 'טעינת ההערות נכשלה: {{message}}', message: loadError.message });
      else setNotes(data || []);
      setLoading(false);
    }).catch((err) => { if (active) { setError({ key: 'טעינת ההערות נכשלה: {{message}}', message: err.message }); setLoading(false); } });
    return () => { active = false; };
  }, [session?.user?.id]);
  async function save(event) {
    event.preventDefault();
    if (busy || !draft.ready) return;
    setBusy(true); setError('');
    try {
      const { data, error: saveError } = await savePersonalNote(editingId, { owner_id: session.user.id, title: form.title.trim(), body: form.body.trim(), project_id: form.project_id || null });
      if (saveError) throw saveError;
      setNotes((current) => [data, ...current.filter((note) => note.id !== data.id)]);
      await draft.clear();
    } catch (err) { setError({ key: 'שמירת ההערה נכשלה: {{message}}', message: err.message }); } finally { setBusy(false); }
  }
  async function remove(note) {
    if (busy || !window.confirm(t('למחוק את ההערה „{{title}}”?', { title: note.title }))) return;
    setBusy(true);
    try {
      const { error: deleteError } = await deletePersonalNote(note.id);
      if (deleteError) throw deleteError;
      setNotes((current) => current.filter((item) => item.id !== note.id));
      if (editingId === note.id || draft.recovery?.value.editingId === note.id) await draft.clear();
    } catch (err) { setError({ key: 'מחיקת ההערה נכשלה: {{message}}', message: err.message }); } finally { setBusy(false); }
  }
  return <section className="card personalPage"><h2>{t('ההערות שלי')}</h2><p className="muted">{t('הערות אישיות שרק אתה יכול לראות, עם קישור לפרויקט לפי הצורך.')}</p>
    {error && <p role="alert">{t(error.key, { message: error.message })}</p>}
    <DraftNotice key={session?.user?.id} draft={draft} disabled={busy} />
    <form className="personalNoteForm" onSubmit={save}>
      <fieldset className="formDraftFields personalNoteForm" disabled={busy || !draft.ready}>
      <label>{t('כותרת')}<input required maxLength={200} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></label>
      <label>{t('הערה')}<textarea required maxLength={10000} rows={4} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} /></label>
      <label>{t('קישור לפרויקט')}<select value={form.project_id} onChange={(e) => setForm({ ...form, project_id: e.target.value })}><option value="">{t('ללא פרויקט')}</option>{form.project_id && !projects.some((project) => project.id === form.project_id) && <option value={form.project_id}>{t('פרויקט שאינו זמין כרגע')}</option>}{projects.map((project) => <option key={project.id} value={project.id}>{project.name}{project.is_archived ? ` · ${t('ארכיון')}` : ''}</option>)}</select></label>
      <div className="personalNoteActions"><button disabled={busy || !draft.ready || !form.title.trim() || !form.body.trim()}>{busy ? t('שומר...') : editingId ? t('שמירת שינויים') : t('הוספת הערה')}</button>{editingId && <button type="button" className="ghost" disabled={busy} onClick={async () => { if (window.confirm(t('לבטל את העריכה ולמחוק את הטיוטה?'))) await draft.clear(); }}>{t('ביטול עריכה')}</button>}</div>
      </fieldset>
    </form>
    <label>{t('סינון לפי פרויקט')}<select value={filter} onChange={(e) => setFilter(e.target.value)}><option value="">{t('כל ההערות')}</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label>
    {loading ? <p role="status">{t('טוען הערות...')}</p> : notes.filter((note) => !filter || note.project_id === filter).map((note) => {
      const project = projects.find((item) => item.id === note.project_id);
      return <article key={note.id} className="personalEntry"><div><b>{note.title}</b><p className="personalNoteText">{note.body}</p>{project && <Link to={`/app/projects?project=${encodeURIComponent(project.id)}`}>{project.name}</Link>}<p className="muted">{new Date(note.updated_at).toLocaleString(locale)}</p></div><div className="personalNoteActions"><button className="ghost" disabled={busy || !draft.ready} onClick={() => { if (draft.hasDraft && !window.confirm(t('להחליף את הטיוטה הנוכחית בעריכת הערה זו?'))) return; draft.setValue({ editingId: note.id, form: { title: note.title, body: note.body, project_id: note.project_id || '' } }); }}>{t('עריכה')}</button><button className="danger ghost" disabled={busy} onClick={() => void remove(note)}>{t('מחיקה')}</button></div></article>;
    })}
    {!loading && !notes.length && <p className="empty">{t('עדיין אין הערות אישיות.')}</p>}
  </section>;
}
