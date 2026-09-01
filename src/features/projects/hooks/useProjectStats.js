import { useMemo } from 'react';
import { useProjects } from '../ProjectsContext.jsx';
import { REVIEW_STATUS } from '../../../services/supabase.js';
import { buildProjectExceptions } from '../../reporting/utils/exceptions.js';

export function useProjectStats() {
  const { projects } = useProjects();

  const activeProjects = useMemo(() => projects.filter((p) => !p.is_archived), [projects]);
  const archivedProjects = useMemo(() => projects.filter((p) => p.is_archived), [projects]);

  const stats = useMemo(
    () => ({
      total: activeProjects.length,
      field: activeProjects.filter((p) => p.status === 'בעבודה בשטח').length,
      gpr: activeProjects.filter((p) => p.status === 'נדרש GPR').length,
      drafting: activeProjects.filter((p) => p.status === 'עבר לשרטוט').length,
      review: activeProjects.filter((p) => p.status === REVIEW_STATUS).length,
      done: activeProjects.filter((p) => p.status === 'הושלם').length,
      unassigned: activeProjects.filter((p) => !p.assigned_to).length,
      archived: archivedProjects.length,
      openTasks: activeProjects.reduce((sum, p) => sum + (p.project_tasks || []).filter((t) => !t.is_done).length, 0),
      activeWork: activeProjects.reduce((sum, p) => sum + (p.work_sessions || []).filter((w) => !w.ended_at).length, 0),
      exceptions: buildProjectExceptions(activeProjects).length,
    }),
    [activeProjects, archivedProjects],
  );

  return { activeProjects, archivedProjects, stats };
}
