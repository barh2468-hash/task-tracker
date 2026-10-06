import { useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowLeftRight,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  ChartNoAxesCombined,
  LayoutDashboard,
} from 'lucide-react';
import { t, useLanguage } from '../features/language/LanguageContext.jsx';
import { useAuth } from '../features/auth/useAuth.js';
import { useProjects } from '../features/projects/ProjectsContext.jsx';
import {
  buildOverviewAttention,
  getOverviewActivity,
} from '../features/reporting/utils/overview.js';
import { projectDeepLinkPath } from '../utils/navigation.js';
import StatsGrid from '../components/StatsGrid.jsx';
import StatusPill from '../components/StatusPill.jsx';
import { appStatuses } from '../services/supabase.js';

const issueLabels = {
  unassigned: 'ללא שיוך',
  old_task: 'משימה פתוחה',
  stale_project: 'ללא עדכון',
  permits_wait: 'ממתין להיתרים',
  open_work: 'עבודה פתוחה',
};

const mobileQuery = '(max-width: 640px)';
const subscribeMobile = (callback) => {
  const media = window.matchMedia(mobileQuery);
  media.addEventListener('change', callback);
  return () => media.removeEventListener('change', callback);
};
const getMobileSnapshot = () => window.matchMedia(mobileQuery).matches;
const getServerSnapshot = () => false;

function issueAgeLabel(item) {
  if (item.ageValue === undefined) return '';
  if (item.ageUnit === 'created') {
    if (item.ageValue === 0) return t('נוצר היום');
    if (item.ageValue === 1) return t('נוצר לפני יום אחד');
    return t('נוצר לפני {{count}} ימים', { count: item.ageValue });
  }
  if (item.ageUnit === 'hours')
    return item.ageValue === 1 ? t('שעה אחת') : t('{{count}} שעות', { count: item.ageValue });
  return item.ageValue === 1 ? t('יום אחד') : t('{{count}} ימים', { count: item.ageValue });
}

