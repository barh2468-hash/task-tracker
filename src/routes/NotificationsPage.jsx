import { useNavigate } from 'react-router-dom';
import NotificationsWorkspace from '../features/notifications/components/NotificationsWorkspace.jsx';
import PwaControls from '../features/pwa/components/PwaControls.jsx';

export default function NotificationsPage() {
  const navigate = useNavigate();
  return (
    <NotificationsWorkspace
      onNavigate={navigate}
      deviceControls={<PwaControls notificationsOnly />}
    />
  );
}
