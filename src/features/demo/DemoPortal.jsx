import { useCallback, useEffect, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { BookOpen, Eye, FolderKanban, Languages, LogOut, ShieldCheck } from 'lucide-react';
import { useAuth } from '../auth/useAuth.js';
import { t, useLanguage } from '../language/LanguageContext.jsx';
import { languageOptions } from '../language/languages.js';
import { localeForLanguage } from '../language/locale.js';
import AppBrand from '../../components/AppBrand.jsx';
import DashboardHero from '../../components/DashboardHero.jsx';
import DashboardNavigation from '../../components/DashboardNavigation.jsx';
import MobileNavigation from '../../components/MobileNavigation.jsx';
import Stat from '../../components/Stat.jsx';
import DemoProjectWorkspace from './DemoProjectWorkspace.jsx';
import { listShowcases } from './api.js';
import { demoProjectPath, getDemoRoute, getDemoStats } from './workspace.js';
import '../projects/project-workspace.css';
import '../projects/project-search.css';
import './demo.css';

export default function DemoPortal() {
  const { profile, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      setProjects(await listShowcases());
    } catch {
      setProjects([]);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    load();
    const onFocus = () => {
      load();
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [load]);
  if (!['/app/projects', '/app/overview'].includes(location.pathname))
    return <Navigate to="/app/projects" replace />;
  return (
    <DemoPortalView
      projects={projects}
      loading={loading}
      error={error}
      onReload={load}
      profile={profile}
      onLogout={logout}
      path={location.pathname + location.search}
      onNavigate={navigate}
    />
  );
}

export function DemoPortalView({
  projects,
  loading,
  error,
  onReload,
  profile,
  onLogout,
  path,
  onNavigate,
}) {
  useTranslation();
  const { language, setLanguage } = useLanguage();
  const [localPath, setLocalPath] = useState('/app/projects');
  const currentPath = path ?? localPath;
  const { view, projectId } = getDemoRoute(currentPath);
  const selected = projects.find((project) => project.project_id === projectId);
  const stats = getDemoStats(projects);
  const format = (number) => number.toLocaleString(localeForLanguage(language));
  const openPath = (nextPath) => {
    if (onNavigate) onNavigate(nextPath);
    else setLocalPath(nextPath);
    window.scrollTo({ top: 0, behavior: 'instant' });
  };
  const title =
    view === 'overview' ? 'סקירה כללית' : view === 'cases' ? 'demo.caseStudies' : 'כל הפרויקטים';
  const navigationPath =
    view === 'overview'
      ? '/app/overview'
      : view === 'cases'
        ? '/app/projects?view=cases'
        : '/app/projects';
  const projectWorkspace = view === 'projects';
  const role = t('demo.role');
  return (
    <main className="page demoPage demoAppPage">
      <header className="topbar">
        <AppBrand />
        <div className="userRow">
          <label className="languageToggle" title={t('שפה')}>
            <Languages size={18} aria-hidden="true" />
            <select
              value={language}
              onChange={(event) => setLanguage(event.target.value)}
              aria-label={t('שפה')}
            >
              {languageOptions.map(({ code, labelKey }) => (
                <option key={code} value={code} lang={code}>
                  {t(labelKey)}
                </option>
              ))}
            </select>
          </label>
          <div className="avatar">{profile?.full_name?.[0] || t('demo.brand')[0]}</div>
          <div>
            <b>{profile?.full_name}</b>
            <p className="muted">{role}</p>
          </div>
          <button type="button" className="secondary" onClick={onLogout}>
            <LogOut size={16} aria-hidden="true" />
            {t('התנתקות')}
          </button>
        </div>
      </header>
      <section className="container layout">
        <aside id="main-navigation" className="sidebar sidebarCompact" aria-label={t('תפריט ראשי')}>
          <DashboardNavigation
            isDemo
            role={role}
            pathname={navigationPath}
            isProjectWorkspace={projectWorkspace}
            stats={stats}
            onOpenTab={openPath}
          />
        </aside>
        <section className="mainContent">
          {!selected && (
            <DashboardHero
              title={title}
              subtitle="demo.approvedOnly"
              widget={
                <div className="demoAccessWidget">
                  <span>
                    <ShieldCheck size={18} aria-hidden="true" />
                    {t('demo.readOnly')}
                  </span>
                  <strong>{format(stats.total)}</strong>
                  <small>{t('demo.approvedProjects')}</small>
                </div>
              }
            />
          )}
          {!selected && view !== 'overview' && (
            <div className="projectWorkspaceNavigation">
              <nav className="projectViewLinks" aria-label={t('תצוגות פרויקטים')}>
                {[
                  ['projects', '/app/projects', 'כל הפרויקטים', stats.total],
                  ['cases', '/app/projects?view=cases', 'demo.caseStudies', stats.caseStudies],
                ].map(([key, target, label, count]) => (
                  <button
                    type="button"
                    key={key}
                    className={'projectViewLink' + (view === key ? ' active' : '')}
                    aria-current={view === key ? 'page' : undefined}
                    onClick={() => openPath(target)}
                  >
                    <span>{t(label)}</span>
                    <span className="projectViewCount">{format(count)}</span>
                  </button>
                ))}
              </nav>
            </div>
          )}
          {loading ? (
            <section className="card" role="status">
              {t('demo.loading')}
            </section>
          ) : error ? (
            <section className="card" role="alert">
              <p>{t('demo.loadError')}</p>
              <button type="button" onClick={onReload}>
                {t('demo.retry')}
              </button>
            </section>
          ) : (
            <>
              {view === 'overview' && (
                <div className="statsGroups demoOverviewStats">
                  <section className="statsGroup">
                    <h2>{t('תמונת מצב')}</h2>
                    <div className="grid" style={{ '--overview-columns': 2 }}>
                      <Stat
                        number={format(stats.total)}
                        label={t('פרויקטים')}
                        icon={<FolderKanban />}
                        onClick={() => openPath('/app/projects')}
                      />
                      <Stat
                        number={format(stats.caseStudies)}
                        label={t('demo.caseStudies')}
                        icon={<BookOpen />}
                        onClick={() => openPath('/app/projects?view=cases')}
                      />
                    </div>
                  </section>
                </div>
              )}
              <DemoProjectWorkspace
                projects={projects}
                selectedId={projectId}
                onlyCases={view === 'cases'}
                onOpen={(id) => openPath(demoProjectPath(id, view === 'cases'))}
                onBack={() =>
                  openPath(view === 'cases' ? '/app/projects?view=cases' : '/app/projects')
                }
              />
            </>
          )}
          <p className="demoAccessNote">
            <Eye size={15} aria-hidden="true" />
            {t('demo.approvedOnly')}
          </p>
        </section>
      </section>
      <MobileNavigation
        isDemo
        role={role}
        displayName={profile?.full_name}
        pathname={navigationPath}
        isProjectWorkspace={projectWorkspace}
        stats={stats}
        onOpenTab={openPath}
        onOpenMore={() => {}}
        onLogout={onLogout}
      />
    </main>
  );
}
