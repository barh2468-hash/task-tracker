import { useAuth } from '../features/auth/useAuth.js';

// Temporary landing view for the authenticated area. Replaced by
// DashboardLayout + the full route tree once the remaining features
// (projects, attendance, work-diary, notifications, reporting, map, PWA)
// are extracted.
export default function AuthenticatedPlaceholder() {
  const { profile, logout } = useAuth();

  return (
    <div style={{ padding: 24, fontFamily: 'system-ui' }}>
      <h1>מחובר: {profile?.full_name || '...'}</h1>
      <p>תפקיד: {profile?.role || '...'}</p>
      <button onClick={logout}>יציאה</button>
    </div>
  );
}
