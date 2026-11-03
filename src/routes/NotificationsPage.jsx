import { useNavigate } from 'react-router-dom';
import NotificationsPanel from '../features/notifications/components/NotificationsPanel.jsx';
import PwaControls from '../features/pwa/components/PwaControls.jsx';
import NotificationPreferences from '../features/notifications/components/NotificationPreferences.jsx';
import { useTranslation } from 'react-i18next';
import { t } from '../features/language/LanguageContext.jsx';

export default function NotificationsPage() {
  useTranslation();
  const navigate = useNavigate();
  return (
    <div className="notificationSettingsPage">
      <NotificationPreferences deviceControls={<PwaControls notificationsOnly />} />
      <details className="notificationHistory">
        <summary>{t('notifications.history')}</summary>
        <NotificationsPanel onNavigate={navigate} />
      </details>
    </div>
  );
}
