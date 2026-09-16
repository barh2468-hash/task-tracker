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
  MessageSquareText,
  MoreHorizontal,
  Pencil,
  Phone,
  RotateCcw,
  Trash2,
  X,
} from 'lucide-react';
import { useAuth } from '../../auth/useAuth.js';
import { useProjects } from '../ProjectsContext.jsx';
import {
  appStatuses,
  FIELD_WORKER_STATUSES,
  REVIEW_COMPLETED_STATUS,
  REVIEW_STATUS,
} from '../../../services/supabase.js';
import StatusPill, { getStatusClass } from '../../../components/StatusPill.jsx';
import { exportProjectPdf } from '../utils/exportProjectPdf.js';
import DrafterReviewBox from './DrafterReviewBox.jsx';
import ReviewFilesPanel from './ReviewFilesPanel.jsx';
import ProjectDocumentsPanel from './ProjectDocumentsPanel.jsx';
import TaskPanel from './TaskPanel.jsx';
import PhotoGallery from '../../photos/components/PhotoGallery.jsx';
import WorkDiaryPanel from '../../work-diary/components/WorkDiaryPanel.jsx';
import { findAssignedDrafter, isDrafterCandidate } from '../utils/drafters.js';

const photoCategories = [
  'תמונת שטח',
  'תשתית שנמצאה',
  'בעיה / חסם',
  'סימון בשטח',
  'אישור סיום',
  'אחר',
];

