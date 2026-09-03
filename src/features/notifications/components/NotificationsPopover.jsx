import { useTranslation } from 'react-i18next';
import { t } from '../../language/LanguageContext.jsx';
import { X } from 'lucide-react';
import { useNotifications } from '../NotificationsContext.jsx';
import { useProjects } from '../../projects/ProjectsContext.jsx';
import { useMessage } from '../../../context/MessageContext.jsx';

export default function NotificationsPopover({ onClose, onOpenFullPage, onOpenProject }) {
  useTranslation();
  const { notifications, unreadCount, markNotificationRead, markAllNotificationsRead } =
    useNotifications();
  const { projects } = useProjects();
  const { setMessage } = useMessage();
  const recent = notifications.slice(0, 6);

  function openNotification(notification) {
    if (!notification.is_read) markNotificationRead(notification.id);

    if (!notification.project_id) {
      onClose?.();
      return;
    }

    const linkedProject = projects.find((project) => project.id === notification.project_id);
    if (!linkedProject) {
      onClose?.();
      setMessage(t('הפרויקט המקושר להתראה אינו זמין עבורך כרגע.'));
      return;
    }

    onClose?.();
    onOpenProject?.(linkedProject);
  }

  return (
    <div className="notificationsPopover" dir="rtl">
      <div className="popoverHeader">
        <div>
          <b>{t('התראות')}</b>
          <span>
            {unreadCount > 0
              ? t('{{value0}} חדשות', { value0: unreadCount })
              : t('אין התראות חדשות')}
          </span>
        </div>
        <button className="iconOnly" onClick={onClose} title={t('סגור')}>
          <X size={16} />
        </button>
      </div>
      <div className="popoverList">
        {recent.length === 0 && <div className="popoverEmpty">{t('אין התראות כרגע')}</div>}
        {recent.map((item) => (
          <button
            key={item.id}
            className={`popoverItem ${item.is_read ? '' : 'unread'}`}
            onClick={() => openNotification(item)}
            title={item.project_id ? t('פתח פרויקט') : undefined}
          >
            <span className="dot" />
            <span className="popoverText">
              <b>{item.title}</b>
              {item.body && <small>{item.body}</small>}
              <em>{new Date(item.created_at).toLocaleString('he-IL')}</em>
            </span>
          </button>
        ))}
      </div>
      <div className="popoverActions">
        <button className="ghost tinyBtn" onClick={onOpenFullPage}>
          {t('לכל ההתראות')}
        </button>
        <button
          className="ghost tinyBtn"
          onClick={markAllNotificationsRead}
          disabled={unreadCount === 0}
        >
          {t('סמן הכל כנקרא')}
        </button>
      </div>
    </div>
  );
}
