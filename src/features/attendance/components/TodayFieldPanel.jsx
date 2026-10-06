import { useTranslation } from 'react-i18next';
import { t } from '../../language/LanguageContext.jsx';
import { useState } from 'react';
import {
  AlertTriangle,
  Clock,
  FileSpreadsheet,
  LoaderCircle,
  MessageSquareText,
  PlayCircle,
  Users,
} from 'lucide-react';
import { useAttendance } from '../AttendanceContext.jsx';
import { useProjects } from '../../projects/ProjectsContext.jsx';
import { useMessage } from '../../../context/MessageContext.jsx';
import { attendanceTypeLabel } from '../api.js';
import { dailyManagerSummary } from '../../../services/api/edgeFunctions.js';
import { formatDuration, durationMinutes } from '../../../utils/format.js';
import { getTodayAttendance } from '../utils/todayAttendance.js';
import { exportDailySummaryExcel } from '../utils/exportDailySummaryExcel.js';
import Stat from '../../../components/Stat.jsx';

function ActivityMeta({ startedAt, endedAt, startLabel, endLabel, crewMembers = [] }) {
  return (
    <div className="todayActivityMeta">
      <span className="todayActivityMetric duration">
        <Clock size={14} aria-hidden="true" />
        <span>
          <em>{t('משך')}</em>
          <b>{t(formatDuration(durationMinutes(startedAt, endedAt)))}</b>
        </span>
      </span>
      <span className="todayActivityMetric">
        <PlayCircle size={14} aria-hidden="true" />
        <span>
          <em>{t(startLabel)}</em>
          <b>{new Date(startedAt).toLocaleTimeString('he-IL')}</b>
        </span>
      </span>
      <span className={`todayActivityMetric ${endedAt ? 'closed' : 'open'}`}>
        <i aria-hidden="true" />
        <span>
          <em>{t(endLabel)}</em>
          <b>{endedAt ? new Date(endedAt).toLocaleTimeString('he-IL') : t('פתוח')}</b>
        </span>
      </span>
      {crewMembers.length > 0 && (
        <span className="todayActivityMetric crew">
          <Users size={14} aria-hidden="true" />
          <span>
            <em>{t('צוות נוסף')}</em>
            <b>{crewMembers.map((member) => member.name).join(', ')}</b>
          </span>
        </span>
      )}
    </div>
  );
}

export default function TodayFieldPanel() {
  useTranslation();
  const { workSessions, attendanceSessions, attendanceAvailable } = useAttendance();
  const { workers, projects, historyItems } = useProjects();
  const { setMessage } = useMessage();
  const [exportingExcel, setExportingExcel] = useState(false);
  const [sendingSummary, setSendingSummary] = useState(false);

  const { todaySessions, todayAttendance, activeSessions, presentSessions, notStarted } =
    getTodayAttendance({ workSessions, attendanceSessions, workers });

  async function sendDailySummaryNow() {
    if (sendingSummary) return;
    setSendingSummary(true);
    try {
      const { data, error } = await dailyManagerSummary({
        appUrl: typeof window !== 'undefined' ? window.location.origin : '',
      });
      if (error) {
        setMessage(t('שליחת הסיכום נכשלה: {{value0}}', { value0: error.message }), 'error');
        return;
      }
      if (!data?.sentTo) {
        setMessage(t('לא נמצאו מנהלים עם כתובת דוא״ל לקבלת הסיכום.'), 'error');
        return;
      }
      setMessage(
        t('הסיכום הניהולי נשלח ל־{{value0}} מנהלים. נמצאו {{value1}} פריטים לטיפול.', {
          value0: data.sentTo,
          value1: data.metrics?.actionCount || 0,
        }),
      );
    } finally {
      setSendingSummary(false);
    }
  }

  async function exportDailySummaryNow() {
    if (exportingExcel) return;
    setExportingExcel(true);
    try {
      await exportDailySummaryExcel(
        {
          todaySessions,
          todayAttendance,
          notStarted,
          historyItems,
          projects,
        },
        setMessage,
      );
    } finally {
      setExportingExcel(false);
    }
  }

  return (
    <section className="card">
      <div className="panelHeader">
        <div>
          <h2>{t('היום בשטח')}</h2>
          <p className="muted">{t('מעקב נוכחות כללי לצד שעות העבודה שנרשמו לכל פרויקט.')}</p>
        </div>
        <div className="todaySummaryActions">
          <button
            className="ghost smallBtn"
            onClick={sendDailySummaryNow}
            disabled={sendingSummary}
          >
            {sendingSummary && <LoaderCircle className="spinIcon" size={17} />}
            {sendingSummary ? t('מכין סיכום ניהולי...') : t('שלח סיכום ניהולי עכשיו')}
          </button>
          <button className="smallBtn" onClick={exportDailySummaryNow} disabled={exportingExcel}>
            {exportingExcel ? (
              <LoaderCircle className="spinIcon" size={17} />
            ) : (
              <FileSpreadsheet size={17} />
            )}
            {exportingExcel ? t('מייצא ל־Excel...') : t('ייצוא סיכום יומי ל־Excel')}
          </button>
        </div>
      </div>
      <div className="grid miniStats">
        <Stat
          number={todayAttendance.length + todaySessions.length}
          label={t('דיווחי נוכחות היום')}
          icon={<Clock />}
        />
        <Stat number={activeSessions.length} label={t('משמרות פתוחות')} icon={<PlayCircle />} />
        <Stat number={presentSessions.length} label={t('נוכחים עכשיו')} icon={<Users />} />
        <Stat
          number={notStarted.length}
          label={t('עובדי שטח שלא התחילו')}
          icon={<AlertTriangle />}
        />
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
          <h3>{t('עובדי שטח שטרם התחילו היום')}</h3>
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
          <div className="listRow todayActivityRow" key={session.id}>
            <b>{session.profiles?.full_name || t('עובד')}</b>
            <span>{t(attendanceTypeLabel[session.attendance_type])}</span>
            {session.is_all_day ? (
              <div className="todayActivityMeta">
                <span className="todayActivityMetric allDay">
                  <Clock size={14} aria-hidden="true" />
                  <b>{t('דיווח יומי ללא שעות')}</b>
                </span>
              </div>
            ) : (
              <ActivityMeta
                startedAt={session.started_at}
                endedAt={session.ended_at}
                startLabel="כניסה"
                endLabel="יציאה"
              />
            )}
            {session.end_note && (
              <div className="todayActivityNote">
                <MessageSquareText size={16} aria-hidden="true" />
                <b>{t('הערה')}</b>
                <span>{session.end_note}</span>
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="innerPanel" style={{ marginTop: 16 }}>
        <h3>{t('פעולות לפי פרויקט היום')}</h3>
        {todaySessions.length === 0 && <p className="muted">{t('אין רישומי עבודה להיום.')}</p>}
        {todaySessions.map((session) => (
          <div className="listRow todayActivityRow" key={session.id}>
            <b>{session.profiles?.full_name || t('עובד')}</b>
            <span>
              {session.projects?.name || t('פרויקט')} · {session.projects?.location || ''}
            </span>
            <ActivityMeta
              startedAt={session.started_at}
              endedAt={session.ended_at}
              startLabel="התחלה"
              endLabel="סיום"
              crewMembers={session.crew_members}
            />
            {session.end_note && (
              <div className="todayActivityNote">
                <MessageSquareText size={16} aria-hidden="true" />
                <b>{t('הערה')}</b>
                <span>{session.end_note}</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
