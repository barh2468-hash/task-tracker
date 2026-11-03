import { useState } from 'react';
import { Bell, CheckCheck, Search, Settings2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { t, useLanguage } from '../../language/LanguageContext.jsx';
import { localeForLanguage } from '../../language/locale.js';
import { notificationText } from '../notificationText.js';
import { notificationLink } from '../notificationLink.js';
import {
  filterNotifications,
  notificationCategories,
  notificationCategory,
} from '../management.js';
import { useNotifications } from '../NotificationsContext.jsx';
import '../notification-management.css';

export default function NotificationsPanel({ onNavigate, settings, headerActions }) {
  useTranslation();
  const { language } = useLanguage();
  const locale = localeForLanguage(language);
  const number = (value) => value.toLocaleString(locale);
  const {
    notifications,
    unreadCount,
    markNotificationRead,
    markAllNotificationsRead,
    setNotificationsRead,
    loading,
    loadError,
    hasMore,
    busy,
    loadNotifications,
    loadMoreNotifications,
  } = useNotifications();
  const [status, setStatus] = useState('all');
  const [category, setCategory] = useState('all');
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState([]);
  const visible = filterNotifications(notifications, { status, category, search }, t, locale);
  const selected = visible.filter((item) => selectedIds.includes(item.id));
  const allSelected = visible.length > 0 && selected.length === visible.length;
  const filtered = status !== 'all' || category !== 'all' || search.trim() !== '';

  function changeFilter(setter, value) {
    setter(value);
    setSelectedIds([]);
  }

  function resetFilters() {
    setStatus('all');
    setCategory('all');
    setSearch('');
    setSelectedIds([]);
  }

  async function updateSelected(isRead) {
    const ids = selected.filter((item) => Boolean(item.is_read) !== isRead).map((item) => item.id);
    if (await setNotificationsRead(ids, isRead)) setSelectedIds([]);
  }

  function openNotification(item) {
    if (!item.is_read) void markNotificationRead(item.id);
    const target = notificationLink(item);
    if (target) onNavigate?.(target.path);
  }

  return (
    <section
      className="card notificationsPanel notificationManagement"
      dir={language === 'he' ? 'rtl' : 'ltr'}
      aria-labelledby="notification-management-title"
    >
      <header className="notificationManagementHeader">
        <div className="notificationManagementTitle">
          <span className="notificationManagementIcon">
            <Bell size={24} aria-hidden="true" />
          </span>
          <div>
            <h2 id="notification-management-title">{t('התראות')}</h2>
            <p className="muted">{t('notifications.description')}</p>
          </div>
        </div>
        <div className="notificationManagementActions">
          {headerActions}
          <button
            className="ghost"
            onClick={() => void markAllNotificationsRead()}
            disabled={busy || unreadCount === 0}
          >
            <CheckCheck size={17} aria-hidden="true" />
            {t('notifications.markAll')}
          </button>
        </div>
      </header>

      <div className="notificationSummary" aria-live="polite">
        <span>
          <strong>{number(unreadCount)}</strong>
          {t('notifications.unreadTotal')}
        </span>
        <span>
          <strong>{number(notifications.length)}</strong>
          {t('notifications.loadedTotal')}
        </span>
      </div>

      {settings && (
        <details className="notificationSettings">
          <summary>
            <Settings2 size={18} aria-hidden="true" />
            {t('notifications.deviceSettings')}
          </summary>
          <p className="muted">{t('notifications.deviceHint')}</p>
          {settings}
        </details>
      )}

      <div className="notificationFilters">
        <div
          className="notificationStatusFilters"
          role="group"
          aria-label={t('notifications.statusFilter')}
        >
          {['all', 'unread', 'read'].map((value) => (
            <button
              key={value}
              className="ghost"
              aria-pressed={status === value}
              onClick={() => changeFilter(setStatus, value)}
            >
              {t(`notifications.status.${value}`)}
            </button>
          ))}
        </div>
        <div className="notificationSearchFilters">
          <label className="notificationSearch">
            <span>{t('notifications.search')}</span>
            <span className="notificationSearchInput">
              <Search size={17} aria-hidden="true" />
              <input
                type="search"
                value={search}
                placeholder={t('notifications.searchPlaceholder')}
                onChange={(event) => changeFilter(setSearch, event.target.value)}
              />
            </span>
          </label>
          <label>
            {t('notifications.category')}
            <select
              value={category}
              onChange={(event) => changeFilter(setCategory, event.target.value)}
            >
              <option value="all">{t('notifications.allCategories')}</option>
              {notificationCategories.map((value) => (
                <option key={value} value={value}>
                  {t(`notifications.category.${value}`)}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="muted">{t('notifications.searchHint')}</p>
      </div>

      <div className="notificationBulkActions">
        <label className="notificationSelectAll">
          <input
            type="checkbox"
            checked={allSelected}
            ref={(element) => {
              if (element) element.indeterminate = selected.length > 0 && !allSelected;
            }}
            disabled={busy || visible.length === 0}
            onChange={() => setSelectedIds(allSelected ? [] : visible.map((item) => item.id))}
          />
          {t('notifications.selectVisible')}
        </label>
        {selected.length > 0 && (
          <>
            <span role="status">
              {t('notifications.selectedCount', { count: number(selected.length) })}
            </span>
            <button
              className="ghost tinyBtn"
              disabled={busy || !selected.some((item) => !item.is_read)}
              onClick={() => void updateSelected(true)}
            >
              {t('notifications.markRead')}
            </button>
            <button
              className="ghost tinyBtn"
              disabled={busy || !selected.some((item) => item.is_read)}
              onClick={() => void updateSelected(false)}
            >
              {t('notifications.markUnread')}
            </button>
            <button className="ghost tinyBtn" onClick={() => setSelectedIds([])} disabled={busy}>
              {t('notifications.clearSelection')}
            </button>
          </>
        )}
        {filtered && (
          <button className="ghost tinyBtn" onClick={resetFilters}>
            {t('notifications.resetFilters')}
          </button>
        )}
      </div>

      <div className="notificationsList" aria-busy={Boolean(loading)}>
        {loadError && (
          <div className="notificationLoadError" role="alert">
            <p>{t('notifications.loadError')}</p>
            <button className="ghost" onClick={() => void loadNotifications()} disabled={loading}>
              {t('notifications.retry')}
            </button>
          </div>
        )}
        {loading && notifications.length === 0 && (
          <p className="empty" role="status">
            {t('notifications.loading')}
          </p>
        )}
        {!loading && !loadError && visible.length === 0 && (
          <div className="empty notificationEmpty">
            <Bell size={28} aria-hidden="true" />
            <h3>{t(filtered ? 'notifications.noMatches' : 'notifications.empty')}</h3>
            <p className="muted">
              {t(filtered ? 'notifications.noMatchesHint' : 'notifications.emptyHint')}
            </p>
            {filtered && (
              <button className="ghost" onClick={resetFilters}>
                {t('notifications.resetFilters')}
              </button>
            )}
          </div>
        )}
        {visible.map((item) => {
          const target = notificationLink(item);
          const text = notificationText(item, t);
          return (
            <article
              key={item.id}
              className={`notificationItem notificationManagedItem ${item.is_read ? '' : 'unread'}`}
            >
              <input
                className="notificationCheckbox"
                type="checkbox"
                aria-label={t('notifications.selectItem', { title: text.title })}
                checked={selectedIds.includes(item.id)}
                disabled={busy}
                onChange={(event) =>
                  setSelectedIds((current) =>
                    event.target.checked
                      ? [...current, item.id]
                      : current.filter((id) => id !== item.id),
                  )
                }
              />
              <div className="notificationContent">
                <div className="notificationItemLabels">
                  <span>{t(`notifications.category.${notificationCategory(item)}`)}</span>
                  <span className={item.is_read ? '' : 'notificationUnreadLabel'}>
                    {t(item.is_read ? 'notifications.status.read' : 'notifications.status.unread')}
                  </span>
                </div>
                {target ? (
                  <button
                    className="notificationTitleButton"
                    onClick={() => openNotification(item)}
                    title={t(target.label)}
                  >
                    {text.title}
                  </button>
                ) : (
                  <b dir="auto">{text.title}</b>
                )}
                {text.body && <p dir="auto">{text.body}</p>}
                <div className="notificationMetadata">
                  {item.projects?.name && <span dir="auto">{item.projects.name}</span>}
                  {item.profiles?.full_name && <span dir="auto">{item.profiles.full_name}</span>}
                  <time dateTime={item.created_at}>
                    {new Date(item.created_at).toLocaleString(locale)}
                  </time>
                </div>
              </div>
              <button
                className="ghost tinyBtn notificationReadAction"
                disabled={busy}
                aria-label={t(
                  item.is_read ? 'notifications.markItemUnread' : 'notifications.markItemRead',
                  { title: text.title },
                )}
                onClick={() => void setNotificationsRead([item.id], !item.is_read)}
              >
                {t(item.is_read ? 'notifications.markUnread' : 'notifications.markRead')}
              </button>
            </article>
          );
        })}
      </div>
      <footer className="notificationManagementFooter">
        <span className="muted" role="status">
          {t('notifications.results', {
            count: number(visible.length),
            total: number(notifications.length),
          })}
        </span>
        {hasMore && (
          <button
            className="ghost"
            onClick={() => void loadMoreNotifications()}
            disabled={loading || busy}
          >
            {t(loading ? 'notifications.loading' : 'notifications.loadMore')}
          </button>
        )}
      </footer>
    </section>
  );
}
