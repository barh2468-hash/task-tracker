import { useMemo, useState } from 'react';
import { Download, Eye, Mail, Pencil, RefreshCw, Search, Trash2 } from 'lucide-react';
import { t } from '../language/LanguageContext.jsx';
import { filterSavedLayouts } from './savedLayouts.js';

export default function SavedLayoutsPanel({ rows, loading, error, busy, editableProjectIds, userId, isManager, onRefresh, onEdit, onView, onDownload, onEmail, onDelete }) {
  const [projectId, setProjectId] = useState('');
  const [workerId, setWorkerId] = useState('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState([]);
  const filtered = useMemo(() => filterSavedLayouts(rows, { projectId, workerId, search }), [rows, projectId, workerId, search]);
  const projects = [...new Map(rows.map(row => [row.project_id, row.project_name])).entries()];
  const workers = [...new Map(rows.map(row => [row.created_by, row.created_by_name])).entries()];
  const selectedRows = rows.filter(row => selected.includes(row.id));
  function toggle(id) {
    setSelected(current => {
      const visible = current.filter(value => rows.some(row => row.id === value));
      return visible.includes(id) ? visible.filter(value => value !== id) : visible.length < 5 ? [...visible, id] : visible;
    });
  }
  return (
    <section className="manholeSavedPanel" aria-label={t('פרישות שמורות')}>
      <div className="manholeSavedHeading">
        <div><h3>{t('פרישות שמורות')} <span>{rows.length}</span></h3><p>{t('הפרישות נשמרות בפרויקט וזמינות גם ממכשיר אחר. עריכה נשמרת כגרסה נוספת.')}</p></div>
        <button type="button" onClick={onRefresh} disabled={loading}><RefreshCw size={16} aria-hidden="true" />{t('רענון')}</button>
      </div>
      <div className="manholeSavedFilters">
        <label>{t('פרויקט')}<select aria-label={t('פרויקט')} value={projectId} onChange={event => setProjectId(event.target.value)}><option value="">{t('כל הפרויקטים')}</option>{projects.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>
        <label>{t('עובד')}<select aria-label={t('עובד')} value={workerId} onChange={event => setWorkerId(event.target.value)}><option value="">{t('כל העובדים')}</option>{workers.map(([id, name]) => <option key={id} value={id}>{name || t('עובד')}</option>)}</select></label>
        <label>{t('חיפוש')}<div className="manholeSavedSearch"><Search size={17} aria-hidden="true" /><input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder={t('מספר שוחה, פרויקט או תשתית')} /></div></label>
      </div>
      <div className="manholeSavedSelection">
        <span>{selectedRows.length ? `${t('נבחרו')}: ${selectedRows.length}` : t('אפשר לבחור עד 5 פרישות לשליחה יחד במייל.')}</span>
        {selectedRows.length > 0 && <button type="button" className="manholeSecondaryButton" onClick={() => setSelected([])}>{t('נקה בחירה')}</button>}
        <button type="button" className="manholePrimaryButton" disabled={!selectedRows.length || busy} onClick={() => onEmail(selectedRows)}><Mail size={17} aria-hidden="true" />{t('שליחת פרישות במייל')}</button>
      </div>
      {error && <p className="manholeSavedError" role="alert">{error}</p>}
      {loading && !rows.length && <p role="status">{t('טוען פרישות שמורות...')}</p>}
      {!loading && !error && !filtered.length && <div className="manholeSavedEmpty"><h4>{t(rows.length ? 'לא נמצאו פרישות לפי הסינון.' : 'עדיין אין פרישות שמורות.')}</h4><p>{t('מלאו פרישה ולחצו על ״שמור פרישה״. היא תופיע כאן עם ה־PDF והתמונות.')}</p></div>}
      <div className="manholeSavedList">
        {filtered.map(row => <article key={row.id} className="manholeSavedCard">
          <div className="manholeSavedCardHeading">
            <input type="checkbox" aria-label={`${t('בחירת פרישה')} ${row.manhole_number} · ${row.project_name}`} checked={selected.includes(row.id)} disabled={!selected.includes(row.id) && selectedRows.length >= 5} onChange={() => toggle(row.id)} />
            <div><h4>{t('שוחה')} {row.manhole_number} <span>{row.infrastructure}</span></h4><p>{row.project_name}</p></div>
            {row.revision_of && <span className="manholeRevisionBadge">{t('גרסה מעודכנת')}</span>}
          </div>
          <div className="manholeSavedMeta"><span>{row.created_by_name || t('עובד')}</span><span>{t('תאריך ביצוע')}: {new Date(`${row.work_date}T12:00:00`).toLocaleDateString('he-IL')}</span><span>{t('נשמרה')}: {new Date(row.created_at).toLocaleString('he-IL', { dateStyle: 'short', timeStyle: 'short' })}</span></div>
          <div className="manholeSavedCardActions">
            <button type="button" disabled={busy} onClick={() => onView(row)}><Eye size={16} aria-hidden="true" />{t('צפייה')}</button>
            <button type="button" disabled={busy || !editableProjectIds.includes(row.project_id)} onClick={() => onEdit(row)}><Pencil size={16} aria-hidden="true" />{t('עריכה')}</button>
            <button type="button" disabled={busy} onClick={() => onDownload(row)}><Download size={16} aria-hidden="true" />PDF</button>
            <button type="button" disabled={busy} onClick={() => onEmail([row])}><Mail size={16} aria-hidden="true" />{t('מייל')}</button>
            <button type="button" className="manholeDeleteButton" disabled={busy || !(isManager || row.created_by === userId)} aria-describedby={!(isManager || row.created_by === userId) ? `manhole-delete-hint-${row.id}` : undefined} onClick={() => onDelete(row)}><Trash2 size={16} aria-hidden="true" />{t('מחיקה')}</button>
          </div>
          {!(isManager || row.created_by === userId) && <small id={`manhole-delete-hint-${row.id}`} className="manholeDeleteHint">{t('מחיקה זמינה ליוצר הפרישה ולמנהלים בלבד.')}</small>}
        </article>)}
      </div>
    </section>
  );
}
