import { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from '../auth/useAuth.js';
import { useMessage } from '../../context/MessageContext.jsx';
import { useRealtimeRefresh } from '../../hooks/useRealtimeRefresh.js';
import * as profilesApi from '../../services/api/profiles.js';
import * as projectsFeatureApi from './api.js';
import { useNotifications } from '../notifications/NotificationsContext.jsx';
import { cacheOfflineData, getOfflineData } from '../../services/offlineStore.js';

const ProjectsContext = createContext(null);

export function ProjectsProvider({ children }) {
  const { profile, isManager } = useAuth();
  const { setMessage } = useMessage();
  const { loadNotifications } = useNotifications();
  const [projects, setProjects] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [historyItems, setHistoryItems] = useState([]);

  async function loadProjects() {
    try {
      const data = await projectsFeatureApi.getProjects(profile);
      setProjects(data);
      await cacheOfflineData(`projects:${profile?.id}`, data);
    } catch (error) {
      const cached = await getOfflineData(`projects:${profile?.id}`);
      if (cached) {
        setProjects(cached);
        if (!navigator.onLine) setMessage('אין חיבור. מוצגים נתוני הפרויקטים האחרונים שנשמרו במכשיר.');
      } else {
        setMessage(error instanceof Error ? error.message : String(error));
      }
    }
  }

  async function loadWorkers() {
    const { data, error } = isManager
      ? await profilesApi.getAllProfiles()
      : await profilesApi.getWorkerDirectory();
    if (error) {
      const cached = await getOfflineData(`workers:${profile?.id}`);
      if (cached) setWorkers(cached);
      else {
        setMessage(error.message);
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
    if (!profile) {
      setProjects([]);
      setWorkers([]);
      setHistoryItems([]);
      return;
    }
    loadProjects();
    loadWorkers();
    loadHistory();
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

  async function runMutation(promise, applyOptimistic) {
    const result = await promise;
    if (result?.message) setMessage(result.message);
    if (result?.offline) {
      applyOptimistic?.(result);
      return result;
    }
    await Promise.all([loadProjects(), loadHistory(), loadNotifications()]);
    return result;
  }

  const value = {
    projects,
    workers,
    historyItems,
    loadProjects,
    loadWorkers,
    loadHistory,
    loadProjectAssets: projectsFeatureApi.getProjectAssets,
    createProject: (newProject) => runMutation(projectsFeatureApi.createProject(newProject, profile)),
    saveProject: (projectId, changes) => {
      const originalProject = projects.find((item) => item.id === projectId);
      return runMutation(projectsFeatureApi.saveProject(projectId, changes, profile, originalProject));
    },
    deleteProject: (project) => runMutation(projectsFeatureApi.deleteProject(project, profile)),
    archiveProject: (project) => runMutation(projectsFeatureApi.archiveProject(project, profile)),
    restoreProject: (project) => runMutation(projectsFeatureApi.restoreProject(project, profile)),
    updateStatus: (project, newStatus, note) => runMutation(
      projectsFeatureApi.updateStatus(project, newStatus, note, profile),
      (result) => setProjects((items) => items.map((item) => item.id === project.id ? { ...item, ...result.optimistic } : item)),
    ),
    uploadPhoto: (projectId, file, category) => runMutation(projectsFeatureApi.uploadPhoto(projectId, file, category)),
    deletePhoto: (photo, project) => runMutation(projectsFeatureApi.deletePhoto(photo, project, profile)),
    assignProjectDrafter: (project, drafterId) =>
      runMutation(projectsFeatureApi.assignProjectDrafter(project, drafterId, profile, workers)),
    sendProjectToReview: (project, file, note) => runMutation(projectsFeatureApi.sendProjectToReview(project, file, note, profile)),
    deleteProjectReviewFile: (file, projectId) =>
      runMutation(projectsFeatureApi.deleteProjectReviewFile(file, projectId, profile)),
    addProjectTask: (projectId, title, description) => {
      const project = projects.find((p) => p.id === projectId);
      return runMutation(
        projectsFeatureApi.addProjectTask(projectId, title, description, profile, project),
        (result) => setProjects((items) => items.map((item) => item.id === projectId ? { ...item, project_tasks: [result.offlineTask, ...(item.project_tasks || [])] } : item)),
      );
    },
    toggleProjectTask: (task, project) => runMutation(
      projectsFeatureApi.toggleProjectTask(task, project, profile, isManager),
      (result) => setProjects((items) => items.map((item) => item.id === project.id ? { ...item, project_tasks: (item.project_tasks || []).map((entry) => entry.id === task.id ? { ...entry, ...result.optimistic } : entry) } : item)),
    ),
    updateProjectTask: (task, project, title, description) =>
      runMutation(projectsFeatureApi.updateProjectTask(task, project, title, description, profile)),
    deleteProjectTask: (task) => runMutation(projectsFeatureApi.deleteProjectTask(task, profile)),
  };

  return <ProjectsContext.Provider value={value}>{children}</ProjectsContext.Provider>;
}

export function useProjects() {
  const ctx = useContext(ProjectsContext);
  if (!ctx) throw new Error('useProjects must be used within a ProjectsProvider');
  return ctx;
}
