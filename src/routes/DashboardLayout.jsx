import { useTranslation } from 'react-i18next';
import { t } from '../features/language/LanguageContext.jsx';
import { useEffect, useRef, useState } from 'react';
import { Outlet, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Bell,
  ChevronLeft,
  ChevronRight,
  Languages,
  LogOut,
  MessageCircle,
  X,
  CheckCircle,
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
import AttendanceEndDialog from '../features/attendance/components/AttendanceEndDialog.jsx';
import ProjectWorkEndDialog from '../features/attendance/components/ProjectWorkEndDialog.jsx';
import ProjectWorkspaceNavigation from '../features/projects/components/ProjectWorkspaceNavigation.jsx';
import { useLanguage } from '../features/language/LanguageContext.jsx';
import { useChat } from '../features/chat/ChatContext.jsx';

export default function DashboardLayout() {
  useTranslation();
  const { profile, session, isManager, isDrafter, logout } = useAuth();
  const { message, setMessage } = useMessage();
  const { unreadCount } = useNotifications();
  const { unreadChatCount } = useChat();
  const { language, setLanguage } = useLanguage();
  const { stats } = useProjectStats();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notificationsPopoverPosition, setNotificationsPopoverPosition] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileMenuDragProgress, setMobileMenuDragProgress] = useState(null);
  const notificationBellRef = useRef(null);
  const sidebarRef = useRef(null);
  const pageSwipeRef = useRef(null);
  const suppressPageClickRef = useRef(false);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const resetMenuScroll = window.requestAnimationFrame(() => {
      sidebarRef.current?.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    });
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') closeMobileMenu();
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      window.cancelAnimationFrame(resetMenuScroll);
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [mobileMenuOpen]);

  useEffect(() => {
    const menuVisible = mobileMenuOpen || mobileMenuDragProgress !== null;
    if (!menuVisible) return undefined;

    const previousOverflow = document.body.style.overflow;
    const previousOverscrollBehavior = document.body.style.overscrollBehavior;
    document.body.style.overflow = 'hidden';
    document.body.style.overscrollBehavior = 'none';
    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.style.overscrollBehavior = previousOverscrollBehavior;
    };
  }, [mobileMenuDragProgress, mobileMenuOpen]);

  useEffect(() => {
    const restoreInterruptedDrag = () => {
      const start = pageSwipeRef.current;
      if (!start?.dragging) return;
      pageSwipeRef.current = null;
      setMobileMenuOpen(start.initialProgress === 1);
      setMobileMenuDragProgress(null);
    };
    const restoreHiddenDrag = () => {
      if (document.visibilityState === 'hidden') restoreInterruptedDrag();
    };

    window.addEventListener('blur', restoreInterruptedDrag);
    document.addEventListener('visibilitychange', restoreHiddenDrag);
    return () => {
      window.removeEventListener('blur', restoreInterruptedDrag);
      document.removeEventListener('visibilitychange', restoreHiddenDrag);
    };
  }, []);

  useEffect(() => {
    if (!notificationsOpen) return;

    const updatePopoverPosition = () => {
      const bellRect = notificationBellRef.current?.getBoundingClientRect();
      if (!bellRect) return;

      const viewportPadding = window.innerWidth <= 760 ? 12 : 14;
      const width = Math.min(380, window.innerWidth - viewportPadding * 2);
      const preferredLeft = language === 'en' ? bellRect.right - width : bellRect.left;
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

    updatePopoverPosition();
    window.addEventListener('resize', updatePopoverPosition);
    window.addEventListener('scroll', updatePopoverPosition, true);
    return () => {
      window.removeEventListener('resize', updatePopoverPosition);
      window.removeEventListener('scroll', updatePopoverPosition, true);
    };
  }, [language, notificationsOpen]);

  function openTab(path) {
    navigate(path);
    closeMobileMenu();
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
    closeMobileMenu();
  }

  function closeMobileMenu() {
    pageSwipeRef.current = null;
    setMobileMenuDragProgress(null);
    setMobileMenuOpen(false);
  }

  function openMobileMenu() {
    pageSwipeRef.current = null;
    setMobileMenuDragProgress(null);
    setMobileMenuOpen(true);
    setNotificationsOpen(false);
  }

  function getMobileDrawerWidth() {
    return (
      sidebarRef.current?.getBoundingClientRect().width ||
      Math.min(310, document.documentElement.clientWidth * 0.86)
    );
  }

  function beginMobileMenuDrag(clientX, clientY, eventTarget, pointerId) {
    if (window.innerWidth > 1180) return;
    const target = eventTarget instanceof Element ? eventTarget : null;
    const gestureSurface = mobileMenuOpen
      ? target?.closest('.sidebar, .mobileMenuBackdrop')
      : target?.closest('.mobileMenuHandle');
    if (!gestureSurface) {
      pageSwipeRef.current = null;
      return;
    }

    const interactiveAncestor = target?.closest(
      'input, textarea, select, [contenteditable="true"], .leaflet-container, canvas, button, a',
    );
    const isGestureControl =
      interactiveAncestor?.classList.contains('mobileMenuHandle') ||
      interactiveAncestor?.classList.contains('mobileMenuBackdrop');
    if (interactiveAncestor && !isGestureControl) {
      pageSwipeRef.current = null;
      return;
    }

    pageSwipeRef.current = {
      x: clientX,
      y: clientY,
      startedAt: Date.now(),
      initialProgress: mobileMenuOpen ? 1 : 0,
      lastX: clientX,
      pointerId,
      dragging: false,
    };
  }

  function updateMobileMenuDrag(clientX, clientY, event) {
    const start = pageSwipeRef.current;
    if (!start || (start.pointerId !== undefined && start.pointerId !== event.pointerId)) return;

    const deltaX = clientX - start.x;
    const deltaY = clientY - start.y;
    start.lastX = clientX;
    if (!start.dragging) {
      if (Math.abs(deltaX) < 8 && Math.abs(deltaY) < 8) return;
      if (Math.abs(deltaY) >= Math.abs(deltaX)) {
        pageSwipeRef.current = null;
        return;
      }
      start.dragging = true;
      if (typeof event.pointerId === 'number') {
        try {
          event.currentTarget.setPointerCapture?.(event.pointerId);
        } catch {
          cancelPageSwipe(event);
          return;
        }
      }
    }

    const isRtl = language === 'he';
    const drawerWidth = getMobileDrawerWidth();
    const openingDistance = deltaX * (isRtl ? -1 : 1);
    const progress = Math.max(
      0,
      Math.min(1, start.initialProgress + openingDistance / drawerWidth),
    );
    if (event.cancelable) event.preventDefault();
    setMobileMenuDragProgress(progress);
  }

  function finishMobileMenuDrag(clientX, pointerId) {
    const start = pageSwipeRef.current;
    if (start?.pointerId !== undefined && start.pointerId !== pointerId) return;
    pageSwipeRef.current = null;
    if (!start?.dragging) return;

    const isRtl = language === 'he';
    const endX = Number.isFinite(clientX) ? clientX : start.lastX;
    const deltaX = endX - start.x;
    const openingDistance = deltaX * (isRtl ? -1 : 1);
    const drawerWidth = getMobileDrawerWidth();
    const progress = Math.max(
      0,
      Math.min(1, start.initialProgress + openingDistance / drawerWidth),
    );
    const quickSwipe = Date.now() - start.startedAt < 300;
    const shouldOpen = quickSwipe
      ? openingDistance > 42 || (openingDistance >= -42 && progress >= 0.5)
      : progress >= 0.5;

    suppressPageClickRef.current = true;
    window.setTimeout(() => {
      suppressPageClickRef.current = false;
    }, 450);
    if (shouldOpen) setNotificationsOpen(false);
    setMobileMenuOpen(shouldOpen);
    setMobileMenuDragProgress(null);
  }

  function startPagePointerSwipe(event) {
    if (!event.isPrimary || (event.pointerType === 'mouse' && event.button !== 0)) return;
    beginMobileMenuDrag(event.clientX, event.clientY, event.target, event.pointerId);
  }

  function movePagePointerSwipe(event) {
    updateMobileMenuDrag(event.clientX, event.clientY, event);
  }

  function finishPagePointerSwipe(event) {
    finishMobileMenuDrag(event.clientX, event.pointerId);
  }

  function cancelPageSwipe(event) {
    const start = pageSwipeRef.current;
    if (start?.pointerId !== undefined && start.pointerId !== event?.pointerId) return;
    pageSwipeRef.current = null;
    if (!start?.dragging) return;
    setMobileMenuOpen(start.initialProgress === 1);
    setMobileMenuDragProgress(null);
  }

  function suppressClickAfterPageSwipe(event) {
    if (!suppressPageClickRef.current) return;
    suppressPageClickRef.current = false;
    event.preventDefault();
    event.stopPropagation();
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
      onPointerDownCapture={startPagePointerSwipe}
      onPointerMoveCapture={movePagePointerSwipe}
      onPointerUpCapture={finishPagePointerSwipe}
      onPointerCancelCapture={cancelPageSwipe}
      onClickCapture={suppressClickAfterPageSwipe}
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

      {notificationsOpen && (
        <NotificationsPopover
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

      {!mobileMenuOpen && (
        <button
          className="mobileMenuHandle"
          onClick={openMobileMenu}
          aria-label={t('פתיחת תפריט')}
          aria-controls="main-navigation"
          aria-expanded="false"
          title={t('פתיחת תפריט')}
        >
          {language === 'he' ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
        </button>
      )}

      <section className="container layout">
        {(mobileMenuOpen || mobileMenuDragProgress !== null) && (
          <button
            className="mobileMenuBackdrop"
            aria-label={t('סגירת תפריט')}
            onClick={closeMobileMenu}
            style={
              mobileMenuDragProgress === null
                ? undefined
                : {
                    opacity: mobileMenuDragProgress,
                    transition: 'none',
                  }
            }
          />
        )}
        <aside
          ref={sidebarRef}
          id="main-navigation"
          className={`sidebar sidebarCompact ${mobileMenuOpen ? 'mobileOpen' : ''} ${
            mobileMenuDragProgress === null ? '' : 'mobileDragging'
          }`}
          aria-label={t('תפריט ראשי')}
          style={
            mobileMenuDragProgress === null
              ? undefined
              : {
                  opacity: 1,
                  visibility: 'visible',
                  transform: `translate3d(${(language === 'he' ? 1 : -1) * (1 - mobileMenuDragProgress) * 105}%, 0, 0)`,
                }
          }
        >
          <DashboardNavigation
            role={profile ? t(roleLabel[profile.role]) : t('משתמש')}
            isManager={isManager}
            isDrafter={isDrafter}
            pathname={location.pathname}
            isProjectWorkspace={isProjectWorkspace}
            stats={stats}
            unreadCount={unreadCount}
            onOpenTab={openTab}
            onClose={closeMobileMenu}
          />
        </aside>

        <section className="mainContent">
          {showHero && <DashboardHero title={tabTitle} subtitle={tabSubtitle} />}

          {message && (
            <div className="appToast" role="status" aria-live="polite">
              <span className="appToastIcon">
                <CheckCircle size={18} />
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

      <AttendanceEndDialog />
      <ProjectWorkEndDialog />
    </main>
  );
}
