import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../features/auth/useAuth.js';
import { LoadingScreen } from './LoginPage.jsx';

export default function RequireAuth() {
  const { session, authLoading, profileLoading } = useAuth();

  if (authLoading || profileLoading) return <LoadingScreen />;
  if (!session) return <Navigate to="/login" replace />;
  return <Outlet />;
}
