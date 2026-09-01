import { Navigate } from 'react-router-dom';
import { useAuth } from '../features/auth/useAuth.js';
import WorkReportPanel from '../features/reporting/components/WorkReportPanel.jsx';

export default function WorkReportPage() {
  const { isManager } = useAuth();
  if (!isManager) return <Navigate to="/app/projects" replace />;
  return <WorkReportPanel />;
}
