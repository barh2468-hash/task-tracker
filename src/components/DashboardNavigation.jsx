import { useTranslation } from 'react-i18next';
import {
  Activity, AlertTriangle, Bell, Car, ChartNoAxesCombined, ChevronDown, ClipboardList,
  Clock, Download, FileText, FolderKanban, HardHat, History, LayoutDashboard,
  BookOpen, Eye, Layers, MapPin, Radar, ShieldCheck, Wrench, Users,
} from 'lucide-react';
import { t, useLanguage } from '../features/language/LanguageContext.jsx';
import { localeForLanguage } from '../features/language/locale.js';
import AppPreferences from './AppPreferences.jsx';
import '../styles/navigation.css';

function NavigationItem({ label, icon: Icon, active, count, onClick }) {
  const { language } = useLanguage();
  return (
    <button
      type="button"
      className={`navBtn${active ? ' active' : ''}`}
      aria-current={active ? 'page' : undefined}
      onClick={onClick}
    >
      <Icon size={18} aria-hidden="true" />
      <span className="sidebarNavText">{t(label)}</span>
      {count > 0 && <span className="navCountBadge">{count.toLocaleString(localeForLanguage(language))}</span>}
    </button>
  );
}

export default function DashboardNavigation({
  role, isManager, isAdmin, isDrafter, pathname, isProjectWorkspace, stats, unreadCount,
  onOpenTab, secondaryOnly = false, isDemo = false, isViewer = false,
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

  if (isViewer) return <nav className="sidebarNav" aria-label={t('תפריט ראשי')}>
    {item('/app/overview', 'סקירה כללית', LayoutDashboard)}
    {item('/app/projects', 'כל הפרויקטים', FolderKanban)}
    {item('/app/projects?filter=archive', 'ארכיון', History)}
    {item('/app/assignments', 'לפי עובד', Users)}
    {item('/app/work-plan', 'workPlan.title', ClipboardList)}
    {item('/app/tasks', 'משימות פתוחות', ClipboardList)}
    {item('/app/today', 'היום בשטח', HardHat)}
    {item('/app/map', 'מפה חיה', MapPin)}
    {item('/app/equipment', 'ציוד עובדי שטח', Wrench)}
    {item('/app/vehicles', 'רכבי חברה', Car)}
    {item('/app/gpr', 'gpr.title', Radar)}
    {item('/app/report', 'דוח שעות עבודה', Clock)}
    {item('/app/status-report', 'דוח סטטוס פרויקטים', ChartNoAxesCombined)}
    {item('/app/recent-status-changes', 'שינויי סטטוס אחרונים', Activity)}
    {item('/app/history', 'היסטוריה', History)}
    {item('/app/viewer-information', 'viewer.records', FileText)}
  </nav>;

  if (isDemo) return <>
    {!secondaryOnly && <header className="sidebarHeader">
      <div className="sidebarIdentity"><img src="/logo-transparent.png" alt={t('לוגו')} /><div><b>{t('קבוצת מאיה')}</b><small>{role}</small></div></div>
    </header>}
    <nav className="sidebarNav" aria-label={t('תפריט ראשי')}>
      <div className="sidebarNavGroup">
        <h2 className="sidebarGroupLabel">{t('יום העבודה')}</h2>
        {item('/app/overview', 'סקירה כללית', LayoutDashboard)}
      </div>
      <div className="sidebarNavGroup">
        <h2 className="sidebarGroupLabel">{t('עבודה')}</h2>
        <NavigationItem label="פרויקטים" icon={FolderKanban} active={isProjectWorkspace} count={stats.total} onClick={() => onOpenTab('/app/projects')} />
        {item('/app/projects?view=cases', 'demo.caseStudies', BookOpen, stats.caseStudies)}
      </div>
    </nav>
    {!secondaryOnly && <footer className="sidebarFooter demoSidebarNote"><Eye size={18} aria-hidden="true" /><span>{t('demo.readOnly')}</span></footer>}
  </>;

  return (
    <>
      {!secondaryOnly && <header className="sidebarHeader">
        <div className="sidebarIdentity">
          <img src="/logo-transparent.png" alt={t('לוגו')} />
          <div>
            <b>{t('קבוצת מאיה')}</b>
            <small>{role}</small>
          </div>
        </div>
      </header>}

      <nav className="sidebarNav" aria-label={t('תפריט ראשי')}>
        {(!secondaryOnly || !isDrafter) && <div className="sidebarNavGroup">
          <h2 className="sidebarGroupLabel">{t('יום העבודה')}</h2>
          {item('/app/overview', 'סקירה כללית', LayoutDashboard)}
          {item('/app/work-plan', 'workPlan.title', ClipboardList)}
          {!secondaryOnly && !isDrafter && item('/app/attendance', 'שעון נוכחות', Clock)}
          {!secondaryOnly && !isDrafter && item('/app/tasks', 'משימות פתוחות', ClipboardList, stats.openTasks)}
        </div>}

        {!secondaryOnly && <div className="sidebarNavGroup">
          <h2 className="sidebarGroupLabel">{t('עבודה')}</h2>
          <NavigationItem
            label="פרויקטים"
            icon={FolderKanban}
            active={isProjectWorkspace}
            onClick={() => onOpenTab(`/app/projects?filter=${isManager ? 'all' : 'mine'}`)}
          />
        </div>}

        <div className="sidebarNavGroup">
          <h2 className="sidebarGroupLabel">{t('כלי עבודה')}</h2>
          {secondaryOnly && isDrafter && item('/app/work-plan', 'workPlan.title', ClipboardList)}
          {item('/app/manhole-layout', 'פרישת שוחות', Layers)}
          {!isDrafter && item('/app/my-attendance', 'דוח הנוכחות שלי', Clock)}
          {!isDrafter && item('/app/my-notes', 'ההערות שלי', FileText)}
          {item('/app/my-vehicle', 'הרכב שלי', Car)}
          {!isManager && !isDrafter && item('/app/projects?filter=archive', 'הארכיון שלי', FolderKanban)}
        </div>

        {isManager && (
          <div className="sidebarNavGroup">
            <h2 className="sidebarGroupLabel">{t('ניהול שטח')}</h2>
            {item('/app/today', 'היום בשטח', HardHat)}
            {item('/app/map', 'מפה חיה', MapPin)}
            {item('/app/equipment', 'ציוד עובדי שטח', Wrench)}
            {item('/app/vehicles', 'רכבי חברה', Car)}
          </div>
        )}

        {isAdmin && (
          <div className="sidebarNavGroup">
            <h2 className="sidebarGroupLabel">{t('ניהול מערכת')}</h2>
            {item('/app/users', 'ניהול משתמשים', ShieldCheck)}
            {item('/app/gpr', 'gpr.title', Radar)}
          </div>
        )}

        {(!secondaryOnly || !isDrafter) && <details className="sidebarReports" open={secondaryOnly || reportPaths.includes(pathname)}>
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
        </details>}
      </nav>

      {!secondaryOnly && <footer className="sidebarFooter">
        {item('/app/notifications', 'התראות', Bell, unreadCount)}
        <AppPreferences />
      </footer>}
    </>
  );
}
