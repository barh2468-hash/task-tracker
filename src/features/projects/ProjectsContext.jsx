import { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from '../auth/useAuth.js';
import { useMessage } from '../../context/MessageContext.jsx';
import { supabase } from '../../services/supabase.js';
import * as profilesApi from '../../services/api/profiles.js';
import * as projectsFeatureApi from './api.js';
import { useNotifications } from '../notifications/NotificationsContext.jsx';

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
      setProjects(await projectsFeatureApi.getProjects(profile));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    }
  }

  async function loadWorkers() {
    const { data, error } = isManager
      ? await profilesApi.getAllProfiles()
      : await profilesApi.getWorkerDirectory();
    if (error) {
      setMessage(error.message);
      setWorkers([]);
      return;
    }
    setWorkers(data || []);
  }

  async function loadHistory() {
    setHistoryItems(await projectsFeatureApi.getHistory());
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

  useEffect(() => {
    if (!profile) return;
    const channel = supabase
      .channel('infrastructure-tracker-projects')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, () => loadProjects())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'status_history' }, () => loadHistory())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'project_photos' }, () => loadProjects())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'project_tasks' }, () => loadProjects())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'work_sessions' }, () => loadProjects())
      .subscribe();
    return () => supabase.removeChannel(channel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  async function runMutation(promise) {
    const result = await promise;
    if (result?.message) setMessage(result.message);
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
    createProject: (newProject) => runMutation(projectsFeatureApi.createProject(newProject, profile)),
    saveProject: (projectId, changes) => {
      const originalProject = projects.find((item) => item.id === projectId);
      return runMutation(projectsFeatureApi.saveProject(projectId, changes, profile, originalProject));
    },
    deleteProject: (project) => runMutation(projectsFeatureApi.deleteProject(project, profile)),
    archiveProject: (project) => runMutation(projectsFeatureApi.archiveProject(project, profile)),
    restoreProject: (project) => runMutation(projectsFeatureApi.restoreProject(project, profile)),
    updateStatus: (project, newStatus, note) => runMutation(projectsFeatureApi.updateStatus(project, newStatus, note, profile)),
    uploadPhoto: (projectId, file, category) => runMutation(projectsFeatureApi.uploadPhoto(projectId, file, category)),
    assignProjectDrafter: (project, drafterId) =>
      runMutation(projectsFeatureApi.assignProjectDrafter(project, drafterId, profile, workers)),
    sendProjectToReview: (project, file, note) => runMutation(projectsFeatureApi.sendProjectToReview(project, file, note, profile)),
    deleteProjectReviewFile: (file, projectId) =>
      runMutation(projectsFeatureApi.deleteProjectReviewFile(file, projectId, profile)),
    addProjectTask: (projectId, title, description) => {
      const project = projects.find((p) => p.id === projectId);
      return runMutation(projectsFeatureApi.addProjectTask(projectId, title, description, profile, project));
    },
    toggleProjectTask: (task, project) => runMutation(projectsFeatureApi.toggleProjectTask(task, project, profile, isManager)),
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
