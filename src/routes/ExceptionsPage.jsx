import { Navigate } from 'react-router-dom';
import { useAuth } from '../features/auth/useAuth.js';
import ExceptionsPanel from '../features/reporting/components/ExceptionsPanel.jsx';

export default function ExceptionsPage() {
  const { isDrafter } = useAuth();
  if (isDrafter) return <Navigate to="/app/projects" replace />;
  return <ExceptionsPanel />;
}
