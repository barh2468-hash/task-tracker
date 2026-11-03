import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { t, useLanguage } from '../language/LanguageContext.jsx';
import { languageOptions } from '../language/languages.js';
import { NotificationsContext } from './context.js';
import NotificationsPanel from './components/NotificationsPanel.jsx';
import NotificationPreferences from './components/NotificationPreferences.jsx';

// DEV-only fixture. Every action stays in memory and never calls a backend.
export default function LocalNotificationsPreview() {
  useTranslation();
  const { language, setLanguage } = useLanguage();
  const [rows, setRows] = useState(() =>
    [
      ['status_change', false],
      ['task_added', false],
      ['work_started', true],
      ['project_review_approved', false],
      ['gpr_email_order_received', false],
      ['vehicle_quote', true],
      ['other', true],
      ['task_done', false],
    ].map(([type, is_read], index) => ({
      id: String(index),
      type,
      is_read,
      title: type,
      body: '',
      project_id:
        type === 'status_change' || type === 'project_review_approved' ? 'preview-project' : null,
      projects: type === 'project_review_approved' ? { name: 'Central Station' } : null,
      profiles: { full_name: 'Alex' },
      gpr_order_id: type.startsWith('gpr_') ? 'preview-order' : null,
      gpr_work_orders: type.startsWith('gpr_')
        ? { title: 'Central Station', order_number: '2260844' }
        : null,
      created_at: new Date(Date.UTC(2026, 10, 1, 10 - index, 30)).toISOString(),
    })),
  );
  const [push, setPush] = useState(false);
  const [preferences, setPreferences] = useState({});
  const previewState = new URLSearchParams(window.location.search).get('preferences');
  const [preferencesError, setPreferencesError] = useState(previewState === 'load-error');
  const [hasMore, setHasMore] = useState(true);
  const notifications = rows.map((item) => ({
    ...item,
    title:
      item.type === 'task_added' || item.type === 'task_done'
        ? t('notifications.category.tasks')
        : item.type === 'status_change'
          ? t('notifications.category.projects')
          : item.type === 'work_started'
            ? t('notifications.category.attendance')
            : item.type === 'vehicle_quote'
              ? t('notifications.category.vehicles')
              : t('notifications.category.other'),
  }));
  async function setRead(ids, isRead) {
    setRows((current) =>
      current.map((item) => (ids.includes(item.id) ? { ...item, is_read: isRead } : item)),
    );
    return true;
  }
  return (
    <main style={{ maxWidth: 1120, margin: '24px auto', padding: '0 12px' }}>
      <label style={{ maxWidth: 220, marginBottom: 16 }}>
        {t('gpr.language')}
        <select value={language} onChange={(event) => void setLanguage(event.target.value)}>
          {languageOptions.map(({ code, labelKey }) => (
            <option key={code} value={code}>
              {t(labelKey)}
            </option>
          ))}
        </select>
      </label>
      <NotificationsContext.Provider
        value={{
          preferences,
          preferencesError,
          preferencesLoading: previewState === 'loading',
          reloadNotificationPreferences: () => setPreferencesError(false),
          updateNotificationPreference: async (category, enabled) => {
            if (previewState === 'save-error') return false;
            setPreferences((current) => ({ ...current, [category]: enabled }));
            return true;
          },
          notifications,
          unreadCount: rows.filter((item) => !item.is_read).length,
          setNotificationsRead: setRead,
          markNotificationRead: (id) => setRead([id], true),
          markAllNotificationsRead: () =>
            setRead(
              rows.map((item) => item.id),
              true,
            ),
          hasMore,
          loadMoreNotifications: () => {
            setRows((current) => [
              ...current,
              {
                id: 'older',
                type: 'task_added',
                is_read: false,
                created_at: '2026-10-20T08:00:00Z',
              },
            ]);
            setHasMore(false);
          },
        }}
      >
        <NotificationPreferences
          deviceControls={
            <button className="ghost" aria-pressed={push} onClick={() => setPush(!push)}>
              {t(push ? 'כיבוי התראות' : 'הפעלת התראות')}
            </button>
          }
        />
        <details className="notificationHistory">
          <summary>{t('notifications.history')}</summary>
          <NotificationsPanel />
        </details>
      </NotificationsContext.Provider>
    </main>
  );
}
