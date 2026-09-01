import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../features/auth/useAuth.js';
import OpenTasksPanel from '../features/projects/components/OpenTasksPanel.jsx';

export default function TasksPage() {
  const { isDrafter, isManager } = useAuth();
  const navigate = useNavigate();
  if (isDrafter) return <Navigate to="/app/projects" replace />;
  return (
    <OpenTasksPanel
      onOpenProject={(project) =>
        navigate(`/app/projects?filter=${project.is_archived ? 'archive' : isManager ? 'all' : 'mine'}&project=${project.id}`)
      }
    />
  );
}
