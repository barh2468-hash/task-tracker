import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../features/auth/useAuth.js';
import { projectDeepLinkPath } from '../utils/navigation.js';
import LiveMapPanel from '../features/map/components/LiveMapPanel.jsx';

export default function LiveMapPage() {
  const { canViewAll } = useAuth();
  const navigate = useNavigate();
  if (!canViewAll) return <Navigate to="/app/projects" replace />;
  return <LiveMapPanel onOpenProject={(project) => navigate(projectDeepLinkPath(project))} />;
}
