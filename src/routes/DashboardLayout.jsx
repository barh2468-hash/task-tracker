import { useTranslation } from 'react-i18next';
import { t } from '../features/language/LanguageContext.jsx';
import { useEffect, useState } from 'react';
import { Outlet, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Archive,
  Bell,
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
  Menu,
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

export default function DashboardLayout() {
  useTranslation();
  const { profile, session, isManager, isDrafter, logout } = useAuth();
  const { message, setMessage } = useMessage();
  const { unreadCount } = useNotifications();
  const { language, setLanguage } = useLanguage();
  const { stats } = useProjectStats();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const lockedScrollY = window.scrollY;
    const previousBodyOverflow = document.body.style.overflow;
    const previousBodyPosition = document.body.style.position;
    const previousBodyTop = document.body.style.top;
    const previousBodyWidth = document.body.style.width;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.top = `-${lockedScrollY}px`;
    document.body.style.width = '100%';
    document.documentElement.style.overflow = 'hidden';
    const resetMenuScroll = window.requestAnimationFrame(() => {
      document.querySelector('.sidebar')?.scrollTo({ left: 0 });
    });
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setMobileMenuOpen(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.body.style.position = previousBodyPosition;
      document.body.style.top = previousBodyTop;
      document.body.style.width = previousBodyWidth;
      document.documentElement.style.overflow = previousHtmlOverflow;
      window.scrollTo(0, lockedScrollY);
      window.cancelAnimationFrame(resetMenuScroll);
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [mobileMenuOpen]);

  function openTab(path) {
    navigate(path);
    setMobileMenuOpen(false);
  }

  const projectsFilter = searchParams.get('filter') || (isManager ? 'all' : 'mine');
  const isProjectsRoute = location.pathname === '/app/projects';
  const navActive = (path) => location.pathname === path;

  const tabTitle = getTabTitle(location.pathname, searchParams, isManager);
  const tabSubtitle = getTabSubtitle(isManager, isDrafter);
  const showHeroAndStats = !isHeroSuppressed(location.pathname);

  return (
    <main className="page">
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
              className={`notificationBell ${notificationsOpen ? 'active' : ''}`}
              onClick={() => setNotificationsOpen((open) => !open)}
              title={t('התראות')}
            >
              <Bell size={18} />
              {unreadCount > 0 && <span>{unreadCount}</span>}
            </button>
            {notificationsOpen && (
              <NotificationsPopover
                onClose={() => setNotificationsOpen(false)}
                onOpenFullPage={() => {
                  openTab('/app/notifications');
                  setNotificationsOpen(false);
                }}
                onOpenProject={(project) => {
                  setNotificationsOpen(false);
                  navigate(projectDeepLinkPath(project));
                }}
              />
            )}
          </div>
          <button
            className={`mobileMenuButton ${mobileMenuOpen ? 'active' : ''}`}
            onClick={() => {
              setMobileMenuOpen((open) => !open);
              setNotificationsOpen(false);
            }}
            aria-label={mobileMenuOpen ? t('סגירת תפריט') : t('פתיחת תפריט')}
            aria-expanded={mobileMenuOpen}
            title={t('תפריט')}
          >
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
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

      <section className="container layout">
        {mobileMenuOpen && (
          <button
            className="mobileMenuBackdrop"
            aria-label={t('סגירת תפריט')}
            onClick={() => setMobileMenuOpen(false)}
          />
        )}
        <aside
          className={`sidebar ${mobileMenuOpen ? 'mobileOpen' : ''}`}
          aria-label={t('תפריט ראשי')}
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
              <span>
                {t('משימות פתוחות (')}
                {stats.openTasks})
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
              <span>
                {t('דוח חריגות (')}
                {stats.exceptions})
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
              <span>
                {t('ללא שיוך (')}
                {stats.unassigned})
              </span>
              <FolderKanban size={18} />
            </button>
          )}
          {isManager && (
            <button
              className={`navBtn ${isProjectsRoute && projectsFilter === 'archive' ? 'active' : ''}`}
              onClick={() => openTab('/app/projects?filter=archive')}
            >
              <span>
                {t('ארכיון (')}
                {stats.archived})
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
            <span>
              {t('התראות')}
              {unreadCount > 0 ? `(${unreadCount})` : ''}
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

          {(profile?.role === 'field_worker' || profile?.role === 'manager') && (
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

      {(profile?.role === 'field_worker' || profile?.role === 'manager') && (
        <MobileAttendanceDock />
      )}
      <AttendanceEndDialog />
      <ProjectWorkEndDialog />
    </main>
  );
}
