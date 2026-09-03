import { useTranslation } from 'react-i18next';
import { t } from '../../language/LanguageContext.jsx';
import { useEffect, useState } from 'react';
import { Clock, PlayCircle, Square } from 'lucide-react';
import { useAttendance } from '../AttendanceContext.jsx';
import { attendanceTypeOptions, attendanceTypeLabel } from '../api.js';
import { formatDuration, durationMinutes, toLocalDateKey } from '../../../utils/format.js';
import LocationLine from '../../../components/LocationLine.jsx';

export default function GeneralAttendanceCard() {
  useTranslation();
  const {
    myAttendanceSessions: sessions,
    attendanceAvailable: available,
    attendanceBusy: busy,
    startAttendance,
    openAttendanceEndDialog,
  } = useAttendance();

  const openSession = sessions.find((item) => !item.ended_at && !item.is_all_day) || null;
  const lastEndedSession = sessions.find((item) => item.ended_at && !item.is_all_day) || null;
  const [now, setNow] = useState(() => Date.now());
  const [selectedType, setSelectedType] = useState('field');

  useEffect(() => {
    if (!openSession) return;
    const interval = window.setInterval(() => setNow(Date.now()), 30000);
    return () => window.clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openSession?.id]);

  const today = toLocalDateKey();
  const dayStatus =
    sessions.find((item) => item.is_all_day && item.attendance_date === today) || null;
  const todaySessions = sessions.filter(
    (item) =>
      !item.is_all_day &&
      (item.attendance_date || toLocalDateKey(new Date(item.started_at))) === today,
  );
  const todayMinutes = todaySessions.reduce(
    (sum, item) =>
      sum +
      (item.ended_at
        ? durationMinutes(item.started_at, item.ended_at)
        : Math.max(0, Math.round((now - new Date(item.started_at).getTime()) / 60000))),
    0,
  );
  const openMinutes = openSession
    ? Math.max(0, Math.round((now - new Date(openSession.started_at).getTime()) / 60000))
    : 0;
  const selectedOption =
    attendanceTypeOptions.find((item) => item.value === selectedType) || attendanceTypeOptions[0];

  useEffect(() => {
    if (openSession?.attendance_type) setSelectedType(openSession.attendance_type);
    else if (dayStatus?.attendance_type) setSelectedType(dayStatus.attendance_type);
  }, [openSession?.attendance_type, dayStatus?.attendance_type]);

  return (
    <section id="general-attendance" className={`generalAttendance ${openSession ? 'active' : ''}`}>
      <div className="generalAttendanceIcon" aria-hidden="true">
        <Clock size={25} />
      </div>
      <div className="generalAttendanceCopy">
        <div className="generalAttendanceTitle">
          <span className="generalAttendanceStatus">
            {openSession
              ? t('{{value0}} פעיל', {
                  value0: t(attendanceTypeLabel[openSession.attendance_type]),
                })
              : dayStatus
                ? t('דווח: {{value0}}', {
                    value0: t(attendanceTypeLabel[dayStatus.attendance_type]),
                  })
                : t('לא במשמרת')}
          </span>
          <h3>{t('שעון נוכחות כללי')}</h3>
        </div>
        {openSession ? (
          <>
            <strong className="generalAttendanceTime">{t(formatDuration(openMinutes))}</strong>
            <span>
              {t('התחלה:')}
              {new Date(openSession.started_at).toLocaleString('he-IL')}
            </span>
            <LocationLine
              label={t('מיקום כניסה')}
              lat={openSession.started_lat}
              lng={openSession.started_lng}
              accuracy={openSession.started_accuracy}
            />
          </>
        ) : (
          <span>
            {dayStatus
              ? t('הדיווח {{value0}} נשמר להיום וניתן לעדכן אותו.', {
                  value0: t(attendanceTypeLabel[dayStatus.attendance_type]),
                })
              : lastEndedSession
                ? t('המשמרת האחרונה הסתיימה ב-{{value0}}', {
                    value0: new Date(lastEndedSession.ended_at || '').toLocaleString('he-IL'),
                  })
                : t('התחל את יום העבודה לפני המעבר בין הפרויקטים.')}
          </span>
        )}
        <small>
          {t('סה״כ נוכחות היום:')} {t(formatDuration(todayMinutes))}
        </small>
        {!available && (
          <small className="generalAttendanceWarning">
            {t('נדרש להפעיל את טבלת הנוכחות ב-Supabase לפני השימוש.')}
          </small>
        )}
      </div>
      <div className="generalAttendanceActions">
        <label>
          {t('סוג דיווח')}

          <select
            value={selectedType}
            disabled={busy || Boolean(openSession)}
            onChange={(event) => setSelectedType(event.target.value)}
          >
            {attendanceTypeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {t(option.label)}
              </option>
            ))}
          </select>
        </label>
        <button
          className={openSession ? 'danger' : ''}
          disabled={busy || !available}
          onClick={openSession ? openAttendanceEndDialog : () => startAttendance(selectedType)}
        >
          {openSession ? <Square size={18} /> : <PlayCircle size={18} />}
          {busy
            ? t('מעדכן...')
            : openSession
              ? t('סיום {{value0}}', {
                  value0: t(attendanceTypeLabel[openSession.attendance_type]),
                })
              : selectedOption.timed
                ? t('תחילת {{value0}}', { value0: t(selectedOption.label) })
                : `${dayStatus ? t('עדכון') : t('דיווח')} ${t(selectedOption.label)}`}
        </button>
      </div>
    </section>
  );
}
