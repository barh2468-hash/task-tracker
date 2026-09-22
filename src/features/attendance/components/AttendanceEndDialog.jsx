import { useTranslation } from 'react-i18next';
import { t } from '../../language/LanguageContext.jsx';
import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, Clock, MapPin, Square, Users } from 'lucide-react';
import { useAuth } from '../../auth/useAuth.js';
import { useProjects } from '../../projects/ProjectsContext.jsx';
import { useAttendance } from '../AttendanceContext.jsx';
import { attendanceTypeLabel } from '../api.js';
import { helperNames } from '../crewOptions.js';
import { statuses } from '../../../services/supabase.js';

const DRAFTING_STATUS = 'עבר לשרטוט';

export default function AttendanceEndDialog() {
  useTranslation();
  const { session } = useAuth();
  const { workers, projects, updateStatus } = useProjects();
  const {
    myAttendanceSessions: sessions,
    workSessions,
    attendanceEndDialogOpen,
    attendanceEndNote: note,
    setAttendanceEndNote: setNote,
    attendanceBusy: busy,
    setAttendanceEndDialogOpen,
    finishAttendance,
  } = useAttendance();
  const [selectedWorkerIds, setSelectedWorkerIds] = useState([]);
  const [selectedHelpers, setSelectedHelpers] = useState([]);
  const [markReadyForDrafting, setMarkReadyForDrafting] = useState(false);

  const openSession = sessions.find((item) => !item.ended_at && !item.is_all_day) || null;
  const linkedWorkSession = openSession
    ? workSessions.find(
        (item) =>
          item.worker_id === session?.user?.id &&
          !item.ended_at &&
          Math.abs(
            new Date(item.started_at).getTime() - new Date(openSession.started_at).getTime(),
          ) < 5000,
      )
    : null;
  const linkedProject = linkedWorkSession
    ? projects.find((item) => item.id === linkedWorkSession.project_id) || null
    : null;
  const canMarkReadyForDrafting = Boolean(
    linkedProject && statuses.indexOf(linkedProject.status) < statuses.indexOf(DRAFTING_STATUS),
  );
  const availableWorkers = useMemo(
    () =>
      workers
        .filter((worker) => worker.id !== session?.user?.id)
        .sort((left, right) => left.full_name.localeCompare(right.full_name, 'he')),
    [workers, session?.user?.id],
  );

  useEffect(() => {
    setSelectedWorkerIds([]);
    setSelectedHelpers([]);
    setMarkReadyForDrafting(false);
  }, [attendanceEndDialogOpen, openSession?.id]);

  if (!attendanceEndDialogOpen || typeof document === 'undefined' || !openSession) return null;

  function toggleValue(value, setter) {
    setter((current) =>
      current.includes(value) ? current.filter((item) => item !== value) : [...current, value],
    );
  }

  function close() {
    setAttendanceEndDialogOpen(false);
  }

  async function confirm() {
    const systemCrew = availableWorkers
      .filter((worker) => selectedWorkerIds.includes(worker.id))
      .map((worker) => ({ id: worker.id, name: worker.full_name, source: 'system' }));
    const helperCrew = selectedHelpers.map((name) => ({ id: null, name, source: 'helper' }));
    const result = await finishAttendance(note, [...systemCrew, ...helperCrew]);
    if (result?.success && markReadyForDrafting && canMarkReadyForDrafting) {
      void updateStatus(linkedProject, DRAFTING_STATUS, t('סומן כניתן להתחיל לשרטט בסיום העבודה בשטח.'));
    }
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
        className={`attendanceEndModal ${linkedWorkSession ? 'projectWorkEndModal' : ''}`}
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
        </div>
        <div className={`attendanceEndBody ${linkedWorkSession ? 'projectWorkEndBody' : ''}`}>
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
          {linkedWorkSession && (
            <>
              <fieldset className="crewPicker">
                <legend>
                  <Users size={17} />
                  {t('עובדים מהמערכת שהיו איתי')}
                </legend>
                {availableWorkers.length === 0 ? (
                  <p className="muted">{t('לא נמצאו עובדים נוספים לבחירה.')}</p>
                ) : (
                  <div className="crewOptions">
                    {availableWorkers.map((worker) => (
                      <label className="crewOption" key={worker.id}>
                        <input
                          type="checkbox"
                          checked={selectedWorkerIds.includes(worker.id)}
                          onChange={() => toggleValue(worker.id, setSelectedWorkerIds)}
                        />
                        <span>{worker.full_name}</span>
                      </label>
                    ))}
                  </div>
                )}
              </fieldset>

              <fieldset className="crewPicker">
                <legend>
                  <Users size={17} />
                  {t('עוזרים שהיו איתי')}
                </legend>
                <div className="crewOptions">
                  {helperNames.map((name) => (
                    <label className="crewOption" key={name}>
                      <input
                        type="checkbox"
                        checked={selectedHelpers.includes(name)}
                        onChange={() => toggleValue(name, setSelectedHelpers)}
                      />
                      <span>{name}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            </>
          )}
          <p>
            <MapPin size={16} />
            {linkedWorkSession
              ? t('בעת האישור נבקש את מיקום הסיום ונשמור אותו יחד עם הצוות שנבחר.')
              : t('בעת האישור נבקש את מיקום הסיום ונשמור אותו בדיווח.')}
          </p>
        </div>
        {canMarkReadyForDrafting && (
          <div className="attendanceEndPinned">
            <label className="draftingReadyToggle">
              <input
                type="checkbox"
                checked={markReadyForDrafting}
                disabled={busy}
                onChange={(event) => setMarkReadyForDrafting(event.target.checked)}
              />
              <CheckCircle2 size={18} aria-hidden="true" />
              <span>
                <strong>{t('ניתן להתחיל לשרטט')}</strong>
                <small>{t('הסטטוס של הפרויקט יעודכן ל"עבר לשרטוט" בעת האישור.')}</small>
              </span>
            </label>
          </div>
        )}
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
