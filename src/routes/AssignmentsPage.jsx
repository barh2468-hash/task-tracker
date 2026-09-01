import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../features/auth/useAuth.js';
import { projectDeepLinkPath } from '../utils/navigation.js';
import WorkerAssignmentsPanel from '../features/projects/components/WorkerAssignmentsPanel.jsx';

export default function AssignmentsPage() {
  const { isManager } = useAuth();
  const navigate = useNavigate();
  if (!isManager) return <Navigate to="/app/projects" replace />;
  return <WorkerAssignmentsPanel onOpenProject={(project) => navigate(projectDeepLinkPath(project))} />;
}
