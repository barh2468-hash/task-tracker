import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../features/auth/useAuth.js';
import LiveMapPanel from '../features/map/components/LiveMapPanel.jsx';

export default function LiveMapPage() {
  const { isManager } = useAuth();
  const navigate = useNavigate();
  if (!isManager) return <Navigate to="/app/projects" replace />;
  return (
    <LiveMapPanel
      onOpenProject={(project) =>
        navigate(`/app/projects?filter=${project.is_archived ? 'archive' : 'all'}&project=${project.id}`)
      }
    />
  );
}
