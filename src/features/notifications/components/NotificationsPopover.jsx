import { useTranslation } from 'react-i18next';
import { t, useLanguage } from '../../language/LanguageContext.jsx';
import { localeForLanguage } from '../../language/locale.js';
import { notificationText } from '../notificationText.js';
import { notificationLink } from '../notificationLink.js';
import { X } from 'lucide-react';
import { useNotifications } from '../NotificationsContext.jsx';

export default function NotificationsPopover({
  containerRef,
  position,
  onClose,
  onOpenFullPage,
  onNavigate,
}) {
  useTranslation();
  const { language } = useLanguage();
  const { notifications, unreadCount, markNotificationRead, markAllNotificationsRead } =
    useNotifications();
  const recent = notifications.slice(0, 6);

  function openNotification(notification) {
    if (!notification.is_read) markNotificationRead(notification.id);

    const target = notificationLink(notification);
    onClose?.();
    if (target) onNavigate?.(target.path);
  }

  return (
    <div
      ref={containerRef}
      id="notifications-popover"
      role="region"
      aria-label={t('התראות')}
      className="notificationsPopover notificationsPopoverViewport"
      dir={language === 'he' ? 'rtl' : 'ltr'}
      style={
        position
          ? {
              '--notifications-popover-top': `${position.top}px`,
              '--notifications-popover-left': `${position.left}px`,
              '--notifications-popover-width': `${position.width}px`,
            }
          : undefined
      }
    >
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
        {recent.map((item) => {
          const target = notificationLink(item);
          const text = notificationText(item, t);
          return (
            <button
              key={item.id}
              className={`popoverItem ${item.is_read ? '' : 'unread'}`}
              onClick={() => openNotification(item)}
              title={target ? t(target.label) : undefined}
            >
              <span className="dot" />
              <span className="popoverText">
                <b>{text.title}</b>
                {text.body && <small>{text.body}</small>}
                <em>{new Date(item.created_at).toLocaleString(localeForLanguage(language))}</em>
              </span>
            </button>
          );
        })}
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
