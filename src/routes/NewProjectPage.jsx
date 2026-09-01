import { Navigate } from 'react-router-dom';
import { useAuth } from '../features/auth/useAuth.js';
import NewProjectForm from '../features/projects/components/NewProjectForm.jsx';

export default function NewProjectPage() {
  const { isManager } = useAuth();
  if (!isManager) return <Navigate to="/app/projects" replace />;
  return <NewProjectForm />;
}
