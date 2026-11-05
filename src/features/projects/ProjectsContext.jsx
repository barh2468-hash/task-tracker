import { t } from '../language/LanguageContext.jsx';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useAuth } from '../auth/useAuth.js';
import { useMessage } from '../../context/MessageContext.jsx';
import { resultTone } from '../../context/messageTone.js';
import { useRealtimeRefresh } from '../../hooks/useRealtimeRefresh.js';
import * as profilesApi from '../../services/api/profiles.js';
import * as projectsFeatureApi from './api.js';
import { useNotifications } from '../notifications/NotificationsContext.jsx';
import { cacheOfflineData, getOfflineData } from '../../services/offlineStore.js';
import TaskExecutionDialog from './task-reports/TaskExecutionDialog.jsx';
import { finishProjectMutation } from './mutations.js';
import { createProjectLoader, emptyProjectSnapshot, projectOwner } from './projectLoader.js';

const ProjectsContext = createContext(null);

export function ProjectsProvider({ children }) {
  const { profile, isManager } = useAuth();
  const { setMessage } = useMessage();
  const { loadNotifications } = useNotifications();
  const [projectSnapshot, setProjectSnapshot] = useState(emptyProjectSnapshot);
  const [projectLoader] = useState(() => createProjectLoader({
    read: projectsFeatureApi.getProjects, readCache: getOfflineData,
    writeCache: cacheOfflineData, publish: setProjectSnapshot,
  }));
  const currentSnapshot = projectSnapshot.owner === projectOwner(profile)
    ? projectSnapshot : emptyProjectSnapshot;
  const { projects, loading: projectsLoading, settled: projectsLoaded,
    verified: projectsVerified, error: projectsError } = currentSnapshot;
  const setProjects = projectLoader.setProjects;
  const [workers, setWorkers] = useState([]);
  const [historyItems, setHistoryItems] = useState([]);
  const [reportTarget, setReportTarget] = useState(null);
  const loadProjectAssets = useCallback(
    (projectId) => projectsFeatureApi.getProjectAssets(projectId, profile?.id), [profile?.id],
  );
  useEffect(() => {
    const requireReport = (event) => {
      if (event.detail.history?.changed_by !== profile?.id) return;
      const project = projects.find((item) => item.project_tasks?.some((task) => task.id === event.detail.taskId));
      const task = project?.project_tasks.find((item) => item.id === event.detail.taskId);
      if (task) {
        setMessage(t('יש למלא דיווח ביצוע כדי להשלים משימה.'), 'info');
        setReportTarget((current) => current || { project, task });
      }
    };
    window.addEventListener('maya-task-report-required', requireReport);
    return () => window.removeEventListener('maya-task-report-required', requireReport);
  }, [profile?.id, projects, setMessage]);

  function loadProjects() {
    return projectLoader.load(profile);
  }

  async function loadWorkers() {
    const { data, error } = isManager
      ? await profilesApi.getAllProfiles()
      : await profilesApi.getWorkerDirectory();
    if (error) {
      const cached = await getOfflineData(`workers:${profile?.id}`);
      if (cached) setWorkers(cached);
      else {
        setMessage(error.message, 'error');
        setWorkers([]);
      }
      return;
    }
    const nextWorkers = data || [];
    setWorkers(nextWorkers);
    await cacheOfflineData(`workers:${profile?.id}`, nextWorkers);
  }

  async function loadHistory() {
    try {
      const data = await projectsFeatureApi.getHistory();
      setHistoryItems(data);
      await cacheOfflineData(`history:${profile?.id}`, data);
    } catch {
      setHistoryItems((await getOfflineData(`history:${profile?.id}`)) || []);
    }
  }

  useEffect(() => {
    projectLoader.activate(profile);
    if (!profile) {
      setWorkers([]);
      setHistoryItems([]);
      return;
    }
    loadProjects();
    loadWorkers();
    loadHistory();
    return () => projectLoader.cancel();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  useRealtimeRefresh({
    enabled: Boolean(profile),
    channelName: 'infrastructure-tracker-projects',
    tables: [
      'projects',
      'status_history',
      'project_photos',
      'project_tasks',
      'project_workers',
      'project_review_files',
      'project_documents',
      'project_drawing_batches',
      'project_drawing_batch_events',
      'work_sessions',
      'profiles',
    ],

    onRefresh: () => Promise.all([loadProjects(), loadWorkers(), loadHistory()]),
    pollIntervalMs: 20000,
  });

  useEffect(() => {
    const reload = () => Promise.all([loadProjects(), loadHistory()]);
    window.addEventListener('maya-data-synced', reload);
    return () => window.removeEventListener('maya-data-synced', reload);
  });

  function runMutation(promise, applyOptimistic, background = false) {
    return finishProjectMutation(promise, {
      notify: (result) => setMessage(result.message, resultTone(result)),
      refresh: () => Promise.all([loadProjects(), loadHistory(), loadNotifications()]),
      applyOptimistic, background,
    });
  }

  async function runStatusMutation(project, newStatus, note) {
    const result = await projectsFeatureApi.updateStatus(project, newStatus, note, profile);
    if (result?.message) setMessage(result.message, resultTone(result));
    if (result?.optimistic) {
      setProjects((items) =>
        items.map((item) =>
          item.id === project.id ? { ...item, ...result.optimistic } : item,
        ),
      );
    }
    if (!result?.offline && result?.ok) {
      void loadHistory();
    }
    return result;
  }

  const value = {
    projects,
    projectsLoaded,
    projectsLoading,
    projectsVerified,
    projectsError,
    workers,
    historyItems,
    loadProjects,
    loadWorkers,
    loadHistory,
    loadProjectHistory: projectsFeatureApi.getProjectHistory,
    loadProjectAssets,
    createProject: (newProject) =>
      runMutation(projectsFeatureApi.createProject(newProject, profile)),
    saveProject: (projectId, changes) => {
      const originalProject = projects.find((item) => item.id === projectId);
      return runMutation(
        projectsFeatureApi.saveProject(projectId, changes, profile, originalProject),
      );
    },
    deleteProject: (project) => runMutation(projectsFeatureApi.deleteProject(project, profile)),
    archiveProject: (project) => runMutation(projectsFeatureApi.archiveProject(project, profile)),
    restoreProject: (project) => runMutation(projectsFeatureApi.restoreProject(project, profile)),
    updateStatus: runStatusMutation,
    submitContinuationReport: (project, report) =>
      runMutation(projectsFeatureApi.submitContinuationReport(project, report, profile), undefined, true),
    updateDrawingBatchStatus: (project, drawingBatch, newStatus) =>
      runMutation(
        projectsFeatureApi.updateDrawingBatchStatus(
          project,
          drawingBatch,
          newStatus,
          profile,
        ),
      ),
    sendDrawingBatchToReview: (project, drawingBatch, files, note) =>
      runMutation(
        projectsFeatureApi.sendDrawingBatchToReview(
          project,
          drawingBatch,
          files,
          note,
          profile,
        ),
      ),
    uploadPhoto: (projectId, file, category) =>
      runMutation(projectsFeatureApi.uploadPhoto(projectId, file, category)),
    deletePhoto: (photo, project) =>
      runMutation(projectsFeatureApi.deletePhoto(photo, project, profile)),
    uploadProjectDocument: (project, file, documentType, options) =>
      runMutation(projectsFeatureApi.uploadProjectDocument(project, file, profile, documentType, options)),
    deleteProjectDocument: (projectDocument, project) =>
      runMutation(projectsFeatureApi.deleteProjectDocument(projectDocument, project, profile)),
    assignProjectDrafter: (project, drafterId) =>
      runMutation(projectsFeatureApi.assignProjectDrafter(project, drafterId, profile, workers)),
    sendProjectToReview: (project, files, note) =>
      runMutation(projectsFeatureApi.sendProjectToReview(project, files, note, profile)),
    deleteProjectReviewFile: (file, projectId) =>
      runMutation(projectsFeatureApi.deleteProjectReviewFile(file, projectId, profile)),
    addProjectTask: (projectId, title, description) => {
      const project = projects.find((p) => p.id === projectId);
      return runMutation(
        projectsFeatureApi.addProjectTask(projectId, title, description, profile, project),
        (result) =>
          setProjects((items) =>
            items.map((item) =>
              item.id === projectId
                ? { ...item, project_tasks: [result.offlineTask, ...(item.project_tasks || [])] }
                : item,
            ),
          ),
      );
    },
    toggleProjectTask: (task, project) => setReportTarget({ task, project }),
    updateProjectTask: (task, project, title, description) =>
      runMutation(projectsFeatureApi.updateProjectTask(task, project, title, description, profile)),
    deleteProjectTask: (task) => runMutation(projectsFeatureApi.deleteProjectTask(task, profile)),
  };

  async function submitReport(report) {
    const { task, project } = reportTarget;
    const result = await runMutation(projectsFeatureApi.submitTaskExecutionReport(task, project, report, profile),
      (queued) => setProjects((items) => items.map((item) => item.id === project.id ? {
        ...item, project_tasks: item.project_tasks.map((entry) => entry.id === task.id ? { ...entry, ...queued.optimistic } : entry),
      } : item)), true);
    if (result?.ok) {
      setReportTarget(null);
      if (!result.offline && report.outcome === 'completed' && project.project_tasks.every((item) => item.id === task.id || item.is_done)
        && ['בעבודה בשטח','נדרש GPR','מחכה להיתרים'].includes(project.status)) {
        window.setTimeout(() => {
          if (window.confirm(t('כל המשימות בפרויקט הושלמו. אם כל עבודת השטח הסתיימה, האם להעביר את הפרויקט לשרטוט?')))
            void runStatusMutation(project, 'עבר לשרטוט', report.summary);
        }, 0);
      }
    }
    return result;
  }
  return <ProjectsContext.Provider value={value}>{children}
    {reportTarget && <TaskExecutionDialog key={reportTarget.task.id} {...reportTarget} loadAssets={projectsFeatureApi.getProjectAssets}
      onClose={() => setReportTarget(null)} onSubmit={submitReport} />}
  </ProjectsContext.Provider>;
}

export function useProjects() {
  const ctx = useContext(ProjectsContext);
  if (!ctx) throw new Error('useProjects must be used within a ProjectsProvider');
  return ctx;
}
