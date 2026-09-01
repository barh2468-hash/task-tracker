import { useAuth } from '../features/auth/useAuth.js';
import { useNotifications } from '../features/notifications/NotificationsContext.jsx';
import { useProjectStats } from '../features/projects/hooks/useProjectStats.js';

export default function DashboardHero({ title, subtitle }) {
  const { isManager } = useAuth();
  const { unreadCount } = useNotifications();
  const { stats } = useProjectStats();

  return (
    <div className="dashboardHero">
      <div>
        <span className="eyebrow">MAYA TASKS</span>
        <h2>{title}</h2>
        <p>{subtitle}</p>
      </div>
      <div className="heroChips">
        <span>התראות חדשות: {unreadCount}</span>
        {isManager && <span>פרויקטים ללא שיוך: {stats.unassigned}</span>}
        {isManager && <span>בארכיון: {stats.archived}</span>}
        <span>עבודות פעילות: {stats.activeWork}</span>
      </div>
    </div>
  );
}
