import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Clock, MapPin, Square, Users, X } from 'lucide-react';
import { useAuth } from '../../auth/useAuth.js';
import { useProjects } from '../../projects/ProjectsContext.jsx';
import { useAttendance } from '../AttendanceContext.jsx';

const helperNames = [
  'יובל',
  'מתן',
  'חיים',
  'גבי',
  'אילן',
  'שקד',
  'גבריאל',
  'שי',
  'אופק מושנוב',
  'יצחק',
  'אלי',
];

export default function ProjectWorkEndDialog() {
  const { session } = useAuth();
  const { workers } = useProjects();
  const {
    projectWorkEndTarget: project,
    projectWorkEndBusy: busy,
    closeProjectWorkEndDialog,
    endWork,
  } = useAttendance();
  const [note, setNote] = useState('');
  const [selectedWorkerIds, setSelectedWorkerIds] = useState([]);
  const [selectedHelpers, setSelectedHelpers] = useState([]);

  const availableWorkers = useMemo(
    () => workers
      .filter((worker) => worker.id !== session?.user?.id)
      .sort((a, b) => a.full_name.localeCompare(b.full_name, 'he')),
    [workers, session?.user?.id],
  );

  const openSession = project?.work_sessions?.find(
    (item) => item.worker_id === session?.user?.id && !item.ended_at,
  );

  useEffect(() => {
    setNote('');
    setSelectedWorkerIds([]);
    setSelectedHelpers([]);
  }, [project?.id]);

  if (!project || !openSession || typeof document === 'undefined') return null;

  function toggleValue(value, setter) {
    setter((current) => current.includes(value)
      ? current.filter((item) => item !== value)
      : [...current, value]);
  }

  async function confirm() {
    const systemCrew = availableWorkers
      .filter((worker) => selectedWorkerIds.includes(worker.id))
      .map((worker) => ({ id: worker.id, name: worker.full_name, source: 'system' }));
    const helperCrew = selectedHelpers.map((name) => ({ id: null, name, source: 'helper' }));
    await endWork({ endNote: note, crewMembers: [...systemCrew, ...helperCrew] });
  }

  return createPortal(
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions -- close button provides keyboard access
    <div className="modalBackdrop attendanceEndBackdrop" role="dialog" aria-modal="true" aria-labelledby="project-work-end-title" onClick={() => !busy && closeProjectWorkEndDialog()}>
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions -- prevent backdrop close inside modal */}
      <form
        className="attendanceEndModal projectWorkEndModal"
        onClick={(event) => event.stopPropagation()}
        onSubmit={(event) => {
          event.preventDefault();
          void confirm();
        }}
      >
        <div className="attendanceEndHeader">
          <div className="attendanceEndHeaderIcon"><Clock size={23} /></div>
          <div>
            <span>סיום עבודה בפרויקט</span>
            <h2 id="project-work-end-title">{project.name}</h2>
            <p>התחלה: {new Date(openSession.started_at).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}</p>
          </div>
          <button type="button" className="iconOnly" aria-label="סגירה" disabled={busy} onClick={closeProjectWorkEndDialog}><X size={18} /></button>
        </div>

        <div className="attendanceEndBody projectWorkEndBody">
          <label>
            הערת סיום <small>אופציונלי</small>
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="מה בוצע, מידע חשוב למנהל או ציוד שהוחזר"
              // eslint-disable-next-line jsx-a11y/no-autofocus -- dialog opens directly on its primary field
              autoFocus
            />
          </label>

          <fieldset className="crewPicker">
            <legend><Users size={17} /> עובדים מהמערכת שהיו איתי</legend>
            {availableWorkers.length === 0 ? (
              <p className="muted">לא נמצאו עובדים נוספים לבחירה.</p>
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
            <legend><Users size={17} /> עוזרים שהיו איתי</legend>
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

          <p><MapPin size={16} /> בעת האישור נבקש את מיקום הסיום ונשמור אותו יחד עם הצוות שנבחר.</p>
        </div>

        <div className="attendanceEndActions">
          <button type="button" className="ghost" disabled={busy} onClick={closeProjectWorkEndDialog}>חזרה</button>
          <button type="submit" className="danger" disabled={busy}>
            <Square size={17} /> {busy ? 'שומר ומסיים...' : 'אישור וסיום עבודה'}
          </button>
        </div>
      </form>
    </div>,
    document.body,
  );
}
