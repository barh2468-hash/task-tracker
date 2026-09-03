import { useTranslation } from 'react-i18next';
import { t } from '../../language/LanguageContext.jsx';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Archive,
  Camera,
  ChevronDown,
  FileText,
  Mail,
  Pencil,
  PlayCircle,
  Phone,
  RotateCcw,
  Square,
  Trash2,
  X,
} from 'lucide-react';
import { useAuth } from '../../auth/useAuth.js';
import { useAttendance } from '../../attendance/AttendanceContext.jsx';
import { useProjects } from '../ProjectsContext.jsx';
import { appStatuses } from '../../../services/supabase.js';
import StatusPill, { getStatusClass } from '../../../components/StatusPill.jsx';
import LocationLine from '../../../components/LocationLine.jsx';
import { exportProjectPdf } from '../utils/exportProjectPdf.js';
import DrafterReviewBox from './DrafterReviewBox.jsx';
import ReviewFilesPanel from './ReviewFilesPanel.jsx';
import TaskPanel from './TaskPanel.jsx';
import PhotoGallery from '../../photos/components/PhotoGallery.jsx';
import WorkDiaryPanel from '../../work-diary/components/WorkDiaryPanel.jsx';

const photoCategories = [
  'תמונת שטח',
  'תשתית שנמצאה',
  'בעיה / חסם',
  'סימון בשטח',
  'אישור סיום',
  'אחר',
];

