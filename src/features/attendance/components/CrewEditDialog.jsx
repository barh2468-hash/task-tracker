import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useProjects } from '../../projects/ProjectsContext.jsx';
import { helperNames } from '../crewOptions.js';
import { supabase } from '../../../services/supabase.js';
import { useTranslation } from 'react-i18next';
import { t, useLanguage } from '../../language/LanguageContext.jsx';
import { localeForLanguage } from '../../language/locale.js';

export default function CrewEditDialog({ session, onClose, onSaved }) {
  useTranslation();
  const { language } = useLanguage();
  const { workers } = useProjects();
  const [crew, setCrew] = useState(session.crew_members || []);
  const [note, setNote] = useState(session.end_note || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (event) => {
      if (event.key === 'Escape' && !busy) onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [busy, onClose]);
  const options = [
    ...workers.filter((worker) => worker.id !== session.worker_id).map((worker) => ({ id: worker.id, name: worker.full_name, source: 'system' })),
    ...helperNames.map((name) => ({ id: null, name, source: 'helper' })),
  ];
  const matches = (a, b) => a.source === b.source && (a.id ? a.id === b.id : a.name === b.name);
  // Retain people in old reports even if they have left the employee directory.
  for (const member of session.crew_members || []) if (!options.some((option) => matches(option, member))) options.push(member);
  async function save(event) {
    event.preventDefault();
    if (busy) return;
    setError('');
    setBusy(true);
    try {
      const result = await supabase.rpc('update_my_work_session_details', {
        p_session_id: session.id,
        p_crew_members: crew,
        p_end_note: note,
      });
      if (result.error) throw result.error;
      await onSaved();
      onClose();
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  return createPortal(<div className="modalBackdrop attendanceEndBackdrop crewEditBackdrop" role="dialog" aria-modal="true" aria-labelledby="crew-edit-title">
    <form className="attendanceEndModal crewEditModal" onSubmit={save}>
      <div className="attendanceEndHeader"><h2 id="crew-edit-title">{t('עדכון הצוות והערות לעבודה')}</h2></div>
      <div className="attendanceEndBody">
        <p>{session.projects?.name} · {new Date(session.started_at).toLocaleDateString(localeForLanguage(language), { timeZone: 'Asia/Jerusalem' })}</p>
        <p className="muted">{t('אפשר לעדכן את הצוות ולהוסיף או לערוך הערות לעבודה. שעות העבודה וסגירת היום נשמרות.')}</p>
        <label className="crewEditNote" htmlFor="crew-edit-note">
          <span>{t('הערות לעבודה (לא חובה)')}</span>
          <textarea id="crew-edit-note" rows={4} value={note} disabled={busy}
            aria-describedby="crew-edit-note-help"
            placeholder={t('אפשר להוסיף פרטים על העבודה שבוצעה או מידע נוסף למנהל')}
            onChange={(event) => setNote(event.target.value)} />
        </label>
        <small id="crew-edit-note-help">{t('ההערה נשמרת עם רישום העבודה ומופיעה בדוחות ובהיסטוריית הפרויקט.')}</small>
        <fieldset className="crewPicker" disabled={busy}><legend>{t('עובדים ועוזרים')}</legend><div className="crewOptions">
          {options.map((member) => <label className="crewOption" key={member.id || member.name}><input type="checkbox" checked={crew.some((item) => matches(item, member))} onChange={() => setCrew((current) => current.some((item) => matches(item, member)) ? current.filter((item) => !matches(item, member)) : [...current, member])} /><span>{member.name}</span></label>)}
        </div></fieldset>
        {error && <p role="alert">{t('שמירת הצוות וההערות נכשלה: {{message}}', { message: error })}</p>}
      </div>
      <div className="attendanceEndActions"><button type="button" className="ghost" disabled={busy} onClick={onClose}>{t('ביטול')}</button><button disabled={busy}>{busy ? t('שומר...') : t('שמירת הצוות וההערות')}</button></div>
    </form>
  </div>, document.body);
}
