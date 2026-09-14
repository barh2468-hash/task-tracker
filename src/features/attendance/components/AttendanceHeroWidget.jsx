import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock3, Play, Square } from 'lucide-react';
import { t } from '../../language/LanguageContext.jsx';
import { useAuth } from '../../auth/useAuth.js';
import { useAttendance } from '../AttendanceContext.jsx';
import { attendanceTypeLabel } from '../api.js';

function formatTimer(milliseconds) {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map((value) => String(value).padStart(2, '0')).join(':');
}

export default function AttendanceHeroWidget() {
  const navigate = useNavigate();
  const { isDrafter } = useAuth();
  const {
    myAttendanceSessions: sessions,
    attendanceAvailable: available,
    attendanceBusy: busy,
    openAttendanceEndDialog,
  } = useAttendance();
  const [now, setNow] = useState(() => new Date());
  const openSession = sessions.find((item) => !item.ended_at && !item.is_all_day) || null;

  useEffect(() => {
    if (!openSession) return undefined;
    const interval = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(interval);
  }, [openSession]);

  if (isDrafter) return null;

  const elapsed = openSession
    ? formatTimer(now.getTime() - new Date(openSession.started_at).getTime())
    : '--:--:--';
  const typeLabel = openSession
    ? t(attendanceTypeLabel[openSession.attendance_type] || 'עבודה בשטח')
    : t('כניסה מהירה לעמוד הנוכחות');

  function runAction() {
    if (openSession) openAttendanceEndDialog();
    else navigate('/app/attendance');
  }

  return (
    <section className={`attendanceHeroWidget ${openSession ? 'isRunning' : ''}`}>
      <header>
        <span>
          <Clock3 size={17} />
          <b>{t('שעון נוכחות')}</b>
        </span>
        <small>
          <i aria-hidden="true" />
          {openSession ? t('יום העבודה פעיל') : t('טרם התחיל')}
        </small>
      </header>
      <div className="attendanceHeroWidgetTime">
        <strong>{elapsed}</strong>
        <span>{typeLabel}</span>
      </div>
      <button type="button" disabled={busy || !available} onClick={runAction}>
        {openSession ? <Square size={15} /> : <Play size={16} fill="currentColor" />}
        {openSession ? t('סיום יום העבודה') : t('לשעון הנוכחות')}
      </button>
    </section>
  );
}
