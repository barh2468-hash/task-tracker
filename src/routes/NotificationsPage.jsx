import { useNavigate } from 'react-router-dom';
import NotificationsPanel from '../features/notifications/components/NotificationsPanel.jsx';

export default function NotificationsPage() {
  const navigate = useNavigate();
  return <NotificationsPanel onNavigate={navigate} />;
}