export default function ProjectCard({ project, focused = false }) {
  useTranslation();
  const { profile, isManager, isDrafter, session } = useAuth();
  const {
    historyItems,
    workers,
    updateStatus,
    uploadPhoto,
    deletePhoto,
    uploadProjectDocument,
    deleteProjectDocument,
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
  const currentUserId = session?.user?.id;
  const currentUserName = profile?.full_name || '';

  const projectHistory = historyItems.filter((h) => h.project_id === project.id).slice(0, 4);

  const statusOptions = profile?.role === 'field_worker' ? FIELD_WORKER_STATUSES : appStatuses;
  const [status, setStatus] = useState(
    statusOptions.includes(project.status) ? project.status : '',
  );
  const [statusNote, setStatusNote] = useState('');
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [photoCategory, setPhotoCategory] = useState(photoCategories[0]);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDescription, setTaskDescription] = useState('');
  const [reviewFile, setReviewFile] = useState(null);
  const [reviewNote, setReviewNote] = useState('');
  const [editing, setEditing] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [activeDetailTab, setActiveDetailTab] = useState('tasks');
  const [moreActionsOpen, setMoreActionsOpen] = useState(false);
  const [assets, setAssets] = useState({
    project_photos: [],
    project_review_files: [],
    project_documents: [],
  });
  const [assetsLoading, setAssetsLoading] = useState(false);
  const assignedDrafterId = findAssignedDrafter(project)?.worker_id || '';
  const [selectedDrafterId, setSelectedDrafterId] = useState(assignedDrafterId);
  const fieldWorkers = workers.filter((worker) => worker.role === 'field_worker');
  const drafters = workers.filter(isDrafterCandidate);
  const [editProject, setEditProject] = useState({
    name: project.name,
    client_name: project.client_name || '',
    location: project.location,
    contact_phone: project.contact_phone || '',
    contact_email: project.contact_email || '',
    description: project.description || '',
    additional_notes: project.additional_notes || '',
    assigned_to: project.assigned_to || '',
    assigned_workers: (project.project_workers || [])
      .filter(
        (assignment) => !assignment.profiles?.role || assignment.profiles.role === 'field_worker',
      )
      .map((assignment) => assignment.worker_id),
    requires_work_diary: Boolean(project.requires_work_diary),
  });
  useEffect(() => {
    setStatus(statusOptions.includes(project.status) ? project.status : '');
    setEditProject({
      name: project.name,
      client_name: project.client_name || '',
      location: project.location,
      contact_phone: project.contact_phone || '',
      contact_email: project.contact_email || '',
      description: project.description || '',
      additional_notes: project.additional_notes || '',
      assigned_to: project.assigned_to || '',
      assigned_workers: (project.project_workers || [])
        .filter(
          (assignment) => !assignment.profiles?.role || assignment.profiles.role === 'field_worker',
        )
        .map((assignment) => assignment.worker_id),
      requires_work_diary: Boolean(project.requires_work_diary),
    });
    setSelectedDrafterId(findAssignedDrafter(project)?.worker_id || '');
  }, [project, statusOptions]);

  // Project objects are replaced by the realtime/polling refresh even when the
  // project itself did not change. Keep a selected review PDF across those
  // refreshes so the native file input and React state cannot drift apart.
  useEffect(() => {
    setReviewFile(null);
    setReviewNote('');
    setStatusDialogOpen(false);
    setStatusNote('');
    setActiveDetailTab('tasks');
    setMoreActionsOpen(false);
  }, [project.id]);

  useEffect(() => {
    if (project.status === 'עבר לשרטוט') return;
    setReviewFile(null);
    setReviewNote('');
  }, [project.status]);
  useEffect(() => {
    if (!editing && !statusDialogOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [editing, statusDialogOpen]);

  useEffect(() => {
    if (focused) setDetailsOpen(true);
  }, [focused]);

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

  const isAssignedFieldWorker =
    profile?.role === 'field_worker' &&
    (project.assigned_to === currentUserId ||
      (project.project_workers || []).some((assignment) => assignment.worker_id === currentUserId));
  const isReviewSent = project.status === REVIEW_STATUS;
  const isReviewCompleted = project.status === REVIEW_COMPLETED_STATUS;
  const canManageReview = isManager || isDrafter || isDrafterCandidate(profile);

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
            <p className="muted">{t('עדכון פרטי הפרויקט ושיוך עובדי שטח.')}</p>
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
            {t('שיוך לעובד שטח אחראי')}

            <select
              value={editProject.assigned_to}
              onChange={(e) => setEditProject({ ...editProject, assigned_to: e.target.value })}
            >
              <option value="">{t('לא משויך')}</option>
              {fieldWorkers.map((w) => (
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
        <div className="formGrid">
          <label>
            {t('תיאור')}

            <textarea
              className="modalTextarea"
              value={editProject.description}
              onChange={(e) => setEditProject({ ...editProject, description: e.target.value })}
            />
          </label>
          <label>
            {t('הערות נוספות')}

            <textarea
              className="modalTextarea"
              value={editProject.additional_notes}
              onChange={(e) => setEditProject({ ...editProject, additional_notes: e.target.value })}
            />
          </label>
        </div>
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

  const statusModal = statusDialogOpen ? (
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions -- backdrop click-to-close is a pointer convenience; the dialog has a keyboard-accessible close button
    <div
      className="modalBackdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby={`status-note-title-${project.id}`}
      onClick={() => !statusUpdating && setStatusDialogOpen(false)}
    >
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- prevent backdrop dismissal for clicks inside the modal */}
      <div className="statusNoteModal" onClick={(event) => event.stopPropagation()}>
        <div className="modalHeader statusNoteHeader">
          <div>
            <span className="projectDocumentsEyebrow">{t('שינוי סטטוס')}</span>
            <h3 id={`status-note-title-${project.id}`}>{t('הוספת הערה לעדכון')}</h3>
            <p className="muted">
              {t('{{value0}} ← {{value1}}', {
                value0: t(status),
                value1: t(project.status),
              })}
            </p>
          </div>
          <button
            type="button"
            className="ghost iconBtn"
            disabled={statusUpdating}
            onClick={() => setStatusDialogOpen(false)}
            aria-label={t('סגור')}
          >
            <X size={18} />
          </button>
        </div>
        <label>
          {t('הערה לעדכון, אופציונלי')}
          <textarea
            value={statusNote}
            disabled={statusUpdating}
            onChange={(event) => setStatusNote(event.target.value)}
            placeholder={t('הערה לעדכון, אופציונלי')}
          />
        </label>
        <div className="modalActions">
          <button
            type="button"
            disabled={statusUpdating}
            onClick={async () => {
              setStatusUpdating(true);
              try {
                const result = await updateStatus(project, status, statusNote);
                if (result?.ok) {
                  setStatusDialogOpen(false);
                  setStatusNote('');
                }
              } finally {
                setStatusUpdating(false);
              }
            }}
          >
            <MessageSquareText size={17} />
            {statusUpdating ? t('מעדכן...') : t('עדכן סטטוס')}
          </button>
          <button
            type="button"
            className="ghost"
            disabled={statusUpdating}
            onClick={() => setStatusDialogOpen(false)}
          >
            {t('ביטול')}
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
        className={`project status-${getStatusClass(project.status)} ${detailsOpen ? 'project-open' : 'project-closed'} ${isReviewSent ? 'projectReviewPending' : ''} ${isReviewCompleted ? 'projectReviewComplete' : ''}`}
      >
        <button
          type="button"
          className="projectCompactHeader"
          onClick={() =>
            setDetailsOpen((open) => {
              const nextOpen = !open;
              return nextOpen;
            })
          }
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
          </div>
        </button>

        {detailsOpen && (
          <div className="projectExpandedBody">
            <section className="projectOverviewPanel">
              <div className="projectOverviewSummary">
                <header className="projectOverviewHeadingRow">
                  <div>
                    <span className="projectDocumentsEyebrow">{t('פרטי הפרויקט')}</span>
                    <h3>{t('מידע נוסף')}</h3>
                  </div>
                  {isManager && (
                    <div
                      className="projectMoreActions"
                      onBlur={(event) => {
                        if (!event.currentTarget.contains(event.relatedTarget)) {
                          setMoreActionsOpen(false);
                        }
                      }}
                    >
                      <button
                        type="button"
                        className="ghost smallBtn projectMoreActionsButton"
                        aria-haspopup="menu"
                        aria-expanded={moreActionsOpen}
                        onClick={() => setMoreActionsOpen((open) => !open)}
                      >
                        <MoreHorizontal size={18} />
                        {t('פעולות נוספות')}
                      </button>
                      {moreActionsOpen && (
                        <div className="projectMoreActionsMenu" role="menu">
                          <button
                            type="button"
                            role="menuitem"
                            onClick={() => {
                              setMoreActionsOpen(false);
                              setEditing(true);
                            }}
                          >
                            <Pencil size={16} /> {t('עריכה')}
                          </button>
                          <button
                            type="button"
                            role="menuitem"
                            onClick={() => {
                              setMoreActionsOpen(false);
                              if (project.is_archived) restoreProject(project);
                              else archiveProject(project);
                            }}
                          >
                            {project.is_archived ? <RotateCcw size={16} /> : <Archive size={16} />}
                            {project.is_archived ? t('שחזור') : t('העבר לארכיון')}
                          </button>
                          <button
                            type="button"
                            role="menuitem"
                            onClick={() => {
                              setMoreActionsOpen(false);
                              exportProjectPdf({ ...project, ...assets }, projectHistory);
                            }}
                          >
                            <FileText size={16} /> {t('דוח PDF')}
                          </button>
                          <button
                            type="button"
                            role="menuitem"
                            className="danger"
                            onClick={() => {
                              setMoreActionsOpen(false);
                              deleteProject(project);
                            }}
                          >
                            <Trash2 size={16} /> {t('מחיקה')}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </header>

                <p className="projectOverviewDescription">
                  {project.description || t('אין תיאור')}
                </p>
                {project.additional_notes && (
                  <div className="projectAdditionalNotes">
                    <b>{t('הערות נוספות')}</b>
                    <p>{project.additional_notes}</p>
                  </div>
                )}

                <div className="projectOverviewAssignments">
                  <div>
                    <span>{t('עובד אחראי:')}</span>
                    <b>{project.profiles?.full_name || t('לא משויך')}</b>
                  </div>
                  {!!project.project_workers?.some(
                    (assignment) =>
                      !assignment.profiles?.role || assignment.profiles.role === 'field_worker',
                  ) && (
                    <div>
                      <span>{t('עובדים נוספים:')}</span>
                      <b>
                        {project.project_workers
                          .filter(
                            (assignment) =>
                              !assignment.profiles?.role ||
                              assignment.profiles.role === 'field_worker',
                          )
                          .map((assignment) => assignment.profiles?.full_name || t('עובד'))
                          .join(', ')}
                      </b>
                    </div>
                  )}
                  {assignedDrafterId && (
                    <div>
                      <span>{t('שרטט משויך:')}</span>
                      <b>
                        {project.project_workers?.find(
                          (assignment) => assignment.worker_id === assignedDrafterId,
                        )?.profiles?.full_name || t('שרטט')}
                      </b>
                    </div>
                  )}
                </div>
              </div>

              <div className="projectOverviewContact">
                <span className="projectDocumentsEyebrow">{t('פרטי קשר')}</span>
                <h3>{project.client_name || t('ללא לקוח')}</h3>
                <div className="projectOverviewLocation">{project.location}</div>
                <div className="projectContactLinks">
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
                </div>
                <div className="muted projectOverviewUpdated">
                  {t('עודכן:')}
                  {new Date(project.updated_at).toLocaleDateString('he-IL')}
                </div>
              </div>
            </section>

            <ProjectDocumentsPanel
              documents={assets.project_documents}
              canUpload={isManager || isAssignedFieldWorker}
              canDelete={(document) =>
                isManager || (isAssignedFieldWorker && document.uploaded_by === currentUserId)
              }
              defaultDocumentType={isAssignedFieldWorker ? 'drawing_source' : 'general'}
              onUpload={async (file, documentType) => {
                const result = await uploadProjectDocument(project, file, documentType);
                if (result?.ok) await refreshAssets();
                return result;
              }}
              onDelete={async (document) => {
                const result = await deleteProjectDocument(document, project);
                if (result) await refreshAssets();
              }}
            />

            <div className="projectOperationsPanel">
              <section className="projectOperationCard projectStatusCard">
                <header className="projectOperationHeader">
                  <span className="projectOperationIcon"><MessageSquareText size={20} /></span>
                  <div>
                    <b>{t('עדכון סטטוס')}</b>
                    <span>{t('בחר סטטוס חדש והוסף הערה לפי הצורך')}</span>
                  </div>
                </header>
                <div className="projectStatusActions">
                  <label className="projectOperationField">
                    <span>{t('סטטוס חדש')}</span>
                    <select value={status} onChange={(e) => setStatus(e.target.value)}>
                      {!status && <option value="">{t('בחירת סטטוס')}</option>}
                      {statusOptions.map((s) => (
                        <option key={s} value={s}>
                          {t(s)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    className="smallBtn"
                    disabled={!status || status === project.status}
                    onClick={() => setStatusDialogOpen(true)}
                  >
                    <MessageSquareText size={16} />
                    {t('המשך להערה ועדכון')}
                  </button>
                </div>
              </section>
            </div>

            <div className="projectSectionTabs" role="tablist" aria-label={t('פרטי הפרויקט')}>
              {[
                ['tasks', t('משימות'), (project.project_tasks || []).length],
                [
                  'documents',
                  t('מסמכים'),
                  assets.project_photos.length + assets.project_review_files.length,
                ],
                ['updates', t('עדכונים'), projectHistory.length],
              ].map(([tab, label, count]) => (
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeDetailTab === tab}
                  className={activeDetailTab === tab ? 'active' : ''}
                  key={tab}
                  onClick={() => setActiveDetailTab(tab)}
                >
                  <span>{label}</span>
                  <small>{count}</small>
                </button>
              ))}
            </div>

            {activeDetailTab === 'documents' && (
              <div className="projectTabPanel projectDocumentsTab" role="tabpanel">
                <section className="projectSectionPanel projectPhotoPanel">
                  <header className="projectSectionHeader">
                    <div>
                      <span className="projectDocumentsEyebrow">{t('תמונות מהשטח')}</span>
                      <h3>
                        <Camera size={18} /> {t('תמונות הפרויקט')}
                      </h3>
                    </div>
                    <span className="projectDocumentsCount">{assets.project_photos.length}</span>
                  </header>

                  <PhotoGallery
                    photos={assets.project_photos}
                    canDelete={isManager || isAssignedFieldWorker}
                    onDelete={async (photo) => {
                      await deletePhoto(photo, project);
                      await refreshAssets();
                    }}
                  />

                  {assetsLoading && <span className="muted">{t('טוען תמונות וקבצים...')}</span>}

                  <div className="photoUploadBox">
                    <label className="projectOperationField">
                      <span>{t('סוג תמונה')}</span>
                      <select
                        value={photoCategory}
                        onChange={(e) => setPhotoCategory(e.target.value)}
                        title={t('סוג תמונה')}
                      >
                        {photoCategories.map((category) => (
                          <option key={category} value={category}>
                            {t(category)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="projectPhotoUploadButton">
                      <Camera size={17} />
                      <span>{t('העלאת תמונה')}</span>
                      <input
                        className="photoInput"
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
                          e.target.value = '';
                        }}
                      />
                    </label>
                  </div>
                </section>

                {project.requires_work_diary && (
                  <WorkDiaryPanel
                    project={project}
                    currentUserName={currentUserName}
                    canDelete={isManager}
                  />
                )}

                {isManager && project.status === 'עבר לשרטוט' && (
                  <section className="projectSectionPanel drafterAssignmentBox">
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
                  canDelete={canManageReview}
                  onDelete={async (file) => {
                    await deleteProjectReviewFile(file, project.id);
                    await refreshAssets();
                  }}
                />

                {canManageReview && project.status === 'עבר לשרטוט' && (
                  <DrafterReviewBox
                    reviewFile={reviewFile}
                    setReviewFile={setReviewFile}
                    reviewNote={reviewNote}
                    setReviewNote={setReviewNote}
                    onSend={async () => {
                      if (!reviewFile) return { ok: false };
                      const result = await sendProjectToReview(project, reviewFile, reviewNote);
                      if (result?.ok) {
                        await refreshAssets();
                        setReviewFile(null);
                        setReviewNote('');
                      }
                      return result;
                    }}
                  />
                )}
              </div>
            )}

            {activeDetailTab === 'tasks' && (
              <div className="projectTabPanel" role="tabpanel">
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
              </div>
            )}

            {activeDetailTab === 'updates' && (
              <section className="projectTabPanel projectHistoryPanel" role="tabpanel">
                <header className="projectTabPanelHeader">
                  <b>{t('עדכונים אחרונים')}</b>
                  <small>
                    {projectHistory.length === 0
                      ? t('אין עדכונים')
                      : t('{{value0}} עדכונים', { value0: projectHistory.length })}
                  </small>
                </header>
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
              </section>
            )}
          </div>
        )}
      </article>
      {editModal && createPortal(editModal, document.body)}
      {statusModal && createPortal(statusModal, document.body)}
    </>
  );
}
