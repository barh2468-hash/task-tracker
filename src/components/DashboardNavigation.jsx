import { useTranslation } from 'react-i18next';
import {
  Activity, AlertTriangle, Bell, ChartNoAxesCombined, ChevronDown, ClipboardList,
  Clock, Download, FileText, FolderKanban, HardHat, History, LayoutDashboard,
  MapPin, Settings2, Wrench, X,
} from 'lucide-react';
import { t } from '../features/language/LanguageContext.jsx';
import PwaControls from '../features/pwa/components/PwaControls.jsx';
import '../styles/navigation.css';

function NavigationItem({ label, icon: Icon, active, count, onClick }) {
  return (
    <button
      type="button"
      className={`navBtn${active ? ' active' : ''}`}
      aria-current={active ? 'page' : undefined}
      onClick={onClick}
    >
      <Icon size={18} aria-hidden="true" />
      <span className="sidebarNavText">{t(label)}</span>
      {count > 0 && <span className="navCountBadge">{count}</span>}
    </button>
  );
}

export default function DashboardNavigation({
  role, isManager, isDrafter, pathname, isProjectWorkspace, stats, unreadCount,
  onOpenTab, onClose,
}) {
  useTranslation();
  const item = (path, label, icon, count) => (
    <NavigationItem
      key={path}
      label={label}
      icon={icon}
      count={count}
      active={pathname === path}
      onClick={() => onOpenTab(path)}
    />
  );
  const reportPaths = ['/app/exceptions', '/app/status-report',
    '/app/recent-status-changes', '/app/history', '/app/report'];

  return (
    <>
      <header className="sidebarHeader">
        <div className="sidebarIdentity">
          <img src="/logo.png" alt={t('לוגו')} />
          <div>
            <b>{t('תשתיות מתקדמות')}</b>
            <small>{role}</small>
          </div>
        </div>
        <button type="button" className="mobileMenuClose" aria-label={t('סגירת תפריט')} onClick={onClose}>
          <X size={19} aria-hidden="true" />
        </button>
      </header>

      <nav className="sidebarNav" aria-label={t('תפריט ראשי')}>
        <div className="sidebarNavGroup">
          <h2 className="sidebarGroupLabel">{t('יום העבודה')}</h2>
          {item('/app/overview', 'סקירה כללית', LayoutDashboard)}
          {!isDrafter && item('/app/attendance', 'שעון נוכחות', Clock)}
          {!isDrafter && item('/app/tasks', 'משימות פתוחות', ClipboardList, stats.openTasks)}
        </div>

        <div className="sidebarNavGroup">
          <h2 className="sidebarGroupLabel">{t('עבודה')}</h2>
          <NavigationItem
            label="פרויקטים"
            icon={FolderKanban}
            active={isProjectWorkspace}
            onClick={() => onOpenTab(`/app/projects?filter=${isManager ? 'all' : 'mine'}`)}
          />
        </div>

        {isManager && (
          <div className="sidebarNavGroup">
            <h2 className="sidebarGroupLabel">{t('ניהול שטח')}</h2>
            {item('/app/today', 'היום בשטח', HardHat)}
            {item('/app/map', 'מפה חיה', MapPin)}
            {item('/app/equipment', 'ציוד עובדי שטח', Wrench)}
          </div>
        )}

        <details className="sidebarReports" open={reportPaths.includes(pathname)}>
          <summary className="sidebarDisclosure">
            <ChartNoAxesCombined size={18} aria-hidden="true" />
            <span className="sidebarNavText">{t('דוחות והיסטוריה')}</span>
            <ChevronDown className="sidebarChevron" size={15} aria-hidden="true" />
          </summary>
          <div className="sidebarReportLinks">
            {!isDrafter && item('/app/exceptions', 'דוח חריגות', AlertTriangle, stats.exceptions)}
            {isManager && item('/app/status-report', 'דו״ח מצב פרויקטים', FileText)}
            {isManager && item('/app/report', 'דוח שעות עובדים', Download)}
            {isManager && item('/app/recent-status-changes', 'שינויי סטטוס', Activity)}
            {item('/app/history', 'היסטוריית שינויים', History)}
          </div>
        </details>
      </nav>

      <footer className="sidebarFooter">
        {item('/app/notifications', 'התראות', Bell, unreadCount)}
        <details className="sidebarPreferences">
          <summary className="sidebarDisclosure">
            <Settings2 size={18} aria-hidden="true" />
            <span className="sidebarNavText">{t('העדפות אפליקציה')}</span>
            <ChevronDown className="sidebarChevron" size={15} aria-hidden="true" />
          </summary>
          <PwaControls />
        </details>
      </footer>
    </>
  );
}
