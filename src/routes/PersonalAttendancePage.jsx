import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../features/auth/useAuth.js';
import { useAttendance } from '../features/attendance/AttendanceContext.jsx';
import { attendanceTypeLabel } from '../features/attendance/constants.js';
import { formatDuration } from '../utils/format.js';
import { currentMonthRange, personalAttendanceRows, reportDate } from '../features/attendance/utils/personalReport.js';
import CrewEditDialog from '../features/attendance/components/CrewEditDialog.jsx';
import { getPersonalAttendanceRange } from '../services/api/personalAttendance.js';
import { Download } from 'lucide-react';
import { useMessage } from '../context/MessageContext.jsx';
import '../features/attendance/personal.css';

export default function PersonalAttendancePage() {
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
    if (!navigator.onLine) { setError('מצב אופליין: מוצגים הרישומים השמורים במכשיר. הדוח המלא זמין עם חיבור לאינטרנט.'); setData(null); setLoading(false); return; }
    setLoading(true); setError(''); setData(null);
    try { const loaded = await getPersonalAttendanceRange(userId, range.from, range.to); if (version === requestVersion.current) setData(loaded); }
    catch (err) { if (version === requestVersion.current) { setError(`טעינת הדוח המלא נכשלה: ${err.message}`); setData(null); } }
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
  const time = (value) => value ? new Date(value).toLocaleTimeString('he-IL', { timeZone: 'Asia/Jerusalem', hour: '2-digit', minute: '2-digit' }) : 'פתוח';
  async function exportExcel() {
    if (exporting || !userId || !range.from || !range.to || range.from > range.to) return;
    if (!navigator.onLine) { setMessage('לייצוא הדוח המלא יש להתחבר לאינטרנט.', 'error'); return; }
    const selectedRange = { ...range };
    setExporting(true);
    try {
      const fullData = await getPersonalAttendanceRange(userId, selectedRange.from, selectedRange.to);
      const { downloadPersonalAttendanceWorkbook } = await import('../features/attendance/utils/exportPersonalAttendance.js');
      await downloadPersonalAttendanceWorkbook({ attendance: fullData.attendance, work: fullData.work, userId, workerName: profile?.full_name, ...selectedRange });
      setMessage('דוח הנוכחות יוצא ל־Excel בהצלחה.');
    } catch (err) { setMessage(`ייצוא הדוח נכשל: ${err.message}`, 'error'); }
    finally { setExporting(false); }
  }
  return <section className="card personalPage">
    <h2>דוח הנוכחות שלי</h2><p className="muted">נוכחות ושעות עבודה לפי הטווח שבחרת. ברירת המחדל היא החודש הנוכחי.</p>
    <div className="personalFilters"><label>מתאריך<input type="date" value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} /></label><label>עד תאריך<input type="date" value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} /></label><button type="button" className="ghost" onClick={() => setRange(currentMonthRange())}>החודש הנוכחי</button></div>
    {range.from > range.to && <p role="alert">תאריך הסיום צריך להיות אחרי תאריך ההתחלה.</p>}
    <div className="personalReportActions">
      <button type="button" className="ghost" disabled={loading} onClick={() => void reload()}>{loading ? 'טוען דוח...' : 'רענון הדוח'}</button>
      <button type="button" disabled={loading || exporting || !userId || !range.from || !range.to || range.from > range.to} onClick={() => void exportExcel()}><Download size={17} aria-hidden="true" /> {exporting ? 'מכין קובץ Excel...' : 'ייצוא ל־Excel'}</button>
    </div>
    {error && <p role="alert">{error}</p>}
    {!attendanceAvailable && <p role="alert">לא ניתן לטעון את נתוני הנוכחות כרגע.</p>}
    <div className="personalSummary"><b>סך שעות: {formatDuration(rows.reduce((sum, row) => sum + row.minutes, 0))}</b><span>{new Set(rows.map((row) => row.date)).size} ימי דיווח</span></div>
    <div className="tableWrap"><table><thead><tr><th>תאריך</th><th>סוג</th><th>התחלה</th><th>סיום</th><th>משך</th><th>הערה</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id}><td>{row.date.split('-').reverse().join('/')}</td><td>{attendanceTypeLabel[row.attendance_type] || row.attendance_type}</td><td>{row.is_all_day ? 'יום מלא' : time(row.started_at)}</td><td>{row.is_all_day ? '—' : time(row.ended_at)}</td><td>{row.is_all_day ? '—' : formatDuration(row.minutes)}</td><td>{row.end_note || '—'}</td></tr>)}</tbody></table></div>
    {!rows.length && <p className="empty">אין דיווחי נוכחות בטווח שנבחר.</p>}
    <h3>עבודה בפרויקטים ועדכון הצוות לאחר סגירה</h3>
    {work.map((item) => <article className="personalEntry" key={item.id}><div><b>{item.projects?.name || 'פרויקט'}</b><p>{new Date(item.started_at).toLocaleDateString('he-IL', { timeZone: 'Asia/Jerusalem' })} · {time(item.started_at)}–{time(item.ended_at)}</p><small>צוות: {(item.crew_members || []).map((member) => member.name).join(', ') || 'לא צוין'}</small></div><button type="button" className="ghost" disabled={item.pending_sync} onClick={() => setEditing(item)}>עריכת הצוות</button></article>)}
    {!work.length && <p className="empty">אין רישומי עבודה סגורים בטווח שנבחר.</p>}
    {editing && <CrewEditDialog session={editing} onClose={() => setEditing(null)} onSaved={() => Promise.all([loadWorkSessions(), reload()])} />}
  </section>;
}
