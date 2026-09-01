import { useNavigate } from 'react-router-dom';
import { useAuth } from '../features/auth/useAuth.js';
import NotificationsPanel from '../features/notifications/components/NotificationsPanel.jsx';

export default function NotificationsPage() {
  const { isManager } = useAuth();
  const navigate = useNavigate();
  return (
    <NotificationsPanel
      onOpenProject={(project) =>
        navigate(`/app/projects?filter=${project.is_archived ? 'archive' : isManager ? 'all' : 'mine'}&project=${project.id}`)
      }
    />
  );
}
