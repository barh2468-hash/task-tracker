import { useTranslation } from 'react-i18next';
import { t } from '../../language/LanguageContext.jsx';
import { AlertTriangle, Clock, PlayCircle, Users } from 'lucide-react';
import { useAttendance } from '../AttendanceContext.jsx';
import { useProjects } from '../../projects/ProjectsContext.jsx';
import { attendanceTypeLabel } from '../api.js';
import { dailyManagerSummary } from '../../../services/api/edgeFunctions.js';
import { formatDuration, durationMinutes } from '../../../utils/format.js';
import { getTodayAttendance } from '../utils/todayAttendance.js';
import Stat from '../../../components/Stat.jsx';

export default function TodayFieldPanel() {
  useTranslation();
  const { workSessions, attendanceSessions, attendanceAvailable } = useAttendance();
  const { workers } = useProjects();

  const { todaySessions, todayAttendance, activeSessions, presentSessions, notStarted } =
    getTodayAttendance({ workSessions, attendanceSessions, workers });

  async function sendDailySummaryNow() {
    const { error } = await dailyManagerSummary({
      appUrl: typeof window !== 'undefined' ? window.location.origin : '',
    });
    alert(
      error
        ? t('שליחת הסיכום נכשלה: {{value0}}', { value0: error.message })
        : t('סיכום יומי נשלח למנהלים'),
    );
  }

  return (
    <section className="card">
      <div className="panelHeader">
        <div>
          <h2>{t('היום בשטח')}</h2>
          <p className="muted">{t('מעקב נוכחות כללי לצד שעות העבודה שנרשמו לכל פרויקט.')}</p>
        </div>
        <button className="ghost smallBtn" onClick={sendDailySummaryNow}>
          {t('שלח סיכום יומי עכשיו')}
        </button>
      </div>
      <div className="grid miniStats">
        <Stat
          number={todayAttendance.length + todaySessions.length}
          label={t('דיווחי נוכחות היום')}
          icon={<Clock />}
        />
        <Stat number={activeSessions.length} label={t('משמרות פתוחות')} icon={<PlayCircle />} />
        <Stat number={presentSessions.length} label={t('נוכחים עכשיו')} icon={<Users />} />
        <Stat number={notStarted.length} label={t('עובדים שלא התחילו')} icon={<AlertTriangle />} />
      </div>
      {!attendanceAvailable && (
        <p className="attendanceSetupNotice">
          {t('שעון הנוכחות הכללי עדיין לא הופעל ב-Supabase. יש להריץ את migration הנוכחות.')}
        </p>
      )}
      <div className="twoColumns">
        <div className="innerPanel">
          <h3>{t('נוכחים עכשיו')}</h3>
          {presentSessions.length === 0 && <p className="muted">{t('אין עובדים נוכחים כרגע.')}</p>}
          {presentSessions.map((session) => (
            <div className="listRow" key={session.worker_id}>
              <b>
                {session.profiles?.full_name ||
                  workers.find((worker) => worker.id === session.worker_id)?.full_name ||
                  t('עובד')}
              </b>
              <span>
                {session.project_id
                  ? session.projects?.name || t('פרויקט')
                  : t(attendanceTypeLabel[session.attendance_type] || 'נוכחות כללית')}{' '}
                · {t(formatDuration(durationMinutes(session.started_at)))}
              </span>
              <small>
                {t('כניסה:')}
                {new Date(session.started_at).toLocaleString('he-IL')}
              </small>
            </div>
          ))}
        </div>
        <div className="innerPanel">
          <h3>{t('טרם התחילו היום')}</h3>
          {notStarted.length === 0 && (
            <p className="muted">{t('כל העובדים התחילו או שאין עובדים להצגה.')}</p>
          )}
          {notStarted.map((worker) => (
            <div className="listRow" key={worker.id}>
              <b>{worker.full_name}</b>
              <span>{worker.email}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="innerPanel" style={{ marginTop: 16 }}>
        <h3>{t('משמרות כלליות היום')}</h3>
        {todayAttendance.length === 0 && (
          <p className="muted">{t('אין רישומי נוכחות כללית להיום.')}</p>
        )}
        {todayAttendance.map((session) => (
          <div className="listRow" key={session.id}>
            <b>{session.profiles?.full_name || t('עובד')}</b>
            <span>{t(attendanceTypeLabel[session.attendance_type])}</span>
            {session.is_all_day ? (
              <small>{t('דיווח יומי ללא שעות')}</small>
            ) : (
              <small>
                {t(formatDuration(durationMinutes(session.started_at, session.ended_at)))}
                {t('· כניסה:')}
                {new Date(session.started_at).toLocaleTimeString('he-IL')} ·{' '}
                {session.ended_at
                  ? t('יציאה: {{value0}}', {
                      value0: new Date(session.ended_at).toLocaleTimeString('he-IL'),
                    })
                  : t('פתוח')}
                {session.end_note ? t(' · הערה: {{value0}}', { value0: session.end_note }) : ''}
              </small>
            )}
          </div>
        ))}
      </div>
      <div className="innerPanel" style={{ marginTop: 16 }}>
        <h3>{t('פעולות לפי פרויקט היום')}</h3>
        {todaySessions.length === 0 && <p className="muted">{t('אין רישומי עבודה להיום.')}</p>}
        {todaySessions.map((session) => (
          <div className="listRow" key={session.id}>
            <b>{session.profiles?.full_name || t('עובד')}</b>
            <span>
              {session.projects?.name || t('פרויקט')} · {session.projects?.location || ''}
            </span>
            <small>
              {t('התחלה:')}
              {new Date(session.started_at).toLocaleTimeString('he-IL')} ·{' '}
              {session.ended_at
                ? t('סיום: {{value0}}', {
                    value0: new Date(session.ended_at).toLocaleTimeString('he-IL'),
                  })
                : t('פתוח')}
              {session.end_note ? t(' · הערה: {{value0}}', { value0: session.end_note }) : ''}
              {session.crew_members?.length
                ? t(' · צוות: {{value0}}', {
                    value0: session.crew_members.map((member) => member.name).join(', '),
                  })
                : ''}
            </small>
          </div>
        ))}
      </div>
    </section>
  );
}
