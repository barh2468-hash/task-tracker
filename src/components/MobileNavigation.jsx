import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Check, ChevronDown, ClipboardList, Clock, Ellipsis, FolderKanban, History, Languages, LayoutDashboard,
  LogOut, MessageCircle, X,
} from 'lucide-react';
import { t, useLanguage } from '../features/language/LanguageContext.jsx';
import { useAttendance } from '../features/attendance/AttendanceContext.jsx';
import DashboardNavigation from './DashboardNavigation.jsx';
import AppPreferences from './AppPreferences.jsx';
import '../styles/mobile-navigation.css';

const languageOptions = [
  { code: 'he', label: 'עברית' },
  { code: 'en', label: 'English' },
  { code: 'el', label: 'Ελληνικά' },
];

function AttendanceNavTimer({ startedAt }) {
  const [now, setNow] = useState(Date.now);

  useEffect(() => {
    const update = () => setNow(Date.now());
    const interval = window.setInterval(update, 1000);
    document.addEventListener('visibilitychange', update);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', update);
    };
  }, []);

  const started = new Date(startedAt).getTime();
  const totalSeconds = Number.isFinite(started) ? Math.max(0, Math.floor((now - started) / 1000)) : 0;
  const elapsed = [Math.floor(totalSeconds / 3600), Math.floor(totalSeconds / 60) % 60, totalSeconds % 60]
    .map((value) => String(value).padStart(2, '0')).join(':');
  const circumference = 2 * Math.PI * 34;

  return (
    <>
      <svg className="mobileAttendanceTimerRing" viewBox="0 0 76 76" aria-hidden="true">
        <circle className="mobileAttendanceTimerTrack" cx="38" cy="38" r="34" />
        <circle
          className="mobileAttendanceTimerArc"
          cx="38" cy="38" r="34"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - (totalSeconds % 60) / 60)}
        />
      </svg>
      <span
        id="mobile-attendance-elapsed"
        className="mobileAttendanceTimer"
        role="timer"
        aria-live="off"
        aria-label={`${t('זמן עבודה')}: ${elapsed}`}
      >
        <bdi dir="ltr">{elapsed}</bdi>
      </span>
    </>
  );
}

