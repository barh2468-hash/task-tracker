import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BellRing } from 'lucide-react';
import { t, useLanguage } from '../../language/LanguageContext.jsx';
import { useNotifications } from '../NotificationsContext.jsx';
import { notificationPreferenceCategories } from '../../../../supabase/functions/_shared/notificationPreferences.js';
import '../notification-management.css';

export default function NotificationPreferences({ deviceControls }) {
  useTranslation();
  const { language } = useLanguage();
  const {
    preferences = {},
    preferencesLoading,
    preferencesError,
    preferencesSaving,
    updateNotificationPreference,
    reloadNotificationPreferences,
  } = useNotifications();
  const [feedback, setFeedback] = useState(null);

  async function toggle(category, enabled) {
    setFeedback(null);
    const saved = await updateNotificationPreference(category, enabled);
    setFeedback(saved ? { category, enabled } : { error: true });
  }

  return (
    <section
      className="card notificationPreferences"
      dir={language === 'he' ? 'rtl' : 'ltr'}
      aria-labelledby="notification-preferences-title"
    >
      <header className="notificationManagementTitle">
        <span className="notificationManagementIcon">
          <BellRing size={24} aria-hidden="true" />
        </span>
        <div>
          <h2 id="notification-preferences-title">{t('notifications.settingsTitle')}</h2>
          <p className="muted">{t('notifications.settingsDescription')}</p>
        </div>
      </header>
      <p className="notificationPreferencesHint">{t('notifications.settingsScope')}</p>
      {preferencesLoading && <p role="status">{t('notifications.preferencesLoading')}</p>}
      {preferencesError && (
        <div className="notificationLoadError" role="alert">
          <p>{t('notifications.preferencesLoadError')}</p>
          <button className="ghost" onClick={() => void reloadNotificationPreferences()}>
            {t('notifications.retry')}
          </button>
        </div>
      )}
      {feedback && (
        <p
          className={
            feedback.error ? 'notificationPreferenceError' : 'notificationPreferenceFeedback'
          }
          role={feedback.error ? 'alert' : 'status'}
        >
          {feedback.error
            ? t('notifications.preferencesSaveError')
            : t(
                feedback.enabled
                  ? 'notifications.preferenceEnabled'
                  : 'notifications.preferenceDisabled',
                { category: t(`notifications.preference.${feedback.category}`) },
              )}
        </p>
      )}
      <div
        className="notificationPreferenceList"
        aria-busy={Boolean(preferencesLoading || preferencesSaving)}
      >
        {!preferencesLoading &&
          !preferencesError &&
          notificationPreferenceCategories.map((category) => {
            const enabled = preferences[category] !== false;
            return (
              <div className="notificationPreferenceRow" key={category}>
                <div>
                  <h3 id={`notification-pref-${category}`}>
                    {t(`notifications.preference.${category}`)}
                  </h3>
                  <p id={`notification-pref-${category}-description`}>
                    {t(`notifications.preference.${category}.description`)}
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={enabled}
                  aria-labelledby={`notification-pref-${category}`}
                  aria-describedby={`notification-pref-${category}-description`}
                  className={`notificationPreferenceSwitch ${enabled ? 'isOn' : ''}`}
                  disabled={preferencesLoading || preferencesError || preferencesSaving}
                  onClick={() => void toggle(category, !enabled)}
                >
                  <span className="notificationPreferenceTrack" aria-hidden="true">
                    <span />
                  </span>
                  <span>
                    {t(enabled ? 'notifications.preferenceOn' : 'notifications.preferenceOff')}
                  </span>
                </button>
              </div>
            );
          })}
      </div>
      {deviceControls && (
        <details className="notificationSettings">
          <summary>{t('notifications.deviceSettings')}</summary>
          <p className="muted">{t('notifications.deviceHint')}</p>
          {deviceControls}
        </details>
      )}
    </section>
  );
}
