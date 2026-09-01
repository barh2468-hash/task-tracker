import { Navigate } from 'react-router-dom';
import { useAuth } from '../features/auth/useAuth.js';
import TodayFieldPanel from '../features/attendance/components/TodayFieldPanel.jsx';

export default function TodayPage() {
  const { isManager } = useAuth();
  if (!isManager) return <Navigate to="/app/projects" replace />;
  return <TodayFieldPanel />;
}
