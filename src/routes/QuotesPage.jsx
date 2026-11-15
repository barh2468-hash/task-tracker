import { Navigate } from 'react-router-dom';
import { useAuth } from '../features/auth/useAuth.js';
import QuotesWorkspace from '../features/quotes/QuotesWorkspace.jsx';
import { serverQuotes } from '../features/quotes/api.js';
import { canUseQuotes } from '../features/quotes/access.js';

export default function QuotesPage() {
  const { isManager, session, profile } = useAuth();
  if (!isManager || !canUseQuotes(session?.user?.id)) return <Navigate to="/app" replace />;
  return (
    <QuotesWorkspace
      key={session.user.id}
      scope={session.user.id}
      defaultOwner={profile?.full_name || ''}
      remote={serverQuotes}
    />
  );
}
