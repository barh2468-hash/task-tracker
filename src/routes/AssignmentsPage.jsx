import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../features/auth/useAuth.js';
import { projectDeepLinkPath } from '../utils/navigation.js';
import WorkerAssignmentsPanel from '../features/projects/components/WorkerAssignmentsPanel.jsx';
import { assignmentProjectState } from '../features/projects/utils/assignmentNavigation.js';

export default function AssignmentsPage() {
  const { canViewAll } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  if (!canViewAll) return <Navigate to="/app/projects" replace />;
  return (
    <WorkerAssignmentsPanel
      restoreState={location.state?.assignmentListRestore}
      onOpenProject={(project, focusId) =>
        navigate(projectDeepLinkPath(project), {
          state: assignmentProjectState(location.search, window.scrollY, focusId),
        })
      }
    />
  );
}
