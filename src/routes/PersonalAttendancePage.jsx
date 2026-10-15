import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../features/auth/useAuth.js';
import { useAttendance } from '../features/attendance/AttendanceContext.jsx';
import { attendanceTypeLabel } from '../features/attendance/constants.js';
import { currentMonthRange, personalAttendanceRows, reportDate } from '../features/attendance/utils/personalReport.js';
import CrewEditDialog from '../features/attendance/components/CrewEditDialog.jsx';
import { getPersonalAttendanceRange } from '../services/api/personalAttendance.js';
import { Download } from 'lucide-react';
import { useMessage } from '../context/MessageContext.jsx';
import '../features/attendance/personal.css';
import { useTranslation } from 'react-i18next';
import { t, useLanguage } from '../features/language/LanguageContext.jsx';
import { localeForLanguage } from '../features/language/locale.js';

export default function PersonalAttendancePage() {
  useTranslation();
  const { language } = useLanguage();
  const locale = localeForLanguage(language);
  const { session, profile } = useAuth();
  const { setMessage } = useMessage();
  const { myAttendanceSessions, workSessions, loadWorkSessions, attendanceAvailable } = useAttendance();
  const [range, setRange] = useState(currentMonthRange);
  const [editing, setEditing] = useState(null);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const requestVersion = useRef(0);
  const userId = session?.user?.id;
  const reload = useCallback(async () => {
    const version = ++requestVersion.current;
    if (!userId || !range.from || !range.to || range.from > range.to) { setData(null); setLoading(false); return; }
    if (!navigator.onLine) { setError({ key: 'מצב אופליין: מוצגים הרישומים השמורים במכשיר. הדוח המלא זמין עם חיבור לאינטרנט.' }); setData(null); setLoading(false); return; }
    setLoading(true); setError(''); setData(null);
    try { const loaded = await getPersonalAttendanceRange(userId, range.from, range.to); if (version === requestVersion.current) setData(loaded); }
    catch (err) { if (version === requestVersion.current) { setError({ key: 'טעינת הדוח המלא נכשלה: {{message}}', message: err.message }); setData(null); } }
    finally { if (version === requestVersion.current) setLoading(false); }
  }, [userId, range.from, range.to]);
  useEffect(() => {
    const versionRef = requestVersion;
    void reload(); setEditing(null);
    return () => { versionRef.current++; };
  }, [reload]);
  const rows = personalAttendanceRows(data?.attendance || myAttendanceSessions, userId, range.from, range.to);
  const work = (data?.work || workSessions).filter((item) => item.worker_id === userId && item.ended_at && reportDate(item.started_at) >= range.from && reportDate(item.started_at) <= range.to)
    .sort((a, b) => new Date(a.started_at) - new Date(b.started_at));
  const time = (value) => value ? new Date(value).toLocaleTimeString(locale, { timeZone: 'Asia/Jerusalem', hour: '2-digit', minute: '2-digit' }) : t('פתוח');
  const duration = (minutes) => {
    const hours = Math.floor(minutes / 60), remaining = minutes % 60;
    return hours ? t('{{hours}} ש׳ {{minutes}} דק׳', { hours, minutes: remaining }) : t('{{minutes}} דק׳', { minutes: remaining });
  };
  async function exportExcel() {
    if (exporting || !userId || !range.from || !range.to || range.from > range.to) return;
    if (!navigator.onLine) { setMessage(t('לייצוא הדוח המלא יש להתחבר לאינטרנט.'), 'error'); return; }
    const selectedRange = { ...range };
    setExporting(true);
    try {
      const fullData = await getPersonalAttendanceRange(userId, selectedRange.from, selectedRange.to);
      const { downloadPersonalAttendanceWorkbook } = await import('../features/attendance/utils/exportPersonalAttendance.js');
      await downloadPersonalAttendanceWorkbook({ attendance: fullData.attendance, work: fullData.work, userId, workerName: profile?.full_name, language, ...selectedRange });
      setMessage(t('דוח הנוכחות יוצא ל־Excel בהצלחה.'));
    } catch (err) { setMessage(t('ייצוא הדוח נכשל: {{message}}', { message: err.message }), 'error'); }
    finally { setExporting(false); }
  }
  return <section className="card personalPage">
    <h2>{t('דוח הנוכחות שלי')}</h2><p className="muted">{t('נוכחות ושעות עבודה לפי הטווח שבחרת. ברירת המחדל היא החודש הנוכחי.')}</p>
    <div className="personalFilters"><label>{t('מתאריך')}<input type="date" value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} /></label><label>{t('עד תאריך')}<input type="date" value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} /></label><button type="button" className="ghost" onClick={() => setRange(currentMonthRange())}>{t('החודש הנוכחי')}</button></div>
    {range.from > range.to && <p role="alert">{t('תאריך הסיום צריך להיות אחרי תאריך ההתחלה.')}</p>}
    <div className="personalReportActions">
      <button type="button" className="ghost" disabled={loading} onClick={() => void reload()}>{loading ? t('טוען דוח...') : t('רענון הדוח')}</button>
      <button type="button" disabled={loading || exporting || !userId || !range.from || !range.to || range.from > range.to} onClick={() => void exportExcel()}><Download size={17} aria-hidden="true" /> {exporting ? t('מכין קובץ Excel...') : t('ייצוא ל־Excel')}</button>
    </div>
    {error && <p role="alert">{t(error.key, { message: error.message })}</p>}
    {!attendanceAvailable && <p role="alert">{t('לא ניתן לטעון את נתוני הנוכחות כרגע.')}</p>}
    <div className="personalSummary"><b>{t('סך שעות:')} {duration(rows.reduce((sum, row) => sum + row.minutes, 0))}</b><span>{t('{{count}} ימי דיווח', { count: new Set(rows.map((row) => row.date)).size })}</span></div>
    <div className="tableWrap"><table><thead><tr><th>{t('תאריך')}</th><th>{t('סוג')}</th><th>{t('התחלה')}</th><th>{t('סיום')}</th><th>{t('משך')}</th><th>{t('הערה')}</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id}><td>{new Date(`${row.date}T12:00:00Z`).toLocaleDateString(locale, { timeZone: 'Asia/Jerusalem' })}</td><td>{t(attendanceTypeLabel[row.attendance_type] || row.attendance_type)}</td><td>{row.is_all_day ? t('יום מלא') : time(row.started_at)}</td><td>{row.is_all_day ? '—' : time(row.ended_at)}</td><td>{row.is_all_day ? '—' : duration(row.minutes)}</td><td>{row.end_note || '—'}</td></tr>)}</tbody></table></div>
    {!rows.length && <p className="empty">{t('אין דיווחי נוכחות בטווח שנבחר.')}</p>}
    <h3>{t('עבודה בפרויקטים ועדכון הצוות לאחר סגירה')}</h3>
    {work.map((item) => <article className="personalEntry" key={item.id}><div><b>{item.projects?.name || t('פרויקט')}</b><p>{new Date(item.started_at).toLocaleDateString(locale, { timeZone: 'Asia/Jerusalem' })} · {time(item.started_at)}–{time(item.ended_at)}</p><small>{t('צוות:')} {(item.crew_members || []).map((member) => member.name).join(', ') || t('לא צוין')}</small></div><button type="button" className="ghost" disabled={item.pending_sync} onClick={() => setEditing(item)}>{t('עריכת הצוות')}</button></article>)}
    {!work.length && <p className="empty">{t('אין רישומי עבודה סגורים בטווח שנבחר.')}</p>}
    {editing && <CrewEditDialog session={editing} onClose={() => setEditing(null)} onSaved={() => Promise.all([loadWorkSessions(), reload()])} />}
  </section>;
}
