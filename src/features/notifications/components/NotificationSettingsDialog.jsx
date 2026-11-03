import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { t, useLanguage } from '../../language/LanguageContext.jsx';
import NotificationPreferences from './NotificationPreferences.jsx';

export default function NotificationSettingsDialog({ onClose, deviceControls }) {
  useTranslation();
  const { language } = useLanguage();
  const dialogRef = useRef(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = 'hidden';
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, []);

  return createPortal(
    <dialog
      ref={dialogRef}
      id="notification-settings-dialog"
      className="notificationSettingsDialog"
      aria-labelledby="notification-preferences-title"
      dir={language === 'he' ? 'rtl' : 'ltr'}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <div className="notificationSettingsDialogActions">
        <button type="button" className="ghost" onClick={onClose} aria-label={t('סגור')}>
          <X size={18} aria-hidden="true" />
          {t('סגור')}
        </button>
      </div>
      <NotificationPreferences deviceControls={deviceControls} />
    </dialog>,
    document.body,
  );
}
