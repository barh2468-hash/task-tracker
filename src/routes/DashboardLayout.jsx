import { useTranslation } from 'react-i18next';
import { t } from '../features/language/LanguageContext.jsx';
import { useEffect, useRef, useState } from 'react';
import { Outlet, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Archive,
  Bell,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Clock,
  Download,
  FilePlus2,
  FileText,
  FolderKanban,
  History,
  Languages,
  LogOut,
  MapPin,
  MessageCircle,
  X,
  AlertTriangle,
  Users,
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
import StatsGrid from '../components/StatsGrid.jsx';
import NotificationsPopover from '../features/notifications/components/NotificationsPopover.jsx';
import PwaControls from '../features/pwa/components/PwaControls.jsx';
import GeneralAttendanceCard from '../features/attendance/components/GeneralAttendanceCard.jsx';
import MobileAttendanceDock from '../features/attendance/components/MobileAttendanceDock.jsx';
import AttendanceEndDialog from '../features/attendance/components/AttendanceEndDialog.jsx';
import ProjectWorkEndDialog from '../features/attendance/components/ProjectWorkEndDialog.jsx';
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
  const pageSwipeRef = useRef(null);
  const suppressPageClickRef = useRef(false);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const resetMenuScroll = window.requestAnimationFrame(() => {
      document.querySelector('.sidebar')?.scrollTo({ left: 0 });
    });
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setMobileMenuOpen(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      window.cancelAnimationFrame(resetMenuScroll);
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [mobileMenuOpen]);

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
    setMobileMenuOpen(false);
  }

  function openMobileMenu() {
    setMobileMenuOpen(true);
    setNotificationsOpen(false);
  }

  function beginMobileMenuDrag(clientX, clientY, eventTarget) {
    if (window.innerWidth > 760) return;
    const target = eventTarget instanceof Element ? eventTarget : null;
    if (target?.closest('input, textarea, select, [contenteditable="true"], .leaflet-container, canvas')) {
      pageSwipeRef.current = null;
      return;
    }

    pageSwipeRef.current = {
      x: clientX,
      y: clientY,
      startedAt: Date.now(),
      initialProgress: mobileMenuOpen ? 1 : 0,
      dragging: false,
    };
  }

  function updateMobileMenuDrag(clientX, clientY, event) {
    const start = pageSwipeRef.current;
    if (!start) return;

    const deltaX = clientX - start.x;
    const deltaY = clientY - start.y;
    if (!start.dragging) {
      if (Math.abs(deltaX) < 8 && Math.abs(deltaY) < 8) return;
      if (Math.abs(deltaY) >= Math.abs(deltaX)) {
        pageSwipeRef.current = null;
        return;
      }
      start.dragging = true;
      if (typeof event.pointerId === 'number') {
        event.currentTarget.setPointerCapture?.(event.pointerId);
      }
    }

    const isRtl = language === 'he';
    const drawerWidth = Math.min(310, window.innerWidth * 0.86);
    const openingDistance = deltaX * (isRtl ? -1 : 1);
    const progress = Math.max(0, Math.min(1, start.initialProgress + openingDistance / drawerWidth));
    if (event.cancelable) event.preventDefault();
    setMobileMenuDragProgress(progress);
  }

  function finishMobileMenuDrag(clientX) {
    const start = pageSwipeRef.current;
    pageSwipeRef.current = null;
    if (!start?.dragging) return;

    const isRtl = language === 'he';
    const deltaX = clientX - start.x;
    const openingDistance = deltaX * (isRtl ? -1 : 1);
    const drawerWidth = Math.min(310, window.innerWidth * 0.86);
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

  function startPageSwipe(event) {
    if (event.touches.length !== 1) return;
    const touch = event.touches[0];
    beginMobileMenuDrag(touch.clientX, touch.clientY, event.target);
  }

  function movePageSwipe(event) {
    const touch = event.touches[0];
    if (!touch) return;
    updateMobileMenuDrag(touch.clientX, touch.clientY, event);
  }

  function finishPageSwipe(event) {
    const touch = event.changedTouches[0];
    if (!touch) return;
    finishMobileMenuDrag(touch.clientX);
  }

  function startPagePointerSwipe(event) {
    if (event.pointerType !== 'mouse' || event.button !== 0) return;
    beginMobileMenuDrag(event.clientX, event.clientY, event.target);
  }

  function movePagePointerSwipe(event) {
    if (event.pointerType !== 'mouse') return;
    updateMobileMenuDrag(event.clientX, event.clientY, event);
  }

  function finishPagePointerSwipe(event) {
    if (event.pointerType !== 'mouse') return;
    finishMobileMenuDrag(event.clientX);
  }

  function cancelPageSwipe() {
    const start = pageSwipeRef.current;
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

  const projectsFilter = searchParams.get('filter') || (isManager ? 'all' : 'mine');
  const isProjectsRoute = location.pathname === '/app/projects';
  const navActive = (path) => location.pathname === path;

  const tabTitle = getTabTitle(location.pathname, searchParams, isManager);
  const tabSubtitle = getTabSubtitle(isManager, isDrafter);
  const showHeroAndStats = !isHeroSuppressed(location.pathname);

  return (
    <main
      className={`page${location.pathname === '/app/chat' ? ' chatPage' : ''}`}
      onTouchStartCapture={startPageSwipe}
      onTouchMoveCapture={movePageSwipe}
      onTouchEndCapture={finishPageSwipe}
      onTouchCancelCapture={cancelPageSwipe}
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
          <span className="mobileMenuHandleGrip" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          {language === 'he' ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
        </button>
      )}

      <section className="container layout">
        {(mobileMenuOpen || mobileMenuDragProgress !== null) && (
          <button
            className="mobileMenuBackdrop"
            aria-label={t('סגירת תפריט')}
            onClick={() => setMobileMenuOpen(false)}
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
          id="main-navigation"
          className={`sidebar ${mobileMenuOpen ? 'mobileOpen' : ''} ${
            mobileMenuDragProgress === null ? '' : 'mobileDragging'
          }`}
          aria-label={t('תפריט ראשי')}
          style={
            mobileMenuDragProgress === null
              ? undefined
              : {
                  opacity: mobileMenuDragProgress,
                  visibility: 'visible',
                  transform: `translateX(${(language === 'he' ? 1 : -1) * (1 - mobileMenuDragProgress) * 105}%)`,
                }
          }
        >
          <div className="mobileMenuHeader">
            <div>
              <b>{t('תפריט ראשי')}</b>
              <small>{profile ? t(roleLabel[profile.role]) : t('משתמש')}</small>
            </div>
            <button
              className="mobileMenuClose"
              aria-label={t('סגירת תפריט')}
              onClick={() => setMobileMenuOpen(false)}
            >
              <X size={19} />
            </button>
          </div>
          <div className="logoBox">
            <img src="/logo.png" alt={t('לוגו')} />
            <b>
              {t('תשתיות')}

              <br />
              {t('מתקדמות')}
            </b>
          </div>
          <PwaControls />
          <button
            className={`navBtn ${navActive('/app/chat') ? 'active' : ''}`}
            onClick={() => openTab('/app/chat')}
          >
            <span className="navBtnLabel">
              <span>{t('צ׳אט פנימי')}</span>
              {unreadChatCount > 0 && (
                <span className="navCountBadge">{Math.min(unreadChatCount, 99)}</span>
              )}
            </span>
            <MessageCircle size={18} />
          </button>
          <div className="navSectionLabel">
            <span>{t('עבודה')}</span>
          </div>
          <button
            className={`navBtn ${isProjectsRoute && projectsFilter === 'mine' ? 'active' : ''}`}
            onClick={() => openTab('/app/projects?filter=mine')}
          >
            <span>{t('הפרויקטים שלי')}</span>
            <FolderKanban size={18} />
          </button>
          {isManager && (
            <button
              className={`navBtn ${isProjectsRoute && projectsFilter === 'all' ? 'active' : ''}`}
              onClick={() => openTab('/app/projects?filter=all')}
            >
              <span>{t('כל הפרויקטים')}</span>
              <Users size={18} />
            </button>
          )}
          {!isDrafter && (
            <button
              className={`navBtn ${navActive('/app/tasks') ? 'active' : ''}`}
              onClick={() => openTab('/app/tasks')}
            >
              <span className="navBtnLabel">
                <span>{t('משימות פתוחות')}</span>
                <span className="navCountBadge">{stats.openTasks}</span>
              </span>
              <ClipboardList size={18} />
            </button>
          )}
          {isManager && (
            <button
              className={`navBtn ${navActive('/app/assignments') ? 'active' : ''}`}
              onClick={() => openTab('/app/assignments')}
            >
              <span>{t('פרויקטים משויכים')}</span>
              <FolderKanban size={18} />
            </button>
          )}
          {!isDrafter && (
            <div className="navSectionLabel">
              <span>{t('שטח')}</span>
            </div>
          )}
          {isManager && (
            <button
              className={`navBtn ${navActive('/app/today') ? 'active' : ''}`}
              onClick={() => openTab('/app/today')}
            >
              <span>{t('היום בשטח')}</span>
              <Clock size={18} />
            </button>
          )}
          {isManager && (
            <button
              className={`navBtn ${navActive('/app/map') ? 'active' : ''}`}
              onClick={() => openTab('/app/map')}
            >
              <span>{t('מפה חיה')}</span>
              <MapPin size={18} />
            </button>
          )}
          {!isDrafter && (
            <button
              className={`navBtn ${navActive('/app/exceptions') ? 'active' : ''}`}
              onClick={() => openTab('/app/exceptions')}
            >
              <span className="navBtnLabel">
                <span>{t('דוח חריגות')}</span>
                <span className="navCountBadge">{stats.exceptions}</span>
              </span>
              <AlertTriangle size={18} />
            </button>
          )}
          <div className="navSectionLabel">
            <span>{t('ניהול ומידע')}</span>
          </div>
          {isManager && (
            <button
              className={`navBtn ${navActive('/app/status-report') ? 'active' : ''}`}
              onClick={() => openTab('/app/status-report')}
            >
              <span>{t('דו״ח מצב פרויקטים')}</span>
              <FileText size={18} />
            </button>
          )}
          {isManager && (
            <button
              className={`navBtn ${isProjectsRoute && projectsFilter === 'unassigned' ? 'active' : ''}`}
              onClick={() => openTab('/app/projects?filter=unassigned')}
            >
              <span className="navBtnLabel">
                <span>{t('ללא שיוך')}</span>
                <span className="navCountBadge">{stats.unassigned}</span>
              </span>
              <FolderKanban size={18} />
            </button>
          )}
          {isManager && (
            <button
              className={`navBtn ${isProjectsRoute && projectsFilter === 'archive' ? 'active' : ''}`}
              onClick={() => openTab('/app/projects?filter=archive')}
            >
              <span className="navBtnLabel">
                <span>{t('ארכיון')}</span>
                <span className="navCountBadge">{stats.archived}</span>
              </span>
              <Archive size={18} />
            </button>
          )}
          {isManager && (
            <button
              className={`navBtn ${navActive('/app/projects/new') ? 'active' : ''}`}
              onClick={() => openTab('/app/projects/new')}
            >
              <span>{t('הוספת פרויקט')}</span>
              <FilePlus2 size={18} />
            </button>
          )}
          <button
            className={`navBtn ${navActive('/app/history') ? 'active' : ''}`}
            onClick={() => openTab('/app/history')}
          >
            <span>{t('היסטוריית שינויים')}</span>
            <History size={18} />
          </button>
          <button
            className={`navBtn ${navActive('/app/notifications') ? 'active' : ''}`}
            onClick={() => openTab('/app/notifications')}
          >
            <span className="navBtnLabel">
              <span>{t('התראות')}</span>
              {unreadCount > 0 && <span className="navCountBadge">{unreadCount}</span>}
            </span>
            <Bell size={18} />
          </button>
          {isManager && (
            <button
              className={`navBtn ${navActive('/app/report') ? 'active' : ''}`}
              onClick={() => openTab('/app/report')}
            >
              <span>{t('דוח שעות עובדים')}</span>
              <Download size={18} />
            </button>
          )}
          <p style={{ marginTop: 30, color: 'rgba(255,255,255,.72)', lineHeight: 1.7 }}>
            {t('מותאם לאייפון, אנדרואיד ומחשב. עדכונים בזמן אמת דרך Supabase.')}
          </p>
        </aside>

        <section className="mainContent">
          {showHeroAndStats && <DashboardHero title={tabTitle} subtitle={tabSubtitle} />}

          {location.pathname !== '/app/chat' &&
            (profile?.role === 'field_worker' || profile?.role === 'manager') && (
              <GeneralAttendanceCard />
            )}

          {showHeroAndStats && <StatsGrid />}

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

          <Outlet />
        </section>
      </section>

      {location.pathname !== '/app/chat' &&
        (profile?.role === 'field_worker' || profile?.role === 'manager') && (
          <MobileAttendanceDock />
        )}
      <AttendanceEndDialog />
      <ProjectWorkEndDialog />
    </main>
  );
}
