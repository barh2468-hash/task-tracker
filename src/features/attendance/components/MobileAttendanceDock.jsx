import { useEffect, useState } from 'react';
import { Clock, PlayCircle, Square } from 'lucide-react';
import { useAttendance } from '../AttendanceContext.jsx';
import { attendanceTypeLabel } from '../api.js';
import { formatDuration } from '../../../utils/format.js';

export default function MobileAttendanceDock() {
  const {
    myAttendanceSessions: sessions,
    attendanceAvailable: available,
    attendanceBusy: busy,
    openAttendanceEndDialog,
  } = useAttendance();

  const openSession = sessions.find(
    (item) => !item.ended_at && !item.is_all_day,
  ) || null;
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!openSession) return;
    const interval = window.setInterval(() => setNow(Date.now()), 30000);
    return () => window.clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openSession?.id]);

  const minutes = openSession
    ? Math.max(0, Math.round((now - new Date(openSession.started_at).getTime()) / 60000))
    : 0;

  function openClock() {
    document.getElementById('general-attendance')?.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
    });
  }

  return (
    <aside className={`mobileAttendanceDock ${openSession ? 'active' : ''}`} aria-label="קיצור דרך לשעון נוכחות">
      <div className="mobileAttendanceDockIcon"><Clock size={19} /></div>
      <div className="mobileAttendanceDockCopy">
        <b>{openSession ? attendanceTypeLabel[openSession.attendance_type] : 'שעון נוכחות'}</b>
        <span>{openSession ? formatDuration(minutes) : available ? 'לא התחלת משמרת' : 'השעון לא זמין'}</span>
      </div>
      <button
        className={openSession ? 'danger' : ''}
        disabled={busy || !available}
        onClick={openSession ? openAttendanceEndDialog : openClock}
      >
        {openSession ? <Square size={16} /> : <PlayCircle size={16} />}
        {busy ? 'מעדכן...' : openSession ? 'סיום' : 'פתיחה'}
      </button>
    </aside>
  );
}