export default function ProjectCard({ project }) {
  useTranslation();
  const { profile, isManager, isDrafter, session } = useAuth();
  const {
    historyItems,
    workers,
    updateStatus,
    uploadPhoto,
    deletePhoto,
    saveProject,
    deleteProject,
    archiveProject,
    restoreProject,
    addProjectTask,
    toggleProjectTask,
    deleteProjectTask,
    sendProjectToReview,
    deleteProjectReviewFile,
    assignProjectDrafter,
    loadProjectAssets,
  } = useProjects();
  const { startWork, openProjectWorkEndDialog, workSessions } = useAttendance();

  const currentUserId = session?.user?.id;
  const currentUserName = profile?.full_name || '';
  const projectSessions = workSessions.filter((item) => item.project_id === project.id);
  const projectWithSessions = { ...project, work_sessions: projectSessions };

  const projectHistory = historyItems.filter((h) => h.project_id === project.id).slice(0, 4);

  const [status, setStatus] = useState(project.status);
  const [note, setNote] = useState('');
  const [photoCategory, setPhotoCategory] = useState(photoCategories[0]);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDescription, setTaskDescription] = useState('');
  const [reviewFile, setReviewFile] = useState(null);
  const [reviewNote, setReviewNote] = useState('');
  const [editing, setEditing] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [assets, setAssets] = useState({ project_photos: [], project_review_files: [] });
  const [assetsLoading, setAssetsLoading] = useState(false);
  const assignedDrafterId =
    project.project_workers?.find((assignment) => assignment.profiles?.role === 'drafter')
      ?.worker_id || '';
  const [selectedDrafterId, setSelectedDrafterId] = useState(assignedDrafterId);
  const projectLeads = workers.filter((worker) => worker.role !== 'drafter');
  const fieldWorkers = workers.filter((worker) => worker.role === 'field_worker');
  const drafters = workers.filter((worker) => worker.role === 'drafter');
  const [editProject, setEditProject] = useState({
    name: project.name,
    client_name: project.client_name || '',
    location: project.location,
    contact_phone: project.contact_phone || '',
    contact_email: project.contact_email || '',
    description: project.description || '',
    assigned_to: project.assigned_to || '',
    assigned_workers: (project.project_workers || [])
      .filter(
        (assignment) => !assignment.profiles?.role || assignment.profiles.role === 'field_worker',
      )
      .map((assignment) => assignment.worker_id),
    due_date: project.due_date || '',
    requires_work_diary: Boolean(project.requires_work_diary),
  });
  useEffect(() => {
    setStatus(project.status);
    setEditProject({
      name: project.name,
      client_name: project.client_name || '',
      location: project.location,
      contact_phone: project.contact_phone || '',
      contact_email: project.contact_email || '',
      description: project.description || '',
      assigned_to: project.assigned_to || '',
      assigned_workers: (project.project_workers || [])
        .filter(
          (assignment) => !assignment.profiles?.role || assignment.profiles.role === 'field_worker',
        )
        .map((assignment) => assignment.worker_id),
      due_date: project.due_date || '',
      requires_work_diary: Boolean(project.requires_work_diary),
    });
    setReviewFile(null);
    setReviewNote('');
    setSelectedDrafterId(
      project.project_workers?.find((assignment) => assignment.profiles?.role === 'drafter')
        ?.worker_id || '',
    );
  }, [project]);
  useEffect(() => {
    if (!editing) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [editing]);

  async function refreshAssets() {
    setAssetsLoading(true);
    try {
      setAssets(await loadProjectAssets(project.id));
    } finally {
      setAssetsLoading(false);
    }
  }

  useEffect(() => {
    if (!detailsOpen || !navigator.onLine) return;
    refreshAssets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detailsOpen, project.id]);

  const myOpenSession = projectSessions.find((w) => w.worker_id === currentUserId && !w.ended_at);
  const otherOpenSessions = projectSessions.filter(
    (w) => w.worker_id !== currentUserId && !w.ended_at,
  );
  const isAssignedFieldWorker =
    profile?.role === 'field_worker' &&
    (project.assigned_to === currentUserId ||
      (project.project_workers || []).some((assignment) => assignment.worker_id === currentUserId));
  const lastEndedSession = projectSessions
    .filter((w) => w.worker_id === currentUserId && w.ended_at)
    .sort((a, b) => new Date(b.ended_at || '').getTime() - new Date(a.ended_at || '').getTime())[0];
  const isReviewSent = project.status === 'נשלח להגהה';

  const editModal = editing ? (
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions -- backdrop click-to-close is a mouse convenience; the close button covers keyboard access
    <div
      className="modalBackdrop"
      role="dialog"
      aria-modal="true"
      onClick={() => setEditing(false)}
    >
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- stops the backdrop's close handler from firing for clicks inside the modal */}
      <div className="editModal" onClick={(e) => e.stopPropagation()}>
        <div className="editHeader modalHeader">
          <div>
            <h3>{t('עריכת פרויקט')}</h3>
            <p className="muted">{t('עדכון פרטי הפרויקט, שיוך עובד ותאריך יעד.')}</p>
          </div>
          <button
            className="ghost smallBtn iconBtn"
            onClick={() => setEditing(false)}
            aria-label={t('סגור')}
          >
            <X size={18} />
          </button>
        </div>
        <div className="formGrid editGrid">
          <label>
            {t('שם פרויקט')}

            <input
              value={editProject.name}
              onChange={(e) => setEditProject({ ...editProject, name: e.target.value })}
            />
          </label>
          <label>
            {t('לקוח')}

            <input
              value={editProject.client_name}
              onChange={(e) => setEditProject({ ...editProject, client_name: e.target.value })}
            />
          </label>
          <label>
            {t('מיקום')}

            <input
              value={editProject.location}
              onChange={(e) => setEditProject({ ...editProject, location: e.target.value })}
            />
          </label>
          <label>
            {t('טלפון איש קשר בשטח')}

            <input
              type="tel"
              dir="ltr"
              value={editProject.contact_phone}
              onChange={(e) => setEditProject({ ...editProject, contact_phone: e.target.value })}
              placeholder="050-1234567"
            />
          </label>
          <label>
            {t('מייל איש קשר בשטח')}

            <input
              type="email"
              dir="ltr"
              value={editProject.contact_email}
              onChange={(e) => setEditProject({ ...editProject, contact_email: e.target.value })}
              placeholder="contact@company.com"
            />
          </label>
          <label>
            {t('שיוך לאחראי ראשי (מנהל או עובד שטח)')}

            <select
              value={editProject.assigned_to}
              onChange={(e) => setEditProject({ ...editProject, assigned_to: e.target.value })}
            >
              <option value="">{t('לא משויך')}</option>
              {projectLeads.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.full_name} - {w.email}
                </option>
              ))}
            </select>
          </label>
          <label className="wideField">
            {t('עובדים נוספים בפרויקט')}

            <div className="workerChecks compactChecks">
              {fieldWorkers.map((w) => (
                <label key={w.id} className="checkLine">
                  <input
                    type="checkbox"
                    checked={editProject.assigned_workers.includes(w.id)}
                    onChange={(e) => {
                      const next = e.target.checked
                        ? Array.from(new Set([...editProject.assigned_workers, w.id]))
                        : editProject.assigned_workers.filter((id) => id !== w.id);
                      setEditProject({ ...editProject, assigned_workers: next });
                    }}
                  />
                  {w.full_name} - {w.email}
                </label>
              ))}
            </div>
          </label>
          <label>
            {t('תאריך יעד')}

            <input
              type="date"
              value={editProject.due_date}
              onChange={(e) => setEditProject({ ...editProject, due_date: e.target.value })}
            />
          </label>
          <label className="workDiaryProjectToggle wideField">
            <input
              type="checkbox"
              checked={Boolean(editProject.requires_work_diary)}
              onChange={(e) =>
                setEditProject({
                  ...editProject,
                  requires_work_diary: e.target.checked,
                })
              }
            />

            {t('הפרויקט דורש יומן עבודה וחתימות')}
          </label>
        </div>
        <label>
          {t('תיאור')}

          <textarea
            className="modalTextarea"
            value={editProject.description}
            onChange={(e) => setEditProject({ ...editProject, description: e.target.value })}
          />
        </label>
        <div className="modalActions">
          <button
            onClick={() => {
              saveProject(project.id, editProject);
              setEditing(false);
            }}
          >
            {t('שמור שינויים')}
          </button>
          <button className="ghost" onClick={() => setEditing(false)}>
            {t('ביטול')}
          </button>
          {project.is_archived ? (
            <button
              className="ghost"
              onClick={() => {
                restoreProject(project);
                setEditing(false);
              }}
            >
              <RotateCcw size={16} />
              {t('שחזור מהארכיון')}
            </button>
          ) : (
            <button
              className="ghost"
              onClick={() => {
                archiveProject(project);
                setEditing(false);
              }}
            >
              <Archive size={16} />
              {t('העבר לארכיון')}
            </button>
          )}
          <button className="danger ghost" onClick={() => deleteProject(project)}>
            <Trash2 size={16} />
            {t('מחיקת פרויקט')}
          </button>
        </div>
      </div>
    </div>
  ) : null;

  return (
    <>
      <style>{`
        @media (max-width: 720px) {
          .projectCompactHeader > div {
            grid-template-columns: auto minmax(0, 1fr) !important;
            gap: 10px !important;
            padding: 14px 12px !important;
          }
          .projectCompactHeader .pill,
          .projectCompactHeader .archiveBadge {
            justify-self: start;
          }
          .projectCompactHeader > div > span:nth-child(3),
          .projectCompactHeader > div > span:nth-child(4),
          .projectCompactHeader > div > span:nth-child(5) {
            grid-column: 2;
            white-space: normal !important;
            font-size: 13px;
          }
          .projectCompactHeader .title {
            font-size: 18px !important;
          }
          .projectExpandedBody {
            grid-template-columns: minmax(0, 1fr) !important;
            gap: 14px !important;
            overflow: visible !important;
          }
          .projectExpandedBody > * {
            min-width: 0 !important;
            max-width: 100% !important;
          }
          .projectExpandedBody .actionsRow,
          .projectExpandedBody .cardActions,
          .projectExpandedBody .photoUploadBox,
          .projectExpandedBody .taskActions {
            flex-wrap: wrap !important;
          }
          .projectExpandedBody input,
          .projectExpandedBody select,
          .projectExpandedBody textarea,
          .projectExpandedBody button {
            max-width: 100%;
          }
        }
      `}</style>
      <article
        id={`project-${project.id}`}
        className={`project status-${getStatusClass(project.status)} ${detailsOpen ? 'project-open' : 'project-closed'}`}
        style={
          isReviewSent
            ? {
                background: '#fff1f2',
                borderColor: '#fecdd3',
                boxShadow: '0 16px 40px rgba(190, 18, 60, .10)',
              }
            : undefined
        }
      >
        <button
          type="button"
          className="projectCompactHeader"
          onClick={() => setDetailsOpen((open) => !open)}
          aria-expanded={detailsOpen}
          style={{
            gridColumn: '1 / -1',
            width: '100%',
            border: 0,
            background: 'transparent',
            padding: 0,
            cursor: 'pointer',
            textAlign: 'right',
            color: 'inherit',
            display: 'block',
            minHeight: 0,
          }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'auto minmax(0, 1fr) auto auto auto',
              gap: 14,
              alignItems: 'center',
              width: '100%',
              minHeight: 0,
              padding: '14px 16px',
            }}
          >
            <span
              style={{
                width: 38,
                height: 38,
                borderRadius: 999,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: '#eef6ff',
                color: '#0b376d',
                transform: detailsOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform .2s ease',
              }}
            >
              <ChevronDown size={18} />
            </span>
            <span style={{ minWidth: 0 }}>
              <span
                className="title"
                style={{
                  display: 'block',
                  marginBottom: 6,
                  fontSize: 20,
                  lineHeight: 1.25,
                  overflowWrap: 'anywhere',
                }}
              >
                {project.name}{' '}
                {project.is_archived && <span className="archiveBadge">{t('בארכיון')}</span>}
              </span>
              <span
                className="muted"
                style={{
                  display: 'block',
                  fontSize: 14,
                  lineHeight: 1.5,
                  overflowWrap: 'anywhere',
                }}
              >
                {t('מספר הזמנה / לקוח:')}
                {project.client_name || t('לא הוגדר')} · {project.location}
              </span>
            </span>
            <StatusPill status={project.status} />
            <span className="muted" style={{ whiteSpace: 'nowrap', fontWeight: 700 }}>
              {project.progress}
              {t('% התקדמות')}
            </span>
            <span className="muted" style={{ whiteSpace: 'nowrap', fontWeight: 700 }}>
              {t('יעד:')}
              {project.due_date
                ? new Date(project.due_date).toLocaleDateString('he-IL')
                : t('לא הוגדר')}
            </span>
          </div>
        </button>

        {detailsOpen && (
          <div
            className="projectExpandedBody"
            style={{
              gridColumn: '1 / -1',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
              gap: 16,
              width: '100%',
              maxWidth: '100%',
              overflow: 'hidden',
              marginTop: 14,
              alignItems: 'start',
            }}
          >
            <div>
              <div className="title">
                {project.name}{' '}
                {project.is_archived && <span className="archiveBadge">{t('בארכיון')}</span>}
              </div>
              <div className="muted">
                {project.client_name || t('ללא לקוח')} · {project.description || t('אין תיאור')}
              </div>
              <div className="muted">
                {t('עובד אחראי:')}
                {project.profiles?.full_name || t('לא משויך')}
              </div>
              {!!project.project_workers?.some(
                (assignment) =>
                  !assignment.profiles?.role || assignment.profiles.role === 'field_worker',
              ) && (
                <div className="muted">
                  {t('עובדים נוספים:')}
                  {project.project_workers
                    .filter(
                      (assignment) =>
                        !assignment.profiles?.role || assignment.profiles.role === 'field_worker',
                    )
                    .map((assignment) => assignment.profiles?.full_name || t('עובד'))
                    .join(', ')}
                </div>
              )}
              {assignedDrafterId && (
                <div className="muted">
                  {t('שרטט משויך:')}
                  {project.project_workers?.find(
                    (assignment) => assignment.worker_id === assignedDrafterId,
                  )?.profiles?.full_name || t('שרטט')}
                </div>
              )}
              {isManager && (
                <div className="actionsRow cardActions">
                  <button className="ghost smallBtn" onClick={() => setEditing(true)}>
                    <Pencil size={16} />
                    {t('עריכה')}
                  </button>
                  {project.is_archived ? (
                    <button className="ghost smallBtn" onClick={() => restoreProject(project)}>
                      <RotateCcw size={16} />
                      {t('שחזור')}
                    </button>
                  ) : (
                    <button className="ghost smallBtn" onClick={() => archiveProject(project)}>
                      <Archive size={16} />
                      {t('העבר לארכיון')}
                    </button>
                  )}
                  <button className="danger ghost smallBtn" onClick={() => deleteProject(project)}>
                    <Trash2 size={16} />
                    {t('מחיקה')}
                  </button>
                  <button
                    className="ghost smallBtn"
                    onClick={() => exportProjectPdf({ ...project, ...assets }, projectHistory)}
                  >
                    <FileText size={16} />
                    {t('דוח PDF')}
                  </button>
                </div>
              )}
            </div>
            <div>
              <StatusPill status={project.status} />
              <div className="muted" style={{ marginTop: 10 }}>
                {project.location}
              </div>
              {project.contact_phone && (
                <a
                  className="phoneLink"
                  href={`tel:${project.contact_phone.replace(/[^0-9+]/g, '')}`}
                  title={t('התקשר לאיש קשר בשטח')}
                >
                  <Phone size={15} /> {project.contact_phone}
                </a>
              )}
              {project.contact_email && (
                <a
                  className="phoneLink"
                  href={`mailto:${project.contact_email}`}
                  title={t('שליחת מייל לאיש קשר בשטח')}
                >
                  <Mail size={15} /> {project.contact_email}
                </a>
              )}
              <div className="muted">
                {t('עודכן:')}
                {new Date(project.updated_at).toLocaleDateString('he-IL')}
              </div>
            </div>
            <div>
              <b>
                {project.progress}
                {t('% התקדמות')}
              </b>
              <div className="progress">
                <i style={{ width: `${project.progress}%` }} />
              </div>
              <div className="muted">
                {t('יעד:')}{' '}
                {project.due_date
                  ? new Date(project.due_date).toLocaleDateString('he-IL')
                  : t('לא הוגדר')}
              </div>
              <PhotoGallery
                photos={assets.project_photos}
                canDelete={isManager || isAssignedFieldWorker}
                onDelete={async (photo) => {
                  await deletePhoto(photo, project);
                  await refreshAssets();
                }}
              />

              {assetsLoading && <span className="muted">{t('טוען תמונות וקבצים...')}</span>}
            </div>
            <div className="form">
              <div className="timeBox">
                {myOpenSession ? (
                  <>
                    <div>
                      <b>{t('עבודה פעילה')}</b>
                      <br />
                      <span className="muted">
                        {t('התחלה:')} {new Date(myOpenSession.started_at).toLocaleString('he-IL')}
                      </span>
                      <LocationLine
                        label={t('מיקום התחלה')}
                        lat={myOpenSession.started_lat}
                        lng={myOpenSession.started_lng}
                        accuracy={myOpenSession.started_accuracy}
                      />
                    </div>
                    <button
                      className="smallBtn danger"
                      onClick={() => openProjectWorkEndDialog(projectWithSessions)}
                    >
                      <Square size={15} />
                      {t('סיים עבודה')}
                    </button>
                  </>
                ) : (
                  <>
                    <div>
                      <b>{t('שעות עבודה')}</b>
                      <br />
                      <span className="muted">
                        {lastEndedSession
                          ? t('סיום אחרון: {{value0}}', {
                              value0: new Date(lastEndedSession.ended_at || '').toLocaleString(
                                'he-IL',
                              ),
                            })
                          : t('לא נרשמה עבודה פתוחה')}
                      </span>
                      {lastEndedSession && (
                        <LocationLine
                          label={t('מיקום סיום אחרון')}
                          lat={lastEndedSession.ended_lat}
                          lng={lastEndedSession.ended_lng}
                          accuracy={lastEndedSession.ended_accuracy}
                        />
                      )}
                    </div>
                    <button className="smallBtn" onClick={() => startWork(projectWithSessions)}>
                      <PlayCircle size={15} />
                      {t('התחל עבודה')}
                    </button>
                  </>
                )}
                {isManager && otherOpenSessions.length > 0 && (
                  <div className="managerActiveSessions">
                    <b>{t('עבודות פעילות נוספות')}</b>
                    {otherOpenSessions.map((workSession) => (
                      <span key={workSession.id} className="muted">
                        {workSession.profiles?.full_name || t('משתמש')}
                        {t('· התחלה:')} {new Date(workSession.started_at).toLocaleString('he-IL')}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <select value={status} onChange={(e) => setStatus(e.target.value)}>
                {appStatuses.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={t('הערה לעדכון, אופציונלי')}
              />

              <button
                className="smallBtn"
                onClick={() => {
                  updateStatus(project, status, note);
                  setNote('');
                }}
              >
                {t('עדכן סטטוס')}
              </button>
              <div className="photoUploadBox">
                <select
                  value={photoCategory}
                  onChange={(e) => setPhotoCategory(e.target.value)}
                  title={t('סוג תמונה')}
                >
                  {photoCategories.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
                <label
                  className="smallBtn secondary"
                  style={{
                    display: 'flex',
                    gap: 8,
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                  }}
                >
                  <Camera size={16} />
                  {t('העלאת תמונה')}
                  <input
                    className="photoInput"
                    style={{ display: 'none' }}
                    type="file"
                    accept="image/*"
                    onChange={async (e) => {
                      if (!e.target.files?.[0]) return;
                      const result = await uploadPhoto(
                        project.id,
                        e.target.files[0],
                        photoCategory,
                      );
                      if (!result?.offline) await refreshAssets();
                    }}
                  />
                </label>
              </div>
            </div>

            {project.requires_work_diary && (
              <WorkDiaryPanel
                project={project}
                currentUserName={currentUserName}
                canDelete={isManager}
              />
            )}

            {isManager && project.status === 'עבר לשרטוט' && (
              <section className="drafterAssignmentBox">
                <div>
                  <b>{t('שיוך הפרויקט לשרטט')}</b>
                  <span>
                    {assignedDrafterId
                      ? t('הפרויקט משויך כעת לשרטט. אפשר לשנות את השיוך.')
                      : t('הפרויקט ממתין לבחירת שרטט על ידי מנהל.')}
                  </span>
                </div>
                <select
                  value={selectedDrafterId}
                  onChange={(event) => setSelectedDrafterId(event.target.value)}
                >
                  <option value="">{t('ללא שרטט משויך')}</option>
                  {drafters.map((drafter) => (
                    <option key={drafter.id} value={drafter.id}>
                      {drafter.full_name} - {drafter.email}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => assignProjectDrafter(project, selectedDrafterId)}
                  disabled={!drafters.length && !assignedDrafterId}
                >
                  <Pencil size={16} /> {assignedDrafterId ? t('עדכון שיוך') : t('שיוך לשרטט')}
                </button>
              </section>
            )}

            <ReviewFilesPanel
              files={assets.project_review_files}
              canDelete={isManager || isDrafter}
              onDelete={async (file) => {
                await deleteProjectReviewFile(file, project.id);
                await refreshAssets();
              }}
            />

            {(isDrafter || isManager) && project.status === 'עבר לשרטוט' && (
              <DrafterReviewBox
                reviewFile={reviewFile}
                setReviewFile={setReviewFile}
                reviewNote={reviewNote}
                setReviewNote={setReviewNote}
                onSend={async () => {
                  if (!reviewFile) {
                    return;
                  }
                  await sendProjectToReview(project, reviewFile, reviewNote);
                  await refreshAssets();
                  setReviewFile(null);
                  setReviewNote('');
                }}
              />
            )}
            <TaskPanel
              tasks={project.project_tasks || []}
              isManager={isManager}
              canAddTasks={isManager || isAssignedFieldWorker}
              canCompleteTasks={
                isManager ||
                project.assigned_to === currentUserId ||
                !!project.project_workers?.some((w) => w.worker_id === currentUserId)
              }
              showTaskForm={showTaskForm}
              setShowTaskForm={setShowTaskForm}
              taskTitle={taskTitle}
              setTaskTitle={setTaskTitle}
              taskDescription={taskDescription}
              setTaskDescription={setTaskDescription}
              onAdd={() => {
                addProjectTask(project.id, taskTitle, taskDescription);
                setTaskTitle('');
                setTaskDescription('');
                setShowTaskForm(false);
              }}
              onToggle={(task) => toggleProjectTask(task, project)}
              onDelete={deleteProjectTask}
            />

            <div className={`history collapsibleHistory ${historyOpen ? 'open' : ''}`}>
              <button
                className="historyToggle"
                onClick={() => setHistoryOpen(!historyOpen)}
                aria-expanded={historyOpen}
              >
                <span>
                  <b>{t('עדכונים אחרונים')}</b>
                  <small>
                    {projectHistory.length === 0
                      ? t('אין עדכונים')
                      : t('{{value0}} עדכונים', { value0: projectHistory.length })}
                  </small>
                </span>
                <ChevronDown className="historyChevron" size={18} />
              </button>
              {historyOpen && (
                <div className="historyList">
                  {projectHistory.length === 0 && (
                    <div className="muted">{t('אין עדכונים עדיין')}</div>
                  )}
                  {projectHistory.map((h) => (
                    <div className="historyItem" key={h.id}>
                      • {t(h.new_status)}
                      <br />
                      <span>
                        {h.profiles?.full_name || t('משתמש')} ·{' '}
                        {new Date(h.created_at).toLocaleString('he-IL')}
                      </span>
                      {h.note && (
                        <>
                          <br />
                          <span>{h.note}</span>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </article>
      {editModal && createPortal(editModal, document.body)}
    </>
  );
}
