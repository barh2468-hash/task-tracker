import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Settings2 } from 'lucide-react';
import { t } from '../../language/LanguageContext.jsx';
import NotificationsPanel from './NotificationsPanel.jsx';
import NotificationSettingsDialog from './NotificationSettingsDialog.jsx';

export default function NotificationsWorkspace({ onNavigate, deviceControls }) {
  useTranslation();
  const [settingsOpen, setSettingsOpen] = useState(false);
  return (
    <>
      <NotificationsPanel
        onNavigate={onNavigate}
        headerActions={
          <button
            type="button"
            className="ghost"
            aria-haspopup="dialog"
            aria-expanded={settingsOpen}
            aria-controls={settingsOpen ? 'notification-settings-dialog' : undefined}
            onClick={() => setSettingsOpen(true)}
          >
            <Settings2 size={17} aria-hidden="true" />
            {t('notifications.settingsTitle')}
          </button>
        }
      />
      {settingsOpen && (
        <NotificationSettingsDialog
          onClose={() => setSettingsOpen(false)}
          deviceControls={deviceControls}
        />
      )}
    </>
  );
}