export default function OverviewPage() {
  useTranslation();
  const { language } = useLanguage();
  const { isDrafter } = useAuth();
  const isMobile = useSyncExternalStore(subscribeMobile, getMobileSnapshot, getServerSnapshot);
  const [selectedTab, setSelectedTab] = useState('attention');
  const tabRefs = useRef([]);
  const tabs = [
    { id: 'summary', label: 'תמונת מצב', icon: ChartNoAxesCombined },
    { id: 'attention', label: 'נושאים למעקב', icon: ClipboardList },
    { id: 'activity', label: 'עדכונים אחרונים', icon: ArrowLeftRight },
  ];
  const activeTab = tabs.some((tab) => tab.id === selectedTab) ? selectedTab : 'attention';
  const panelProps = (id) => ({
    id: `overview-panel-${id}`,
    ...(isMobile && {
      role: 'tabpanel',
      'aria-labelledby': `overview-tab-${id}`,
      hidden: activeTab !== id,
      tabIndex: 0,
    }),
  });
  const onTabKeyDown = (event, index) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const horizontalStep = language === 'he' ? -1 : 1;
    const steps = { ArrowRight: horizontalStep, ArrowLeft: -horizontalStep, ArrowDown: 1, ArrowUp: -1 };
    let nextIndex;
    if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = tabs.length - 1;
    else if (event.key in steps) nextIndex = (index + steps[event.key] + tabs.length) % tabs.length;
    else return;
    event.preventDefault();
    setSelectedTab(tabs[nextIndex].id);
    tabRefs.current[nextIndex]?.focus();
  };
  const { projects, projectsLoaded, historyItems } = useProjects();
  const loading = !projectsLoaded && !projects.length;
  const attention = useMemo(() => buildOverviewAttention(projects), [projects]);
  const activity = useMemo(
    () => getOverviewActivity(historyItems, projects, appStatuses),
    [historyItems, projects],
  );
  const activeProjectCount = projects.filter((project) => !project.is_archived).length;
  const locale = language === 'he' ? 'he-IL' : language === 'el' ? 'el-GR' : 'en-GB';
  const dateLabel = new Date().toLocaleDateString(locale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="overviewPage">
      <header className="overviewIntro">
        <div className="overviewIntroIcon" aria-hidden="true">
          <LayoutDashboard size={24} />
        </div>
        <div>
          <span className="overviewEyebrow">MAYA / OVERVIEW</span>
          <div className="overviewTitleRow">
            <h2>{t('סקירה כללית')}</h2>
            <span className="overviewProjectTotal">
              <strong>{loading ? '—' : activeProjectCount}</strong>
              {t('פרויקטים פעילים')}
            </span>
          </div>
          <p>{t('תמונת מצב של הפרויקטים והעבודה, במקום אחד.')}</p>
        </div>
        <span className="overviewDate">
          <CalendarDays size={17} aria-hidden="true" />
          {dateLabel}
        </span>
      </header>

      {isMobile && (
        <div className="overviewMobileTabs" role="tablist" aria-label={t('סקירה כללית')}>
          {tabs.map(({ id, label, icon: Icon }, index) => (
            <button
              key={id}
              id={`overview-tab-${id}`}
              ref={(node) => { tabRefs.current[index] = node; }}
              type="button"
              role="tab"
              aria-selected={activeTab === id}
              aria-controls={`overview-panel-${id}`}
              tabIndex={activeTab === id ? 0 : -1}
              onClick={() => setSelectedTab(id)}
              onKeyDown={(event) => onTabKeyDown(event, index)}
            >
              <Icon size={17} aria-hidden="true" />
              {t(label)}
            </button>
          ))}
        </div>
      )}

      <StatsGrid loading={loading} combineSections={isMobile} combinedPanelProps={panelProps('summary')}>
        <div className="overviewWorkspace" hidden={isMobile && !['attention', 'activity'].includes(activeTab)}>
          <section className="overviewAttention" aria-labelledby="overview-attention-heading" {...panelProps('attention')}>
            <header className="attentionHeader">
              <div className="attentionHeading">
                <span className="attentionSymbol" aria-hidden="true">
                  <ClipboardList size={23} />
                </span>
                <div>
                  <span className="attentionEyebrow">{t('מיקוד לעבודה')}</span>
                  <h2 id="overview-attention-heading">{t('נושאים למעקב')}</h2>
                </div>
              </div>
              <div className="attentionTotal">
                <strong>{loading ? '—' : attention.length}</strong>
                <span>{t('פרויקטים למעקב')}</span>
              </div>
              <div className="attentionSummary">
                {loading ? t('טוען...') : t('שיוך עובדים, משימות פתוחות ועדכונים חסרים')}
                <span>{t('לפי הזמן מאז העדכון האחרון')}</span>
              </div>
            </header>
            <div className="attentionList" aria-busy={loading}>
              {attention.slice(0, 3).map((item, index) => (
                <article className="attentionItem" key={item.project.id}>
                  <span className="attentionIndex" aria-hidden="true">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <div className="attentionItemBody">
                    <div className="attentionItemMeta">
                      <span className="attentionReason">
                        {t(issueLabels[item.type] || item.title)}
                      </span>
                      {issueAgeLabel(item) && (
                        <span className="attentionAge">{issueAgeLabel(item)}</span>
                      )}
                    </div>
                    <h3>{item.project.name}</h3>
                    <p>{t(item.descriptionKey || item.description, item.descriptionValues)}</p>
                    <div className="attentionItemFooter">
                      <span>
                        {item.project.profiles?.full_name || t('לא משויך')}
                        {item.issueCount > 1 &&
                          ` · ${item.issueCount === 2 ? t('נושא נוסף') : t('ועוד {{count}} נושאים', { count: item.issueCount - 1 })}`}
                      </span>
                      <Link to={projectDeepLinkPath(item.project)}>
                        {t('צפייה בפרויקט')}
                        <ArrowLeft size={14} aria-hidden="true" />
                      </Link>
                    </div>
                  </div>
                </article>
              ))}
              {loading && (
                <div className="overviewEmpty" role="status">
                  {t('טוען...')}
                </div>
              )}
              {!loading && !attention.length && (
                <div className="overviewEmpty">
                  <CheckCircle2 size={32} />
                  <h3>{t('הכול מעודכן')}</h3>
                  <p>{t('אין כרגע פרויקטים שדורשים תשומת לב.')}</p>
                </div>
              )}
            </div>
            {!isDrafter && (
              <footer className="overviewPanelFooter">
                <span>{t('מבוסס על החריגות בפרויקטים הפעילים')}</span>
                <Link to="/app/exceptions">
                  {t('לכל החריגות')}
                  <ArrowLeft size={16} aria-hidden="true" />
                </Link>
              </footer>
            )}
          </section>

          <section className="overviewActivity" aria-labelledby="overview-activity-heading" {...panelProps('activity')}>
            <header className="activityHeader">
              <span className="activitySymbol" aria-hidden="true">
                <ArrowLeftRight size={20} />
              </span>
              <div>
                <h2 id="overview-activity-heading">{t('עדכונים אחרונים')}</h2>
                <p>{t('שינויי סטטוס בפרויקטים')}</p>
              </div>
            </header>
            <ol className="overviewTimeline">
              {activity.map((item) => (
                <li key={item.id}>
                  <span className="timelineDot" aria-hidden="true" />
                  <time dateTime={item.created_at}>
                    {new Date(item.created_at).toLocaleString(locale, {
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </time>
                  <Link className="activityProjectLink" to={projectDeepLinkPath(item.project)}>
                    {item.project.name}
                  </Link>
                  <div className="activityTransition">
                    {item.old_status && <span>{t(item.old_status)}</span>}
                    {item.old_status && <ArrowLeft size={13} aria-hidden="true" />}
                    <StatusPill status={item.new_status} />
                  </div>
                  <span className="activityAuthor">{item.profiles?.full_name || t('מערכת')}</span>
                </li>
              ))}
            </ol>
            {loading && (
              <div className="overviewEmpty" role="status">
                {t('טוען...')}
              </div>
            )}
            {!loading && !activity.length && (
              <div className="overviewEmpty">
                <ArrowLeftRight size={28} />
                <h3>{t('אין עדכונים להצגה')}</h3>
                <p>{t('שינויי סטטוס יופיעו כאן לאחר עדכון הפרויקטים.')}</p>
              </div>
            )}
            <footer className="overviewPanelFooter">
              <Link to="/app/history">
                {t('לכל העדכונים')}
                <ArrowLeft size={16} aria-hidden="true" />
              </Link>
            </footer>
          </section>
        </div>
      </StatsGrid>
    </div>
  );
}
