import { compareProjectsByOrderNumber, getProjectOrderNumber } from '../projects/utils/projectOrderNumber.js';

// ProjectsProvider and the database already restrict the input to accessible projects.
export function getSheetProjectOptions(projects, userId, role) {
  if (!userId || !role) return [];
  return projects
    .filter(project => {
      if (project.is_archived || !project.id || !project.name) return false;
      if (role !== 'field_worker') return true;
      return project.assigned_to === userId || (project.project_workers || []).some(worker => worker.worker_id === userId);
    })
    .sort(compareProjectsByOrderNumber)
    .map(project => {
      const order = getProjectOrderNumber(project);
      const suffix = [order && !project.name.includes(order) ? order : '', project.location].filter(Boolean).join(' · ');
      return { id: project.id, name: project.name, label: suffix ? `${project.name} · ${suffix}` : project.name };
    });
}
