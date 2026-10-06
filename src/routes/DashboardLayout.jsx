import { useTranslation } from 'react-i18next';
import { t } from '../features/language/LanguageContext.jsx';
import { useEffect, useRef, useState } from 'react';
import { Outlet, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Bell,
  Languages,
  LogOut,
  MessageCircle,
  X,
  AlertCircle,
  CheckCircle,
  Info,
} from 'lucide-react';
import { useAuth } from '../features/auth/useAuth.js';
import { useMessage } from '../context/MessageContext.jsx';
import { useNotifications } from '../features/notifications/NotificationsContext.jsx';
import { useProjectStats } from '../features/projects/hooks/useProjectStats.js';
import { roleLabel } from '../services/supabase.js';
import { getTabTitle, getTabSubtitle, isHeroSuppressed } from './dashboardTabs.js';
import { projectDeepLinkPath } from '../utils/navigation.js';
import DashboardHero from '../components/DashboardHero.jsx';
import NotificationsPopover from '../features/notifications/components/NotificationsPopover.jsx';
import DashboardNavigation from '../components/DashboardNavigation.jsx';
import MobileNavigation from '../components/MobileNavigation.jsx';
import AttendanceEndDialog from '../features/attendance/components/AttendanceEndDialog.jsx';
import ProjectWorkEndDialog from '../features/attendance/components/ProjectWorkEndDialog.jsx';
import ProjectWorkspaceNavigation from '../features/projects/components/ProjectWorkspaceNavigation.jsx';
import { useLanguage } from '../features/language/LanguageContext.jsx';
import { useChat } from '../features/chat/ChatContext.jsx';

