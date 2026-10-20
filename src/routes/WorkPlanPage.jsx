import { lazy, Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../features/auth/useAuth.js';
import { useProjects } from '../features/projects/ProjectsContext.jsx';
import DailyWorkPlan from '../features/work-planning/DailyWorkPlan.jsx';
import { t } from '../features/language/LanguageContext.jsx';

const WorkbookWorkPlan = import.meta.env.DEV ? lazy(() => import('../features/work-planning/WorkbookWorkPlan.jsx')) : null;

export default function WorkPlanPage() {
  useTranslation();
  const { profile, isManager } = useAuth();
  const { workers, projects, projectsLoaded } = useProjects();
  if (WorkbookWorkPlan && isManager) {
    return <Suspense fallback={<p role="status">{t('workPlan.loading')}</p>}>
      <WorkbookWorkPlan key={profile.id} storageScope={profile.id} workers={workers} projects={projects} projectsReady={projectsLoaded} />
    </Suspense>;
  }
  return <DailyWorkPlan key={profile.id} storageScope={profile.id} workers={workers} projects={projects} projectsReady={projectsLoaded} canEdit={isManager} />;
}
