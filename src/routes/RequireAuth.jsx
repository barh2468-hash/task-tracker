import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../features/auth/useAuth.js';
import { LoadingScreen } from './LoginPage.jsx';
import ProfileRecovery from '../features/auth/components/ProfileRecovery.jsx';

export default function RequireAuth() {
  const { session, profile, authLoading, profileLoading } = useAuth();

  if (authLoading || profileLoading) return <LoadingScreen />;
  if (!session) return <Navigate to="/login" replace />;
  if (!profile) return <ProfileRecovery />;
  return <Outlet />;
}
