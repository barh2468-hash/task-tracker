import { FolderOpen, Mail, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { t, useLanguage } from '../../language/LanguageContext.jsx';
import { useNotifications } from '../NotificationsContext.jsx';
import { notificationText } from '../notificationText.js';
import { notificationLink } from '../notificationLink.js';
import './gpr-inbox-alert.css';

export default function GprInboxAlert({ onNavigate }) {
  useTranslation();
  const { language } = useLanguage();
  const { gprNotification, dismissGprAlert, markNotificationRead } = useNotifications();
  if (!gprNotification) return null;
  const text = notificationText(gprNotification, t);
  const target = notificationLink(gprNotification);
  return (
    <aside
      className="gprInboxAlert"
      role="status"
      aria-live="polite"
      dir={language === 'he' ? 'rtl' : 'ltr'}
    >
      <header>
        <span>
          <Mail size={15} aria-hidden="true" />
          {t('gpr.fromEmail')}
        </span>
        <button
          type="button"
          className="iconOnly"
          onClick={() => dismissGprAlert(gprNotification.id)}
          aria-label={t('gpr.dismissAlert')}
        >
          <X size={16} />
        </button>
      </header>
      <h3 dir="auto">{text.title}</h3>
      <p>{text.body}</p>
      {target && (
        <button
          type="button"
          className="gprInboxAlertOpen"
          onClick={() => {
            dismissGprAlert(gprNotification.id);
            void markNotificationRead(gprNotification.id);
            onNavigate(target.path);
          }}
        >
          <FolderOpen size={16} />
          {t(target.label)}
        </button>
      )}
    </aside>
  );
}
