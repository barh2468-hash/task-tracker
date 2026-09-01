import { useNotifications } from '../NotificationsContext.jsx';
import { useProjects } from '../../projects/ProjectsContext.jsx';
import { useMessage } from '../../../context/MessageContext.jsx';

export default function NotificationsPanel({ onOpenProject }) {
  const { notifications, markNotificationRead, markAllNotificationsRead } = useNotifications();
  const { projects } = useProjects();
  const { setMessage } = useMessage();
  const unread = notifications.filter((n) => !n.is_read).length;

  function openNotification(notification) {
    if (!notification.is_read) markNotificationRead(notification.id);

    if (!notification.project_id) return;

    const linkedProject = projects.find((project) => project.id === notification.project_id);
    if (!linkedProject) {
      setMessage('הפרויקט המקושר להתראה אינו זמין עבורך כרגע.');
      return;
    }

    onOpenProject?.(linkedProject);
  }

  return (
    <section className="card notificationsPanel">
      <div className="reportHeader">
        <div>
          <h2>התראות</h2>
          <p className="muted">
            התראות פנימיות על שינויי סטטוס, התחלת/סיום עבודה ומשימות.
          </p>
        </div>
        <button className="ghost" onClick={markAllNotificationsRead} disabled={unread === 0}>
          סמן הכל כנקרא
        </button>
      </div>
      <div className="notificationsList">
        {notifications.length === 0 && (
          <div className="empty">אין התראות כרגע</div>
        )}
        {notifications.map((item) => (
          <div
            key={item.id}
            className={`notificationItem ${item.is_read ? "" : "unread"} ${item.project_id ? "clickable" : ""}`}
            onClick={item.project_id ? () => openNotification(item) : undefined}
            onKeyDown={
              item.project_id
                ? (event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      openNotification(item);
                    }
                  }
                : undefined
            }
            role={item.project_id ? "button" : undefined}
            tabIndex={item.project_id ? 0 : undefined}
            title={item.project_id ? "פתח פרויקט" : undefined}
          >
            <div>
              <b>{item.title}</b>
              {item.body && <p>{item.body}</p>}
              <span className="muted">
                {item.projects?.name ? `${item.projects.name} · ` : ""}
                {item.profiles?.full_name
                  ? `${item.profiles.full_name} · `
                  : ""}
                {new Date(item.created_at).toLocaleString("he-IL")}
              </span>
            </div>
            {!item.is_read && (
              <button
                className="ghost tinyBtn"
                onClick={(event) => {
                  event.stopPropagation();
                  markNotificationRead(item.id);
                }}
              >
                סמן כנקרא
              </button>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
