import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../features/auth/useAuth.js';
import { projectDeepLinkPath } from '../utils/navigation.js';
import OpenTasksPanel from '../features/projects/components/OpenTasksPanel.jsx';

export default function TasksPage() {
  const { isDrafter } = useAuth();
  const navigate = useNavigate();
  if (isDrafter) return <Navigate to="/app/projects" replace />;
  return <OpenTasksPanel onOpenProject={(project) => navigate(projectDeepLinkPath(project))} />;
}
