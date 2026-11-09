import { Navigate } from 'react-router-dom';
import { useAuth } from '../features/auth/useAuth.js';
import RecentStatusChangesPanel from '../features/reporting/components/RecentStatusChangesPanel.jsx';

export default function RecentStatusChangesPage() {
  const { canViewAll } = useAuth();
  if (!canViewAll) return <Navigate to="/app/projects" replace />;
  return <RecentStatusChangesPanel />;
}
