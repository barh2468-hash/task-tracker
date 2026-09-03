import { useTranslation } from 'react-i18next';
import { t } from '../features/language/LanguageContext.jsx';
import { useAuth } from '../features/auth/useAuth.js';
import { useNotifications } from '../features/notifications/NotificationsContext.jsx';
import { useProjectStats } from '../features/projects/hooks/useProjectStats.js';

export default function DashboardHero({ title, subtitle }) {
  useTranslation();
  const { isManager } = useAuth();
  const { unreadCount } = useNotifications();
  const { stats } = useProjectStats();

  return (
    <div className="dashboardHero">
      <div>
        <span className="eyebrow">MAYA TASKS</span>
        <h2>{t(title)}</h2>
        <p>{t(subtitle)}</p>
      </div>
      <div className="heroChips">
        <span>
          {t('התראות חדשות:')}
          {unreadCount}
        </span>
        {isManager && (
          <span>
            {t('פרויקטים ללא שיוך:')}
            {stats.unassigned}
          </span>
        )}
        {isManager && (
          <span>
            {t('בארכיון:')}
            {stats.archived}
          </span>
        )}
        <span>
          {t('עבודות פעילות:')}
          {stats.activeWork}
        </span>
      </div>
    </div>
  );
}
