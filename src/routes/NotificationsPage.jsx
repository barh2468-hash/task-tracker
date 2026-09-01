import { useNavigate } from 'react-router-dom';
import { projectDeepLinkPath } from '../utils/navigation.js';
import NotificationsPanel from '../features/notifications/components/NotificationsPanel.jsx';

export default function NotificationsPage() {
  const navigate = useNavigate();
  return <NotificationsPanel onOpenProject={(project) => navigate(projectDeepLinkPath(project))} />;
}
