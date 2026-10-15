import { useTranslation } from 'react-i18next';
import { t, useLanguage } from '../../language/LanguageContext.jsx';
import { localeForLanguage } from '../../language/locale.js';
import '../project-workspace.css';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Archive,
  Camera,
  ArrowRight,
  UserRound,
  FileText,
  LoaderCircle,
  Mail,
  MessageSquareText,
  MoreHorizontal,
  Pencil,
  PlusCircle,
  Phone,
  RotateCcw,
  Trash2,
  X,
} from 'lucide-react';
import { useAuth } from '../../auth/useAuth.js';
import { useProjects } from '../ProjectsContext.jsx';
import { isResultOk } from '../../../context/messageTone.js';
import {
  appStatuses,
  FIELD_WORKER_STATUSES,
  REVIEW_COMPLETED_STATUS,
  REVIEW_STATUS,
  roleLabel,
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
import ContinuationReportDialog from './ContinuationReportDialog.jsx';
import DrawingBatchesPanel from './DrawingBatchesPanel.jsx';
import ProjectHistoryPanel from './ProjectHistoryPanel.jsx';
import ProjectSectionTabs from './ProjectSectionTabs.jsx';
import useProjectDialog from '../hooks/useProjectDialog.js';
import { isManagerRole } from '../../../utils/roles.js';
import { getProjectTeamAssignments, isProjectTeamMember } from '../utils/assignments.js';

const photoCategories = [
  'תמונת שטח',
  'תשתית שנמצאה',
  'בעיה / חסם',
  'סימון בשטח',
  'אישור סיום',
  'אחר',
];

function buildEditForm(project) {
  return {
    name: project.name,
    client_name: project.client_name || '',
    location: project.location,
    contact_phone: project.contact_phone || '',
    contact_email: project.contact_email || '',
    description: project.description || '',
    additional_notes: project.additional_notes || '',
    assigned_to: project.assigned_to || '',
    assigned_workers: getProjectTeamAssignments(project).map((assignment) => assignment.worker_id),
    requires_work_diary: Boolean(project.requires_work_diary),
  };
}

export default function ProjectCard({ project, onBack }) {
  useTranslation();
  const { language } = useLanguage();
  const assignmentRef = useRef(null);
  const [assigning, setAssigning] = useState(false);
  const { profile, isManager, isDrafter, session } = useAuth();
  const {
    historyItems,
    workers,
    updateStatus,
    submitContinuationReport,
    updateDrawingBatchStatus,
    sendDrawingBatchToReview,
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

  const projectHistory = historyItems.filter((h) => h.project_id === project.id);
  const projectHistoryPreview = projectHistory.slice(0, 4);

  const statusOptions = profile?.role === 'field_worker' ? FIELD_WORKER_STATUSES : appStatuses;
  const [status, setStatus] = useState(
    statusOptions.includes(project.status) ? project.status : '',
  );
  const [statusNote, setStatusNote] = useState('');
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [continuationDialogOpen, setContinuationDialogOpen] = useState(false);
  const [continuationSubmitting, setContinuationSubmitting] = useState(false);
  const [photoCategory, setPhotoCategory] = useState(photoCategories[0]);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDescription, setTaskDescription] = useState('');
  const [reviewFiles, setReviewFiles] = useState([]);
  const [reviewNote, setReviewNote] = useState('');
  const [editing, setEditing] = useState(false);
  const [editSnapshot, setEditSnapshot] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [activeDetailTab, setActiveDetailTab] = useState('overview');
  const [moreActionsOpen, setMoreActionsOpen] = useState(false);
  const [editMenuOpen, setEditMenuOpen] = useState(false);
  const [assets, setAssets] = useState({
    project_photos: [],
    project_review_files: [],
    project_documents: [],
    project_drawing_batches: [],
  });
  const [assetsLoading, setAssetsLoading] = useState(false);
  const [assetsError, setAssetsError] = useState(false);
  const assignedDrafterId = findAssignedDrafter(project)?.worker_id || '';
  const [selectedDrafterId, setSelectedDrafterId] = useState(assignedDrafterId);
  const projectResponsibles = workers.filter(isProjectTeamMember);
  const teamAssignments = getProjectTeamAssignments(project);
  const drafters = workers.filter(isDrafterCandidate);
  const workerDirectoryById = new Map(workers.map((worker) => [worker.id, worker]));
  const responsibleWorkerName = project.assigned_to
    ? project.profiles?.full_name ||
      workerDirectoryById.get(project.assigned_to)?.full_name ||
      t('עובד אחראי')
    : t('לא משויך');
  const [editProject, setEditProject] = useState(() => buildEditForm(project));
  // Background polling replaces the project object even when its status is unchanged.
  // Only reset the dropdown when the persisted status itself actually changes.
  useEffect(() => {
    setStatus(statusOptions.includes(project.status) ? project.status : '');
  }, [project.status, statusOptions]);

  // Background polling replaces the project object every few seconds, so only
  // sync the edit form while it's closed; otherwise a refresh would wipe edits.
  useEffect(() => {
    if (!editing) setEditProject(buildEditForm(project));
  }, [editing, project]);

  useEffect(() => {
    setSelectedDrafterId(findAssignedDrafter(project)?.worker_id || '');
  }, [project]);

  // Project objects are replaced by the realtime/polling refresh even when the
  // project itself did not change. Keep selected review PDFs across those
  // refreshes so the native file input and React state cannot drift apart.
  useEffect(() => {
    setReviewFiles([]);
    setReviewNote('');
    setStatusDialogOpen(false);
    setContinuationDialogOpen(false);
    setStatusNote('');
    setActiveDetailTab('overview');
    setMoreActionsOpen(false);
  }, [project.id]);

  useEffect(() => {
    if (project.status === 'עבר לשרטוט') return;
    setReviewFiles([]);
    setReviewNote('');
  }, [project.status]);
  useEffect(() => {
    if (!editing && !statusDialogOpen && !continuationDialogOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [continuationDialogOpen, editing, statusDialogOpen]);

  function openEdit(assign = false) {
    const form = buildEditForm(project);
    setEditProject(form);
    setEditSnapshot(JSON.stringify(form));
    setAssigning(assign);
    setEditing(true);
  }

  async function refreshAssets() {
    setAssetsLoading(true);
    setAssetsError(false);
    try {
      setAssets(await loadProjectAssets(project.id));
    } catch {
      setAssetsError(true);
    } finally {
      setAssetsLoading(false);
    }
  }

  useEffect(() => {
    if (!navigator.onLine) return;
    refreshAssets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id]);

  const isAssignedFieldWorker =
    profile?.role === 'field_worker' &&
    (project.assigned_to === currentUserId ||
      (project.project_workers || []).some((assignment) => assignment.worker_id === currentUserId));
  const isReviewSent = project.status === REVIEW_STATUS;
  const canManageReview = isManager || isDrafter || isDrafterCandidate(profile);
  const canReportContinuation = !project.is_archived && (isManager || isAssignedFieldWorker);
  const canEditFieldData = isManager || (isAssignedFieldWorker && !project.is_archived);

  // A stray tap outside the modal must not throw away unsaved edits.
  const editDirty = editing && JSON.stringify(editProject) !== editSnapshot;
  const editDialogRef = useProjectDialog(
    editing,
    () => {
      if (!savingEdit && !editDirty) setEditing(false);
    },
    assigning ? assignmentRef : undefined,
  );
  const statusDialogRef = useProjectDialog(statusDialogOpen, () => {
    if (!statusUpdating) setStatusDialogOpen(false);
  });

  async function submitEdit() {
    if (savingEdit) return;
    setSavingEdit(true);
    try {
      const result = await saveProject(project.id, editProject);
      if (isResultOk(result)) setEditing(false);
    } finally {
      setSavingEdit(false);
    }
  }

  const editModal = editing ? (
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions -- backdrop click-to-close is a mouse convenience; the close button covers keyboard access
    <div
      className="modalBackdrop"
      ref={editDialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={t('עריכת פרויקט')}
      onClick={() => {
        if (!editDirty && !savingEdit) setEditing(false);
      }}
    >
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- stops the backdrop's close handler from firing for clicks inside the modal */}
      <div className="editModal projectDialogControls" onClick={(e) => e.stopPropagation()}>
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
            {t('שיוך לאחראי ראשי (מנהל או עובד שטח)')}

            <select
              ref={assignmentRef}
              value={editProject.assigned_to}
              onChange={(e) => setEditProject({ ...editProject, assigned_to: e.target.value })}
            >
              <option value="">{t('לא משויך')}</option>
              {projectResponsibles.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.full_name} - {w.email}
                  {isManagerRole(w.role) ? ` (${t(roleLabel[w.role])})` : ''}
                </option>
              ))}
            </select>
          </label>
          <label className="wideField">
            {t('עובדים נוספים בפרויקט')}

            <div className="workerChecks compactChecks">
              {projectResponsibles.map((w) => (
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
                  {isManagerRole(w.role) ? ` (${t(roleLabel[w.role])})` : ''}
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
        <div className="modalActions editModalActions">
          <button className="projectPrimaryAction" onClick={submitEdit} disabled={savingEdit}>
            {savingEdit ? t('שומר...') : t('שמור שינויים')}
          </button>
          <button className="ghost" onClick={() => setEditing(false)}>
            {t('ביטול')}
          </button>
          {/* Archive and delete are rare, so they live behind a menu instead of full-width buttons. */}
          <div
            className="projectMoreActions"
            onBlur={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget)) setEditMenuOpen(false);
            }}
          >
            <button
              type="button"
              className="ghost projectMoreActionsButton"
              aria-haspopup="menu"
              aria-expanded={editMenuOpen}
              aria-label={t('פעולות נוספות')}
              title={t('פעולות נוספות')}
              onClick={() => setEditMenuOpen((open) => !open)}
            >
              <MoreHorizontal size={20} />
            </button>
            {editMenuOpen && (
              <div className="projectMoreActionsMenu" role="menu">
                {project.is_archived ? (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setEditMenuOpen(false);
                      restoreProject(project);
                      setEditing(false);
                    }}
                  >
                    <RotateCcw size={16} />
                    {t('שחזור מהארכיון')}
                  </button>
                ) : (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setEditMenuOpen(false);
                      archiveProject(project);
                      setEditing(false);
                    }}
                  >
                    <Archive size={16} />
                    {t('העבר לארכיון')}
                  </button>
                )}
                <button
                  type="button"
                  role="menuitem"
                  className="danger"
                  onClick={() => {
                    setEditMenuOpen(false);
                    deleteProject(project);
                  }}
                >
                  <Trash2 size={16} />
                  {t('מחיקת פרויקט')}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  ) : null;

  const statusModal = statusDialogOpen ? (
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions -- backdrop click-to-close is a pointer convenience; the dialog has a keyboard-accessible close button
    <div
      className="modalBackdrop"
      ref={statusDialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={`status-note-title-${project.id}`}
      onClick={() => !statusUpdating && setStatusDialogOpen(false)}
    >
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- prevent backdrop dismissal for clicks inside the modal */}
      <div
        className="statusNoteModal projectDialogControls"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modalHeader statusNoteHeader">
          <div>
            <span className="projectDocumentsEyebrow">{t('שינוי סטטוס')}</span>
            <h3 id={`status-note-title-${project.id}`}>{t('עדכון סטטוס')}</h3>
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
          {t('סטטוס חדש')}
          <select
            value={status}
            disabled={statusUpdating}
            onChange={(event) => setStatus(event.target.value)}
          >
            {!status && <option value="">{t('בחירת סטטוס')}</option>}
            {statusOptions.map((value) => (
              <option key={value} value={value}>
                {t(value)}
              </option>
            ))}
          </select>
        </label>
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
            className="projectPrimaryAction"
            disabled={statusUpdating || !status || status === project.status}
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
      <article
        className={`project projectWorkspace status-${getStatusClass(project.status)}`}
        aria-labelledby={`project-title-${project.id}`}
      >
        <div className="projectWorkspaceTop">
          <button type="button" className="ghost projectBackButton" onClick={onBack}>
            <ArrowRight size={17} aria-hidden="true" /> {t('חזרה לרשימת הפרויקטים')}
          </button>
          <div className="projectWorkspaceTopMeta">
            <span className="muted">
              {t('עודכן:')}{' '}
              {new Date(project.updated_at).toLocaleDateString(localeForLanguage(language))}
            </span>
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
                  aria-label={t('פעולות נוספות')}
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
                        openEdit();
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
                        exportProjectPdf({ ...project, ...assets }, projectHistoryPreview);
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
          </div>
        </div>
        <header className="projectWorkspaceHeader">
          <h2 id={`project-title-${project.id}`} tabIndex={-1} dir="auto">
            {project.name}
          </h2>
          <p className="projectWorkspaceLocation" dir="auto">
            {project.location}
          </p>
          <div className="projectWorkspaceMeta">
            <StatusPill status={project.status} />
            {project.is_archived && <span className="archiveBadge">{t('בארכיון')}</span>}
            <span>
              <UserRound size={16} aria-hidden="true" /> {t('עובד אחראי:')}{' '}
              <bdi>{responsibleWorkerName}</bdi>
            </span>
          </div>
          <div className="projectWorkspaceActions">
            {isManager && !project.assigned_to && !project.is_archived ? (
              <button type="button" className="projectPrimaryAction" onClick={() => openEdit(true)}>
                <UserRound size={17} /> {t('שיוך עובד')}
              </button>
            ) : canReportContinuation ? (
              <button
                type="button"
                className="projectPrimaryAction"
                onClick={() => setContinuationDialogOpen(true)}
              >
                <PlusCircle size={17} /> {t('דיווח חדש לשרטוט')}
              </button>
            ) : null}
            {(!project.is_archived || isManager) && (
              <button type="button" className="ghost" onClick={() => setStatusDialogOpen(true)}>
                <MessageSquareText size={17} /> {t('עדכון סטטוס')}
              </button>
            )}
          </div>
        </header>
        <div className="projectExpandedBody">
          <ProjectSectionTabs>
            {[
              ['overview', t('סקירה כללית'), null],
              [
                'tasks',
                t('משימות'),
                (project.project_tasks || []).filter((task) => !task.is_done).length,
              ],
              [
                'documents',
                t('קבצים'),
                assets.project_photos.length + assets.project_documents.length,
              ],
              [
                'drawing-batches',
                t('שרטוט והגהה'),
                assets.project_drawing_batches.length + assets.project_review_files.length,
              ],
              ['updates', t('פעילות הפרויקט'), null],
            ].map(([tab, label, count]) => (
              <button
                type="button"
                role="tab"
                id={`project-${project.id}-tab-${tab}`}
                aria-selected={activeDetailTab === tab}
                aria-controls={`project-${project.id}-panel-${tab}`}
                tabIndex={activeDetailTab === tab ? 0 : -1}
                className={activeDetailTab === tab ? 'active' : ''}
                key={tab}
                onClick={() => setActiveDetailTab(tab)}
              >
                <span>{label}</span>
                {count > 0 && <small>{count.toLocaleString(localeForLanguage(language))}</small>}
              </button>
            ))}
          </ProjectSectionTabs>
          {assetsLoading && (
            <p className="projectAssetLoading" role="status">
              <LoaderCircle size={16} className="spinIcon" /> {t('טוען תמונות וקבצים...')}
            </p>
          )}
          {assetsError && (
            <div className="projectAssetLoading" role="alert">
              {t('טעינת קובצי הפרויקט נכשלה.')}{' '}
              <button type="button" className="ghost smallBtn" onClick={refreshAssets}>
                {t('נסה שוב')}
              </button>
            </div>
          )}
          <div
            className={`projectWorkspacePanel projectWorkspacePanel-${activeDetailTab}`}
            role="tabpanel"
            id={`project-${project.id}-panel-${activeDetailTab}`}
            aria-labelledby={`project-${project.id}-tab-${activeDetailTab}`}
          >
            {activeDetailTab === 'overview' && (
              <div className="projectOverviewGrid">
                <section className="projectOverviewWork">
                  <h3>{t('תיאור העבודה')}</h3>
                  <p className="projectWorkDescription" dir="auto">
                    {project.description || t('אין תיאור')}
                  </p>
                  {project.additional_notes && (
                    <details className="projectQuietDetails">
                      <summary>{t('הערות נוספות')}</summary>
                      <p dir="auto">{project.additional_notes}</p>
                    </details>
                  )}
                </section>
                <section className="projectOverviewTeam">
                  <header className="projectOverviewTeamHeader">
                    <h3>{t('צוות הפרויקט')}</h3>
                  </header>
                  <div className="projectOverviewAssignments">
                    <div>
                      <span>{t('עובד אחראי:')}</span>
                      <b>{responsibleWorkerName}</b>
                    </div>
                    {teamAssignments.length > 0 && (
                      <div>
                        <span>{t('עובדים נוספים:')}</span>
                        <b>
                          {teamAssignments
                            .map(
                              (assignment) =>
                                assignment.profiles?.full_name ||
                                workerDirectoryById.get(assignment.worker_id)?.full_name ||
                                t('עובד'),
                            )
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
                          )?.profiles?.full_name ||
                            workerDirectoryById.get(assignedDrafterId)?.full_name ||
                            t('שרטט')}
                        </b>
                      </div>
                    )}
                  </div>

                  {isManager && !project.is_archived && (
                    <section className="projectSectionPanel drafterAssignmentBox">
                      <label htmlFor={`project-drafter-${project.id}`}>
                        {t('שיוך הפרויקט לשרטט')}
                      </label>
                      <div className="projectDrafterControls">
                        <select
                          id={`project-drafter-${project.id}`}
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
                          onClick={async () => {
                            await assignProjectDrafter(project, selectedDrafterId);
                            await refreshAssets();
                          }}
                          className="projectPrimaryAction"
                          disabled={!drafters.length && !assignedDrafterId}
                        >
                          <Pencil size={16} />{' '}
                          {assignedDrafterId ? t('עדכון שיוך') : t('שיוך לשרטט')}
                        </button>
                      </div>
                    </section>
                  )}
                </section>
                <section className="projectContacts">
                  <h3>{t('פרטי קשר ולקוח')}</h3>
                  <p dir="auto">{project.client_name || t('ללא לקוח')}</p>
                  <div className="projectContactLinks">
                    {project.contact_phone && (
                      <a
                        className="phoneLink"
                        href={`tel:${project.contact_phone.replace(/[^0-9+]/g, '')}`}
                        title={t('התקשר לאיש קשר בשטח')}
                      >
                        <Phone size={15} aria-hidden="true" />
                        <bdi>{project.contact_phone}</bdi>
                      </a>
                    )}
                    {project.contact_email && (
                      <a
                        className="phoneLink"
                        href={`mailto:${project.contact_email}`}
                        title={t('שליחת מייל לאיש קשר בשטח')}
                      >
                        <Mail size={15} aria-hidden="true" />
                        <bdi>{project.contact_email}</bdi>
                      </a>
                    )}
                    {!project.contact_phone && !project.contact_email && (
                      <p>{t('לא הוגדרו פרטי קשר')}</p>
                    )}
                  </div>
                </section>
                <div className="projectBoundaryShortcut">
                  <FileText size={20} aria-hidden="true" />
                  <div>
                    <b>{t('סקיצת גבול עבודה')}</b>
                    <span>
                      {assets.project_documents.some(
                        (document) => document.document_type === 'boundary_sketch',
                      )
                        ? t('זמינה בלשונית הקבצים')
                        : assetsLoading
                          ? t('טוען...')
                          : t('טרם צורפה סקיצה')}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="ghost smallBtn"
                    onClick={() => setActiveDetailTab('documents')}
                  >
                    {t('פתיחת קבצים')}
                  </button>
                </div>
              </div>
            )}
            {activeDetailTab === 'documents' && (
              <div className="projectDocumentsTab">
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
                    canDelete={canEditFieldData}
                    onDelete={async (photo) => {
                      await deletePhoto(photo, project);
                      await refreshAssets();
                    }}
                  />

                  {assetsLoading && <span className="muted">{t('טוען תמונות וקבצים...')}</span>}

                  {canEditFieldData && (
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
                      <label
                        className={`projectPhotoUploadButton ${uploadingPhoto ? 'uploading' : ''}`}
                        aria-busy={uploadingPhoto}
                      >
                        {uploadingPhoto ? (
                          <LoaderCircle className="spinIcon" size={17} />
                        ) : (
                          <Camera size={17} />
                        )}
                        <span>{uploadingPhoto ? t('מעלה תמונה...') : t('העלאת תמונה')}</span>
                        <input
                          className="photoInput"
                          type="file"
                          accept="image/*"
                          disabled={uploadingPhoto}
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file || uploadingPhoto) return;
                            setUploadingPhoto(true);
                            try {
                              const result = await uploadPhoto(project.id, file, photoCategory);
                              if (!result?.offline) await refreshAssets();
                            } finally {
                              setUploadingPhoto(false);
                              e.target.value = '';
                            }
                          }}
                        />
                      </label>
                    </div>
                  )}
                </section>

                <ProjectDocumentsPanel
                  documents={assets.project_documents}
                  canUpload={canEditFieldData}
                  canDelete={(document) =>
                    isManager || (canEditFieldData && document.uploaded_by === currentUserId)
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

                {project.requires_work_diary && (
                  <WorkDiaryPanel
                    project={project}
                    currentUserName={currentUserName}
                    dialogClassName="projectDialogControls"
                    canDelete={isManager}
                    canCreate={isManager || !project.is_archived}
                  />
                )}
              </div>
            )}
            {activeDetailTab === 'tasks' && (
              <div className="projectTabPanel">
                <TaskPanel
                  tasks={project.project_tasks || []}
                  isManager={isManager}
                  canAddTasks={canEditFieldData}
                  canCompleteTasks={
                    isManager ||
                    (!project.is_archived &&
                      (project.assigned_to === currentUserId ||
                        !!project.project_workers?.some((w) => w.worker_id === currentUserId)))
                  }
                  showTaskForm={showTaskForm}
                  setShowTaskForm={setShowTaskForm}
                  taskTitle={taskTitle}
                  setTaskTitle={setTaskTitle}
                  taskDescription={taskDescription}
                  setTaskDescription={setTaskDescription}
                  onAdd={async () => {
                    const result = await addProjectTask(project.id, taskTitle, taskDescription);
                    if (!isResultOk(result)) return;
                    setTaskTitle('');
                    setTaskDescription('');
                    setShowTaskForm(false);
                  }}
                  onToggle={(task) => toggleProjectTask(task, project)}
                  onDelete={deleteProjectTask}
                />
              </div>
            )}

            {activeDetailTab === 'drawing-batches' && (
              <div className="projectDrawingsTab">
                {canReportContinuation && (
                  <div className="projectDrawingAction">
                    <p>{t('כל סבב מתקדם בנפרד מסטטוס הפרויקט')}</p>
                    <button
                      type="button"
                      className="projectPrimaryAction"
                      onClick={() => setContinuationDialogOpen(true)}
                    >
                      <PlusCircle size={17} /> {t('דיווח חדש לשרטוט')}
                    </button>
                  </div>
                )}
                <DrawingBatchesPanel
                  batches={assets.project_drawing_batches}
                  documents={assets.project_documents}
                  reviewFiles={assets.project_review_files}
                  currentUserId={currentUserId}
                  isManager={isManager}
                  isAssignedFieldWorker={isAssignedFieldWorker}
                  canManageReview={canManageReview}
                  onUpdateStatus={async (drawingBatch, newStatus) => {
                    const result = await updateDrawingBatchStatus(project, drawingBatch, newStatus);
                    if (result?.ok) await refreshAssets();
                    return result;
                  }}
                  onSendToReview={async (drawingBatch, files, note) => {
                    const result = await sendDrawingBatchToReview(
                      project,
                      drawingBatch,
                      files,
                      note,
                    );
                    if (result?.ok) await refreshAssets();
                    return result;
                  }}
                  onDeleteReviewFile={async (file) => {
                    await deleteProjectReviewFile(file, project.id);
                    await refreshAssets();
                  }}
                />

                <ReviewFilesPanel
                  files={assets.project_review_files.filter((file) => !file.drawing_batch_id)}
                  canDelete={canManageReview}
                  onDelete={async (file) => {
                    await deleteProjectReviewFile(file, project.id);
                    await refreshAssets();
                  }}
                  canApprove={isReviewSent}
                  onApprove={() => updateStatus(project, REVIEW_COMPLETED_STATUS, '')}
                />

                {canManageReview && project.status === 'עבר לשרטוט' && (
                  <DrafterReviewBox
                    reviewFiles={reviewFiles}
                    setReviewFiles={setReviewFiles}
                    reviewNote={reviewNote}
                    setReviewNote={setReviewNote}
                    onSend={async () => {
                      if (!reviewFiles.length) return { ok: false };
                      const result = await sendProjectToReview(project, reviewFiles, reviewNote);
                      if (result?.ok) {
                        await refreshAssets();
                        setReviewFiles([]);
                        setReviewNote('');
                      }
                      return result;
                    }}
                  />
                )}
              </div>
            )}
            {activeDetailTab === 'updates' && (
              <ProjectHistoryPanel
                projectId={project.id}
                fallbackItems={projectHistory}
                refreshKey={historyItems[0]?.id || ''}
              />
            )}
          </div>
        </div>
      </article>
      {editModal && createPortal(editModal, document.body)}
      {statusModal && createPortal(statusModal, document.body)}
      {continuationDialogOpen &&
        createPortal(
          <ContinuationReportDialog
            project={project}
            submitting={continuationSubmitting}
            onClose={() => setContinuationDialogOpen(false)}
            onSubmit={async (report) => {
              setContinuationSubmitting(true);
              try {
                const result = await submitContinuationReport(project, report);
                if (result?.ok) {
                  await refreshAssets();
                  setContinuationDialogOpen(false);
                  setActiveDetailTab('drawing-batches');
                }
              } finally {
                setContinuationSubmitting(false);
              }
            }}
          />,
          document.body,
        )}
    </>
  );
}
