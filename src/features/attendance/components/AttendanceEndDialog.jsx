import { useTranslation } from 'react-i18next';
import { t } from '../../language/LanguageContext.jsx';
import { createPortal } from 'react-dom';
import { Clock, MapPin, Square, X } from 'lucide-react';
import { useAttendance } from '../AttendanceContext.jsx';
import { attendanceTypeLabel } from '../api.js';

export default function AttendanceEndDialog() {
  useTranslation();
  const {
    myAttendanceSessions: sessions,
    attendanceEndDialogOpen,
    attendanceEndNote: note,
    setAttendanceEndNote: setNote,
    attendanceBusy: busy,
    setAttendanceEndDialogOpen,
    finishAttendance,
  } = useAttendance();

  const openSession = sessions.find((item) => !item.ended_at && !item.is_all_day) || null;

  if (!attendanceEndDialogOpen || typeof document === 'undefined' || !openSession) return null;

  function close() {
    setAttendanceEndDialogOpen(false);
  }

  function confirm() {
    void finishAttendance(note);
  }

  return createPortal(
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions -- backdrop click-to-close is a mouse convenience; the close button covers keyboard access
    <div
      className="modalBackdrop attendanceEndBackdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="attendance-end-title"
      onClick={() => !busy && close()}
    >
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions -- stops the backdrop's close handler from firing for clicks inside the modal */}
      <form
        className="attendanceEndModal"
        onClick={(event) => event.stopPropagation()}
        onSubmit={(event) => {
          event.preventDefault();
          confirm();
        }}
      >
        <div className="attendanceEndHeader">
          <div className="attendanceEndHeaderIcon">
            <Clock size={23} />
          </div>
          <div>
            <span>{t('סיום משמרת')}</span>
            <h2 id="attendance-end-title">
              {t('סיום')}
              {t(attendanceTypeLabel[openSession.attendance_type])}
            </h2>
            <p>
              {t('התחלת ב־')}
              {new Date(openSession.started_at).toLocaleTimeString('he-IL', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
          </div>
          <button
            type="button"
            className="iconOnly"
            aria-label={t('סגירה')}
            disabled={busy}
            onClick={close}
          >
            <X size={18} />
          </button>
        </div>
        <div className="attendanceEndBody">
          <label>
            {t('הערת סיום')}
            <small>{t('אופציונלי')}</small>
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder={t('למשל: נסיעה למשרד, ציוד שהוחזר או מידע חשוב למנהל')}
              // eslint-disable-next-line jsx-a11y/no-autofocus -- opening the dialog should focus the note field immediately, matching the original behavior
              autoFocus
            />
          </label>
          <p>
            <MapPin size={16} />
            {t('בעת האישור נבקש את מיקום הסיום ונשמור אותו בדיווח.')}
          </p>
        </div>
        <div className="attendanceEndActions">
          <button type="button" className="ghost" disabled={busy} onClick={close}>
            {t('חזרה')}
          </button>
          <button type="submit" className="danger" disabled={busy}>
            <Square size={17} /> {busy ? t('שומר מיקום ומסיים...') : t('אישור וסיום משמרת')}
          </button>
        </div>
      </form>
    </div>,
    document.body,
  );
}
