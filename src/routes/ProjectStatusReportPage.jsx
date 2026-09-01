import { Navigate } from 'react-router-dom';
import { useAuth } from '../features/auth/useAuth.js';
import ProjectStatusReport from '../features/projects/components/ProjectStatusReport.jsx';

export default function ProjectStatusReportPage() {
  const { isManager } = useAuth();
  if (!isManager) return <Navigate to="/app/projects" replace />;
  return <ProjectStatusReport />;
}
