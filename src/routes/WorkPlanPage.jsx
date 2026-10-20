import { useAuth } from '../features/auth/useAuth.js';
import { useProjects } from '../features/projects/ProjectsContext.jsx';
import DailyWorkPlan from '../features/work-planning/DailyWorkPlan.jsx';

export default function WorkPlanPage() {
  const { profile, isManager } = useAuth();
  const { workers, projects, projectsLoaded } = useProjects();
  return <DailyWorkPlan key={profile.id} storageScope={profile.id} workers={workers} projects={projects}
    projectsReady={projectsLoaded} canEdit={isManager} shared />;
}
