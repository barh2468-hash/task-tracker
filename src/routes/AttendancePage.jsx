import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock3,
  FolderKanban,
  HeartPulse,
  MapPin,
  Paperclip,
  Palmtree,
  Play,
  Search,
  Shield,
  Square,
  X,
} from 'lucide-react';
import { t, useLanguage } from '../features/language/LanguageContext.jsx';
import { useAuth } from '../features/auth/useAuth.js';
import { useAttendance } from '../features/attendance/AttendanceContext.jsx';
import { useProjects } from '../features/projects/ProjectsContext.jsx';
import {
  attendanceTypeLabel,
  attendanceTypeOptions,
} from '../features/attendance/api.js';
import { durationMinutes, formatDuration, toLocalDateKey } from '../utils/format.js';
import SickLeaveDialog from '../features/attendance/components/SickLeaveDialog.jsx';

const typeIcons = {
  field: BriefcaseBusiness,
  office: Building2,
  vacation: Palmtree,
  sick: HeartPulse,
  reserve_duty: Shield,
};

function formatTimer(milliseconds) {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map((value) => String(value).padStart(2, '0')).join(':');
}

export default function AttendancePage() {
  useTranslation();
  const { language } = useLanguage();
  const { profile, isDrafter } = useAuth();
  const {
    myAttendanceSessions: sessions,
    attendanceAvailable: available,
    attendanceBusy: busy,
    workSessions,
    startAttendance,
    openAttendanceEndDialog,
  } = useAttendance();
  const { projects, projectsLoaded } = useProjects();
  const [now, setNow] = useState(() => new Date());
  const [selectedType, setSelectedType] = useState('field');
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [projectPickerOpen, setProjectPickerOpen] = useState(false);
  const [projectQuery, setProjectQuery] = useState('');
  const [sickLeaveDialogOpen, setSickLeaveDialogOpen] = useState(false);
  const projectSearchRef = useRef(null);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  const openSession = sessions.find((item) => !item.ended_at && !item.is_all_day) || null;
  const today = toLocalDateKey(now);
  const dayStatus =
    sessions.find((item) => item.is_all_day && item.attendance_date === today) || null;
  const existingSickCertificate =
    dayStatus?.attendance_type === 'sick' ? dayStatus.sick_certificate || null : null;
  const todaySessions = useMemo(
    () =>
      sessions
        .filter(
          (item) =>
            !item.is_all_day &&
            (item.attendance_date || toLocalDateKey(new Date(item.started_at))) === today,
        )
        .sort((left, right) => new Date(left.started_at) - new Date(right.started_at)),
    [sessions, today],
  );

  useEffect(() => {
    if (openSession?.attendance_type) setSelectedType(openSession.attendance_type);
    else if (dayStatus?.attendance_type) setSelectedType(dayStatus.attendance_type);
  }, [dayStatus?.attendance_type, openSession?.attendance_type]);

  useEffect(() => {
    if (!projectPickerOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setProjectPickerOpen(false);
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', closeOnEscape);
    projectSearchRef.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [projectPickerOpen]);

  if (isDrafter) return <Navigate to="/app/projects" replace />;

  const locale = language === 'he' ? 'he-IL' : language === 'el' ? 'el-GR' : 'en-GB';
  const selectedOption =
    attendanceTypeOptions.find((item) => item.value === selectedType) || attendanceTypeOptions[0];
  const availableProjects = projects
    .filter((project) => !project.is_archived && project.status !== 'הושלם')
    .sort((left, right) => left.name.localeCompare(right.name, locale));
  const selectedProject =
    availableProjects.find((project) => project.id === selectedProjectId) || null;
  const projectsReady = projectsLoaded || availableProjects.length > 0;
  const normalizedProjectQuery = projectQuery.trim().toLocaleLowerCase(locale);
  const filteredProjects = availableProjects.filter((project) => {
    if (!normalizedProjectQuery) return true;
    return [project.name, project.location, project.client_name, project.reference_number]
      .filter(Boolean)
      .join(' ')
      .toLocaleLowerCase(locale)
      .includes(normalizedProjectQuery);
  });
  const linkedWorkSession = openSession
    ? workSessions.find(
        (item) =>
          !item.ended_at &&
          Math.abs(
            new Date(item.started_at).getTime() - new Date(openSession.started_at).getTime(),
          ) < 5000,
      )
    : null;
  const elapsedMilliseconds = openSession
    ? now.getTime() - new Date(openSession.started_at).getTime()
    : 0;
  const todayMinutes = todaySessions.reduce(
    (sum, item) =>
      sum +
      (item.ended_at
        ? durationMinutes(item.started_at, item.ended_at)
        : Math.max(0, Math.round((now.getTime() - new Date(item.started_at).getTime()) / 60000))),
    0,
  );
  const lastSession = todaySessions.at(-1) || null;
  const hour = now.getHours();
  const greeting = hour < 12 ? t('בוקר טוב') : hour < 17 ? t('צהריים טובים') : t('ערב טוב');
  const actionLabel = openSession
    ? t('סיום יום העבודה')
    : selectedOption.timed
      ? t('התחלת יום העבודה')
      : selectedType === 'sick'
        ? t('דיווח מחלה')
        : t('שמירת דיווח יומי');
  const statusLabel = openSession
    ? t('יום העבודה פעיל')
    : dayStatus
      ? t('דיווח יומי נשמר')
      : t('עדיין לא התחלת היום');

  function runPrimaryAction() {
    if (openSession) openAttendanceEndDialog();
    else if (selectedType === 'sick') setSickLeaveDialogOpen(true);
    else if (selectedType === 'field') openProjectPicker();
    else void startAttendance(selectedType, null);
  }

  function openProjectPicker() {
    setProjectQuery('');
    setProjectPickerOpen(true);
  }

  function chooseProject(projectId) {
    setSelectedProjectId(projectId);
  }

  function confirmProjectSelection() {
    setProjectPickerOpen(false);
    void startAttendance('field', selectedProject);
  }

  function closeSickLeaveDialog() {
    if (!busy) setSickLeaveDialogOpen(false);
  }

  function saveSickLeave(sickLeave) {
    return startAttendance('sick', null, { sickLeave });
  }

  return (
    <>
      <section className={`attendanceClockPage ${openSession ? 'isRunning' : ''}`}>
      <header className="attendanceClockIntro">
        <span className="attendanceClockEyebrow">
          <span className="attendanceClockPulse" />
          {statusLabel}
        </span>
        <h1>
          {greeting}, {profile?.full_name?.split(' ')[0] || t('משתמש')}
        </h1>
        <p>
          {now.toLocaleDateString(locale, {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
          })}
          <span aria-hidden="true"> · </span>
          <strong>
            {now.toLocaleTimeString(locale, {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
              hour12: false,
            })}
          </strong>
        </p>
      </header>

      <div className="attendanceTypePicker" role="group" aria-label={t('סוג דיווח')}>
        {attendanceTypeOptions.map((option) => {
          const TypeIcon = typeIcons[option.value] || BriefcaseBusiness;
          const selected = selectedType === option.value;
          return (
            <button
              key={option.value}
              type="button"
              className={selected ? 'selected' : ''}
              aria-pressed={selected}
              disabled={busy || Boolean(openSession)}
              onClick={() => setSelectedType(option.value)}
            >
              <TypeIcon size={17} />
              <span>{t(option.label)}</span>
            </button>
          );
        })}
      </div>

      {selectedType === 'sick' && !openSession && (
        <button
          type="button"
          className="attendanceSickTrigger"
          disabled={busy}
          onClick={() => setSickLeaveDialogOpen(true)}
        >
          <span className="attendanceSickTriggerIcon" aria-hidden="true">
            <Paperclip size={18} />
          </span>
          <span className="attendanceSickTriggerCopy">
            <small>{t('אישור מחלה · אופציונלי')}</small>
            <strong>
              {existingSickCertificate?.original_name || t('הוספת אישור מחלה')}
            </strong>
            <span>
              {existingSickCertificate?.file_path
                ? t('ניתן לצפות באישור או להחליף אותו')
                : t('PDF או תמונה, עד 10MB')}
            </span>
          </span>
          <ChevronDown size={19} aria-hidden="true" />
        </button>
      )}

      <section className={`attendanceClockAction ${openSession ? 'finish' : ''}`}>
        <span className="attendanceClockActionGlow" aria-hidden="true" />
        <button
          type="button"
          className="attendanceClockActionIcon"
          disabled={busy || !available}
          onClick={runPrimaryAction}
          aria-label={actionLabel}
        >
          {openSession ? <Square size={34} /> : <Play size={38} fill="currentColor" />}
        </button>
        <span className="attendanceClockActionCopy">
          <small>
            {openSession
              ? linkedWorkSession?.projects?.name
                ? `${t(attendanceTypeLabel[openSession.attendance_type])} · ${linkedWorkSession.projects.name}`
                : t(attendanceTypeLabel[openSession.attendance_type])
              : selectedProject
                ? `${t(selectedOption.label)} · ${selectedProject.name}`
                : t(selectedOption.label)}
          </small>
          <strong>{busy ? t('מעדכן...') : actionLabel}</strong>
          <span>
            {openSession
              ? formatTimer(elapsedMilliseconds)
              : selectedOption.timed
                ? t('לחיצה אחת ומתחילים')
                : dayStatus
                  ? t('אפשר לעדכן את הדיווח שנשמר להיום')
                  : t('הדיווח יישמר עבור היום כולו')}
          </span>
        </span>
      </section>

      {!available && (
        <p className="attendanceClockWarning">
          {t('נדרש להפעיל את טבלת הנוכחות ב-Supabase לפני השימוש.')}
        </p>
      )}

      <footer className="attendanceClockSummary">
        <div>
          <Clock3 size={19} />
          <span>{t('סה״כ היום')}</span>
          <strong>{t(formatDuration(todayMinutes))}</strong>
        </div>
        <div>
          <CalendarDays size={19} />
          <span>{t('כניסה ראשונה')}</span>
          <strong>
            {todaySessions[0]
              ? new Date(todaySessions[0].started_at).toLocaleTimeString(locale, {
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : '—'}
          </strong>
        </div>
        <div>
          <CheckCircle2 size={19} />
          <span>{t('מצב נוכחי')}</span>
          <strong>
            {openSession
              ? t('בעבודה')
              : dayStatus
                ? t(attendanceTypeLabel[dayStatus.attendance_type])
                : lastSession?.ended_at
                  ? t('יום העבודה הסתיים')
                  : t('טרם התחיל')}
          </strong>
        </div>
      </footer>

      <p className="attendanceClockLocationNote">
        <MapPin size={15} />
        {t('המיקום נשמר רק בעת התחלה וסיום של יום העבודה.')}
      </p>
      </section>

      {projectPickerOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <div className="attendanceProjectModalBackdrop">
            <button
              type="button"
              className="attendanceProjectModalDismiss"
              aria-label={t('סגירת בחירת פרויקט')}
              onClick={() => setProjectPickerOpen(false)}
            />
            <section
              className="attendanceProjectModal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="attendance-project-picker-title"
            >
              <header className="attendanceProjectModalHeader">
                <span className="attendanceProjectModalIcon" aria-hidden="true">
                  <FolderKanban size={22} />
                </span>
                <span>
                  <h2 id="attendance-project-picker-title">
                    {t('בחירת פרויקט לעבודה בשטח')}
                  </h2>
                  <p>{t('בחר פרויקט או התחל ללא שיוך')}</p>
                </span>
                <button
                  type="button"
                  className="attendanceProjectModalClose"
                  aria-label={t('סגירת בחירת פרויקט')}
                  onClick={() => setProjectPickerOpen(false)}
                >
                  <X size={20} />
                </button>
              </header>

              <label className="attendanceProjectSearch">
                <Search size={19} aria-hidden="true" />
                <input
                  ref={projectSearchRef}
                  type="search"
                  value={projectQuery}
                  placeholder={t('חיפוש פרויקט...')}
                  onChange={(event) => setProjectQuery(event.target.value)}
                />
              </label>

              <div className="attendanceProjectOptions">
                <button
                  type="button"
                  className={!selectedProjectId ? 'selected' : ''}
                  onClick={() => chooseProject('')}
                >
                  <span className="attendanceProjectOptionIcon" aria-hidden="true">
                    <BriefcaseBusiness size={20} />
                  </span>
                  <span>
                    <strong>{t('התחלה ללא פרויקט')}</strong>
                    <small>{t('אפשר להתחיל את יום העבודה גם ללא שיוך לפרויקט.')}</small>
                  </span>
                  {!selectedProjectId && <Check size={20} aria-hidden="true" />}
                </button>

                {projectsReady && filteredProjects.length > 0 && (
                  <p className="attendanceProjectOptionsLabel">
                    {t('הפרויקטים הזמינים שלך')}
                  </p>
                )}

                {filteredProjects.map((project) => {
                  const selected = selectedProjectId === project.id;
                  return (
                    <button
                      key={project.id}
                      type="button"
                      className={selected ? 'selected' : ''}
                      onClick={() => chooseProject(project.id)}
                    >
                      <span className="attendanceProjectOptionIcon" aria-hidden="true">
                        <FolderKanban size={20} />
                      </span>
                      <span>
                        <strong>{project.name}</strong>
                        <small>
                          {[project.location, project.client_name].filter(Boolean).join(' · ') ||
                            t('פרויקט פעיל')}
                        </small>
                      </span>
                      {selected && <Check size={20} aria-hidden="true" />}
                    </button>
                  );
                })}

                {!projectsReady && (
                  <p className="attendanceProjectEmpty">{t('טוען פרויקטים...')}</p>
                )}
                {projectsReady && filteredProjects.length === 0 && (
                  <p className="attendanceProjectEmpty">
                    {t('לא נמצאו פרויקטים מתאימים')}
                  </p>
                )}
              </div>

              <footer className="attendanceProjectModalFooter">
                <button
                  type="button"
                  className="smallBtn"
                  disabled={busy}
                  onClick={confirmProjectSelection}
                >
                  {t('אישור והתחלת עבודה')}
                </button>
              </footer>
            </section>
          </div>,
          document.body,
        )}
      <SickLeaveDialog
        open={sickLeaveDialogOpen}
        busy={busy}
        today={today}
        existingCertificate={existingSickCertificate}
        onClose={closeSickLeaveDialog}
        onSubmit={saveSickLeave}
      />
    </>
  );
}
