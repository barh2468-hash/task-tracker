import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../features/auth/useAuth.js';
import NewProjectForm from '../features/projects/components/NewProjectForm.jsx';

export default function NewProjectPage() {
  const { isManager, isAdmin } = useAuth();
  const { state } = useLocation();
  if (!isManager) return <Navigate to="/app/projects" replace />;
  return (
    <NewProjectForm
      initialProject={isAdmin ? state?.gprProject : undefined}
      gprOrderId={isAdmin ? state?.gprOrderId : undefined}
      gprUpdatedAt={isAdmin ? state?.gprUpdatedAt : undefined}
    />
  );
}
