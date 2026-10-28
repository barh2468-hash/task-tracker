import { useTranslation } from 'react-i18next';
import { t, useLanguage } from '../../language/LanguageContext.jsx';
import { localeForLanguage } from '../../language/locale.js';
import { notificationText } from '../notificationText.js';
import { notificationLink } from '../notificationLink.js';
import { useNotifications } from '../NotificationsContext.jsx';

export default function NotificationsPanel({ onNavigate }) {
  useTranslation();
  const { language } = useLanguage();
  const { notifications, markNotificationRead, markAllNotificationsRead } = useNotifications();
  const unread = notifications.filter((n) => !n.is_read).length;

  function openNotification(notification) {
    if (!notification.is_read) markNotificationRead(notification.id);

    const target = notificationLink(notification);
    if (target) onNavigate?.(target.path);
  }

  return (
    <section className="card notificationsPanel" dir={language === 'he' ? 'rtl' : 'ltr'}>
      <div className="reportHeader">
        <div>
          <h2>{t('התראות')}</h2>
          <p className="muted">{t('התראות פנימיות על שינויי סטטוס, התחלת/סיום עבודה ומשימות.')}</p>
        </div>
        <button className="ghost" onClick={markAllNotificationsRead} disabled={unread === 0}>
          {t('סמן הכל כנקרא')}
        </button>
      </div>
      <div className="notificationsList">
        {notifications.length === 0 && <div className="empty">{t('אין התראות כרגע')}</div>}
        {notifications.map((item) => {
          const target = notificationLink(item);
          const text = notificationText(item, t);
          return (
            <div
              key={item.id}
              className={`notificationItem ${item.is_read ? '' : 'unread'} ${target ? 'clickable' : ''}`}
              onClick={target ? () => openNotification(item) : undefined}
              onKeyDown={
                target
                  ? (event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        openNotification(item);
                      }
                    }
                  : undefined
              }
              role={target ? 'button' : undefined}
              tabIndex={target ? 0 : undefined}
              title={target ? t(target.label) : undefined}
            >
              <div>
                <b>{text.title}</b>
                {text.body && <p>{text.body}</p>}
                <span className="muted">
                  {item.projects?.name ? `${item.projects.name} · ` : ''}
                  {item.profiles?.full_name ? `${item.profiles.full_name} · ` : ''}
                  {new Date(item.created_at).toLocaleString(localeForLanguage(language))}
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
                  {t('סמן כנקרא')}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