export default function DashboardLayout() {
  useTranslation();
  const { profile, session, isManager, isDrafter, logout } = useAuth();
  const { message, messageTone, setMessage } = useMessage();
  const ToastIcon = messageTone === 'error' ? AlertCircle : messageTone === 'info' ? Info : CheckCircle;
  const { unreadCount } = useNotifications();
  const { unreadChatCount } = useChat();
  const { language, setLanguage } = useLanguage();
  const { stats } = useProjectStats();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notificationsPopoverPosition, setNotificationsPopoverPosition] = useState(null);
  const notificationBellRef = useRef(null);
  const mobileNotificationBellRef = useRef(null);
  const notificationsPopoverRef = useRef(null);

  useEffect(() => {
    if (!notificationsOpen) return;

    const updatePopoverPosition = () => {
      const isMobile = window.innerWidth <= 1180;
      const bellRect = (isMobile ? mobileNotificationBellRef : notificationBellRef).current?.getBoundingClientRect();
      if (!bellRect) return;

      const viewportPadding = isMobile ? 12 : 14;
      const width = Math.min(380, window.innerWidth - viewportPadding * 2);
      const preferredLeft = !isMobile && language === 'en' ? bellRect.right - width : bellRect.left;
      const left = Math.max(
        viewportPadding,
        Math.min(preferredLeft, window.innerWidth - width - viewportPadding),
      );

      setNotificationsPopoverPosition({
        top: Math.ceil(bellRect.bottom + 8),
        left: Math.round(left),
        width: Math.floor(width),
      });
    };

    const closeOnOutsidePress = (event) => {
      if (notificationsPopoverRef.current?.contains(event.target) ||
          notificationBellRef.current?.contains(event.target) ||
          mobileNotificationBellRef.current?.contains(event.target)) return;
      setNotificationsOpen(false);
    };
    const closeOnEscape = (event) => {
      if (event.key !== 'Escape') return;
      setNotificationsOpen(false);
      (window.innerWidth <= 1180 ? mobileNotificationBellRef : notificationBellRef).current?.focus();
    };

    updatePopoverPosition();
    window.addEventListener('resize', updatePopoverPosition);
    window.addEventListener('scroll', updatePopoverPosition, true);
    document.addEventListener('pointerdown', closeOnOutsidePress);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      window.removeEventListener('resize', updatePopoverPosition);
      window.removeEventListener('scroll', updatePopoverPosition, true);
      document.removeEventListener('pointerdown', closeOnOutsidePress);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [language, notificationsOpen]);

  function openTab(path) {
    navigate(path);
  }

  function toggleChat() {
    if (location.pathname === '/app/chat') {
      const returnTo = location.state?.chatReturnTo;
      navigate(
        typeof returnTo === 'string' && returnTo.startsWith('/app/') && returnTo !== '/app/chat'
          ? returnTo
          : '/app/attendance',
      );
    } else {
      navigate('/app/chat', {
        state: {
          chatReturnTo: `${location.pathname}${location.search}${location.hash}`,
        },
      });
    }
  }

  const isProjectWorkspace =
    location.pathname === '/app/projects' ||
    location.pathname.startsWith('/app/projects/') ||
    location.pathname === '/app/assignments';
  const navActive = (path) => location.pathname === path;

  const tabTitle = getTabTitle(location.pathname, searchParams, isManager);
  const tabSubtitle = getTabSubtitle(isManager, isDrafter);
  const showHero = !isHeroSuppressed(location.pathname);

  return (
    <main
      className={`page${location.pathname === '/app/chat' ? ' chatPage' : ''}${
        location.pathname === '/app/attendance' ? ' attendanceClockShell' : ''
      }`}
    >
      <header className="topbar">
        <div className="brand">
          <img src="/logo.png" alt={t('לוגו')} />
          <div>
            <h1>{t('מערכת איתור תשתיות')}</h1>
            <p>{t('מעקב פרויקטים לעובדי שטח, שרטוט, GPR והיתרים')}</p>
          </div>
        </div>
        <div className="userRow">
          <label className="languageToggle" title={t('Language / שפה / Γλώσσα')}>
            <Languages size={18} />
            <select
              value={language}
              onChange={(event) => setLanguage(event.target.value)}
              aria-label={t('Language / שפה / Γλώσσα')}
            >
              <option value="he">{t('עברית')}</option>
              <option value="en">English</option>
              <option value="el">Ελληνικά</option>
            </select>
          </label>
          <div className="notificationWrap">
            <button
              ref={notificationBellRef}
              className={`notificationBell ${notificationsOpen ? 'active' : ''}`}
              onClick={() => setNotificationsOpen((open) => !open)}
              title={t('התראות')}
              aria-expanded={notificationsOpen}
              aria-controls="notifications-popover"
            >
              <Bell size={18} />
              {unreadCount > 0 && <span>{unreadCount}</span>}
            </button>
          </div>
          <div className="avatar">{profile?.full_name?.[0] || t('ע')}</div>
          <div>
            <b>{profile?.full_name || session?.user?.email}</b>
            <p className="muted">{profile ? t(roleLabel[profile.role]) : t('משתמש')}</p>
          </div>
          <button className="secondary" onClick={logout}>
            <LogOut size={16} />{' '}
            {language === 'he' ? t('יציאה') : language === 'el' ? 'Αποσύνδεση' : 'Log out'}
          </button>
        </div>
      </header>

      <button
        ref={mobileNotificationBellRef}
        type="button"
        className={`notificationBell mobileNotificationBell${notificationsOpen || navActive('/app/notifications') ? ' active' : ''}`}
        aria-label={unreadCount > 0 ? `${t('התראות')} (${unreadCount})` : t('התראות')}
        aria-expanded={notificationsOpen}
        aria-controls="notifications-popover"
        onClick={() => setNotificationsOpen((open) => !open)}
      >
        <Bell size={21} aria-hidden="true" />
        {unreadCount > 0 && <span aria-hidden="true">{unreadCount > 99 ? '99+' : unreadCount}</span>}
      </button>

      {notificationsOpen && (
        <NotificationsPopover
          containerRef={notificationsPopoverRef}
          position={notificationsPopoverPosition}
          onClose={() => setNotificationsOpen(false)}
          onOpenFullPage={() => {
            openTab('/app/notifications');
            setNotificationsOpen(false);
          }}
          onOpenProject={(projectId) => {
            setNotificationsOpen(false);
            navigate(projectDeepLinkPath(projectId));
          }}
        />
      )}

      <section className="container layout">
        <aside id="main-navigation" className="sidebar sidebarCompact" aria-label={t('תפריט ראשי')}>
          <DashboardNavigation
            role={profile ? t(roleLabel[profile.role]) : t('משתמש')}
            isManager={isManager}
            isDrafter={isDrafter}
            pathname={location.pathname}
            isProjectWorkspace={isProjectWorkspace}
            stats={stats}
            unreadCount={unreadCount}
            onOpenTab={openTab}
          />
        </aside>
        <section className="mainContent">
          {showHero && <DashboardHero title={tabTitle} subtitle={tabSubtitle} />}

          {message && (
            <div
              className={`appToast ${messageTone}`}
              role={messageTone === 'error' ? 'alert' : 'status'}
              aria-live={messageTone === 'error' ? 'assertive' : 'polite'}
            >
              <span className="appToastIcon" aria-hidden="true">
                <ToastIcon size={18} />
              </span>
              <p>{message}</p>
              <button
                className="appToastClose"
                onClick={() => setMessage('')}
                aria-label={t('סגירת הודעה')}
              >
                <X size={16} />
              </button>
            </div>
          )}

          {isProjectWorkspace && <ProjectWorkspaceNavigation stats={stats} />}
          <Outlet />
        </section>
      </section>

      <button
        className={`floatingChatButton ${navActive('/app/chat') ? 'active' : ''}`}
        onClick={toggleChat}
        aria-label={
          unreadChatCount > 0
            ? t('צ׳אט פנימי, {{value0}} הודעות חדשות', { value0: unreadChatCount })
            : t('צ׳אט פנימי')
        }
        title={t('צ׳אט פנימי')}
      >
        <MessageCircle size={28} aria-hidden="true" />
        {unreadChatCount > 0 && (
          <span className="floatingChatBadge" aria-hidden="true">
            {unreadChatCount > 99 ? '99+' : unreadChatCount}
          </span>
        )}
      </button>

      <MobileNavigation
        role={profile ? t(roleLabel[profile.role]) : t('משתמש')}
        displayName={profile?.full_name || session?.user?.email}
        isManager={isManager}
        isDrafter={isDrafter}
        pathname={location.pathname}
        isProjectWorkspace={isProjectWorkspace}
        stats={stats}
        unreadChatCount={unreadChatCount}
        onLogout={logout}
        onOpenMore={() => setNotificationsOpen(false)}
        onOpenTab={(path) => {
          setNotificationsOpen(false);
          if (path === '/app/chat' && location.pathname !== '/app/chat') {
            navigate(path, { state: { chatReturnTo: `${location.pathname}${location.search}${location.hash}` } });
          } else openTab(path);
        }}
      />
      <AttendanceEndDialog />
      <ProjectWorkEndDialog />
    </main>
  );
}
