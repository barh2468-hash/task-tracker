import { Navigate } from 'react-router-dom';
import { useAuth } from '../features/auth/useAuth.js';
import RecentStatusChangesPanel from '../features/reporting/components/RecentStatusChangesPanel.jsx';

export default function RecentStatusChangesPage() {
  const { isManager } = useAuth();
  if (!isManager) return <Navigate to="/app/projects" replace />;
  return <RecentStatusChangesPanel />;
}