export default function MobileNavigation({
  role, displayName, isManager, isAdmin, isDrafter, pathname, isProjectWorkspace, stats,
  unreadChatCount, onOpenTab, onOpenMore, onLogout,
}) {
  useTranslation();
  const { language, setLanguage } = useLanguage();
  const { myAttendanceSessions } = useAttendance();
  const openAttendance = myAttendanceSessions.find((item) => !item.ended_at && !item.is_all_day);
  const hasOpenAttendance = Boolean(openAttendance);
  const [moreOpen, setMoreOpen] = useState(false);
  const dialogRef = useRef(null);
  const closeRef = useRef(null);
  const moreRef = useRef(null);
  const languageDisclosureRef = useRef(null);
  const languageOptionsRef = useRef(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!moreOpen) {
      if (dialog.open) dialog.close();
      return;
    }

    dialog.showModal();
    closeRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const desktop = window.matchMedia('(min-width: 1181px)');
    const closeOnDesktop = () => {
      if (desktop.matches) setMoreOpen(false);
    };
    desktop.addEventListener('change', closeOnDesktop);
    return () => {
      document.body.style.overflow = previousOverflow;
      desktop.removeEventListener('change', closeOnDesktop);
      if (dialog.open) dialog.close();
    };
  }, [moreOpen]);

  function openTab(path) {
    setMoreOpen(false);
    onOpenTab(path);
  }

  const projectTab = {
    key: 'projects', label: 'פרויקטים', icon: FolderKanban,
    path: `/app/projects?filter=${isManager ? 'all' : 'mine'}`, active: isProjectWorkspace,
  };
  // Drafters keep their existing access: overview replaces the attendance shortcut.
  const tabs = isDrafter
    ? [projectTab,
      { key: 'history', label: 'היסטוריה', icon: History, path: '/app/history' },
      { key: 'overview', label: 'סקירה', icon: LayoutDashboard, path: '/app/overview', center: true }]
    : [projectTab,
      { key: 'tasks', label: 'משימות', icon: ClipboardList, path: '/app/tasks', count: stats.openTasks },
      { key: 'attendance', label: 'נוכחות', icon: Clock, path: '/app/attendance', center: true }];
  tabs.push({ key: 'chat', label: 'צ׳אט', icon: MessageCircle, path: '/app/chat', count: unreadChatCount });
  const isPrimaryPage = tabs.some((tab) => tab.active || tab.path === pathname);
  tabs.push({ key: 'more', label: 'עוד', icon: Ellipsis, active: moreOpen || (!isPrimaryPage && pathname !== '/app/notifications') });

  function closeOnBackdrop(event) {
    if (event.target !== event.currentTarget) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right ||
        event.clientY < bounds.top || event.clientY > bounds.bottom) {
      setMoreOpen(false);
    }
  }

  return (
    <>
      <nav className="mobileBottomNav" aria-label={t('תפריט ראשי')}>
        {tabs.map(({ key, label, icon: Icon, path, active, center, count }) => (
          <button
            key={key}
            ref={key === 'more' ? moreRef : undefined}
            type="button"
            className={`mobileBottomTab${center ? ' mobileBottomTabCenter' : ''}${key === 'attendance' && hasOpenAttendance ? ' mobileBottomTabAttendanceRunning' : ''}`}
            aria-label={count > 0 ? `${t(label)} (${count})` : t(label)}
            aria-describedby={key === 'attendance' && hasOpenAttendance ? 'mobile-attendance-elapsed' : undefined}
            aria-current={(key === 'more' ? active : !moreOpen && (active || pathname === path)) ? 'page' : undefined}
            aria-expanded={key === 'more' ? moreOpen : undefined}
            aria-haspopup={key === 'more' ? 'dialog' : undefined}
            aria-controls={key === 'more' ? 'mobile-more-navigation' : undefined}
            onClick={() => {
              if (key === 'more') {
                onOpenMore();
                if (languageDisclosureRef.current) languageDisclosureRef.current.open = false;
                setMoreOpen(true);
              } else openTab(path);
            }}
          >
            <span className="mobileBottomTabIcon">
              <Icon size={center ? 27 : 21} aria-hidden="true" />
              {key === 'attendance' && hasOpenAttendance && (
                <AttendanceNavTimer key={openAttendance.id} startedAt={openAttendance.started_at} />
              )}
              {count > 0 && <span className="mobileBottomBadge">{count > 99 ? '99+' : count}</span>}
            </span>
            <span className="mobileBottomTabLabel">{t(label)}</span>
          </button>
        ))}
      </nav>

      <dialog
        ref={dialogRef}
        id="mobile-more-navigation"
        className="mobileMoreSheet sidebarCompact"
        aria-labelledby="mobile-more-title"
        onCancel={() => setMoreOpen(false)}
        onClose={() => {
          // Ignore a queued close event if Strict Mode has already reopened the dialog.
          if (dialogRef.current?.open) return;
          setMoreOpen(false);
          moreRef.current?.focus();
        }}
        onPointerDown={closeOnBackdrop}
      >
        <div className="mobileMoreHeader">
          <div>
            <h2 id="mobile-more-title">{displayName}</h2>
            <p>{role}</p>
          </div>
          <button ref={closeRef} type="button" className="mobileMoreClose" aria-label={t('סגירת תפריט')} onClick={() => setMoreOpen(false)}>
            <X size={22} aria-hidden="true" />
          </button>
        </div>
        <div className="mobileMoreContent">
          <DashboardNavigation
            secondaryOnly
            role={role}
            isManager={isManager}
            isAdmin={isAdmin}
            isDrafter={isDrafter}
            pathname={pathname}
            isProjectWorkspace={isProjectWorkspace}
            stats={stats}
            onOpenTab={openTab}
          />
          <section className="mobileMoreAccount" aria-labelledby="mobile-account-title">
            <h3 id="mobile-account-title">{t('חשבון')}</h3>
            <div className="mobileMoreAccountActions">
              <details
                ref={languageDisclosureRef}
                className="mobileMoreLanguage"
                onToggle={(event) => {
                  if (event.currentTarget.open) {
                    window.requestAnimationFrame(() => languageOptionsRef.current?.scrollIntoView({ block: 'nearest' }));
                  }
                }}
              >
                <summary className="mobileMoreLanguageHeading">
                  <Languages size={19} aria-hidden="true" />
                  <span id="mobile-language-title">{t('שפה')}</span>
                  <span className="mobileMoreCurrentLanguage" lang={language} dir="auto">
                    {languageOptions.find((option) => option.code === language)?.label}
                  </span>
                  <ChevronDown className="mobileMoreLanguageChevron" size={17} aria-hidden="true" />
                </summary>
                <div ref={languageOptionsRef} className="mobileLanguageChoices" role="group" aria-labelledby="mobile-language-title">
                  {languageOptions.map(({ code, label }) => (
                    <button
                      key={code}
                      type="button"
                      lang={code}
                      aria-pressed={language === code}
                      onClick={async () => {
                        await setLanguage(code);
                        const disclosure = languageDisclosureRef.current;
                        if (disclosure) {
                          disclosure.open = false;
                          disclosure.querySelector('summary')?.focus({ preventScroll: true });
                        }
                      }}
                    >
                      <span className="mobileLanguageChoiceLabel" dir="auto">{label}</span>
                      {language === code && <Check size={18} aria-hidden="true" />}
                    </button>
                  ))}
                </div>
              </details>
              <button type="button" className="mobileMoreLogout" onClick={() => {
                setMoreOpen(false);
                onLogout();
              }}>
                <LogOut size={19} aria-hidden="true" />
                {t('התנתקות')}
              </button>
            </div>
          </section>
          <footer className="mobileMorePreferences">
            <AppPreferences />
          </footer>
        </div>
      </dialog>
    </>
  );
}
