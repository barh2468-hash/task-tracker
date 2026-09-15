import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeftRight,
  Clock3,
  ExternalLink,
  FolderKanban,
  RefreshCw,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { statuses } from '../../../services/supabase.js';
import StatusPill, { getStatusClass } from '../../../components/StatusPill.jsx';
import { projectDeepLinkPath } from '../../../utils/navigation.js';
import { t, useLanguage } from '../../language/LanguageContext.jsx';
import { useRealtimeRefresh } from '../../../hooks/useRealtimeRefresh.js';
import {
  getProjectStatusChangesForDate,
  getRecentProjectStatusChanges,
} from '../api.js';

const ALL_STATUSES = 'all';
const ROLLING_PERIOD = 'rolling';
const DATE_PERIOD = 'date';

function toLocalDateValue(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default function RecentStatusChangesPanel() {
  useTranslation();
  const navigate = useNavigate();
  const { language } = useLanguage();
  const [changes, setChanges] = useState([]);
  const [selectedStatus, setSelectedStatus] = useState(ALL_STATUSES);
  const [period, setPeriod] = useState(ROLLING_PERIOD);
  const [selectedDate, setSelectedDate] = useState(() => toLocalDateValue());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const loadChanges = useCallback(async ({ manual = false } = {}) => {
    if (manual) setRefreshing(true);
    try {
      const data =
        period === DATE_PERIOD
          ? await getProjectStatusChangesForDate(selectedDate)
          : await getRecentProjectStatusChanges(24);
      setChanges(data);
      setError('');
    } catch (loadError) {
      console.warn(
        'Recent status changes load failed:',
        loadError instanceof Error ? loadError.message : loadError,
      );
      setError(t('טעינת שינויי הסטטוס נכשלה.'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [period, selectedDate]);

  useEffect(() => {
    loadChanges();
  }, [loadChanges]);

  useRealtimeRefresh({
    enabled: true,
    channelName: 'infrastructure-tracker-recent-status-changes',
    tables: ['status_history', 'projects'],
    onRefresh: loadChanges,
    pollIntervalMs: 30000,
  });

  const counts = useMemo(
    () =>
      changes.reduce((result, change) => {
        result[change.new_status] = (result[change.new_status] || 0) + 1;
        return result;
      }, {}),
    [changes],
  );
  const filteredChanges = useMemo(
    () =>
      selectedStatus === ALL_STATUSES
        ? changes
        : changes.filter((change) => change.new_status === selectedStatus),
    [changes, selectedStatus],
  );
  const locale = language === 'he' ? 'he-IL' : language === 'el' ? 'el-GR' : 'en-GB';
  const selectedDateLabel = new Date(`${selectedDate}T12:00:00`).toLocaleDateString(locale, {
    dateStyle: 'long',
  });

  return (
    <section className="card recentStatusReport">
      <header className="recentStatusHeader">
        <div className="recentStatusHeading">
          <span className="recentStatusHeroIcon">
            <ArrowLeftRight size={26} />
          </span>
          <div>
            <span className="recentStatusEyebrow">STATUS ACTIVITY</span>
            <h2>
              {period === DATE_PERIOD
                ? t('שינויי סטטוס לפי תאריך')
                : t('שינויים ב־24 השעות האחרונות')}
            </h2>
            <p>
              {period === DATE_PERIOD
                ? t('צפייה בפרויקטים שעברו לסטטוס חדש בתאריך שנבחר.')
                : t('תצוגה מרוכזת של פרויקטים שעברו לסטטוס חדש במהלך היממה האחרונה.')}
            </p>
          </div>
        </div>
        <button
          className="secondary recentStatusRefresh"
          onClick={() => loadChanges({ manual: true })}
          disabled={refreshing}
        >
          <RefreshCw size={17} className={refreshing ? 'spinning' : ''} />
          {t('רענון')}
        </button>
      </header>

      <div className="recentStatusPeriodBar">
        <span>{t('טווח זמן')}</span>
        <div className="recentStatusPeriodOptions">
          <button
            className={period === ROLLING_PERIOD ? 'active' : ''}
            onClick={() => setPeriod(ROLLING_PERIOD)}
            aria-pressed={period === ROLLING_PERIOD}
          >
            <Clock3 size={16} />
            {t('24 שעות אחרונות')}
          </button>
          <button
            className={period === DATE_PERIOD ? 'active' : ''}
            onClick={() => setPeriod(DATE_PERIOD)}
            aria-pressed={period === DATE_PERIOD}
          >
            {t('לפי תאריך')}
          </button>
        </div>
        {period === DATE_PERIOD && (
          <label className="recentStatusDatePicker">
            <span>{t('בחירת תאריך')}</span>
            <input
              type="date"
              value={selectedDate}
              max={toLocalDateValue()}
              aria-label={t('בחירת תאריך')}
              onChange={(event) => {
                if (event.target.value) setSelectedDate(event.target.value);
              }}
            />
          </label>
        )}
      </div>

      <div className="recentStatusFilters" aria-label={t('סינון לפי סטטוס')}>
        <button
          className={`recentStatusFilter all ${selectedStatus === ALL_STATUSES ? 'active' : ''}`}
          onClick={() => setSelectedStatus(ALL_STATUSES)}
          aria-pressed={selectedStatus === ALL_STATUSES}
        >
          <span>{t('כל השינויים')}</span>
          <strong>{changes.length}</strong>
        </button>
        {statuses.map((status) => (
          <button
            key={status}
            className={`recentStatusFilter status-${getStatusClass(status)} ${selectedStatus === status ? 'active' : ''}`}
            onClick={() => setSelectedStatus(status)}
            aria-pressed={selectedStatus === status}
          >
            <span>{t(status)}</span>
            <strong>{counts[status] || 0}</strong>
          </button>
        ))}
      </div>

      <div className="recentStatusListHeader">
        <div>
          <b>{selectedStatus === ALL_STATUSES ? t('כל השינויים') : t(selectedStatus)}</b>
          <span>
            {filteredChanges.length} {t('שינויים')}
          </span>
        </div>
        <span className="recentStatusWindow">
          <Clock3 size={15} />
          {period === DATE_PERIOD ? selectedDateLabel : t('24 שעות אחרונות')}
        </span>
      </div>

      {loading && (
        <div className="recentStatusEmpty">
          <span className="projectLoadSpinner" />
          <b>{t('טוען שינויי סטטוס...')}</b>
        </div>
      )}
      {!loading && error && (
        <div className="recentStatusEmpty error">
          <b>{error}</b>
          <button className="secondary" onClick={() => loadChanges({ manual: true })}>
            {t('רענון')}
          </button>
        </div>
      )}
      {!loading && !error && filteredChanges.length === 0 && (
        <div className="recentStatusEmpty">
          <Clock3 size={28} />
          <b>
            {selectedStatus === ALL_STATUSES
              ? period === DATE_PERIOD
                ? t('לא נרשמו שינויי סטטוס בתאריך שנבחר.')
                : t('לא נרשמו שינויי סטטוס ביממה האחרונה.')
              : t('לא נמצאו שינויים בסטטוס שנבחר.')}
          </b>
        </div>
      )}

      {!loading && !error && filteredChanges.length > 0 && (
        <div className="recentStatusList">
          {filteredChanges.map((change) => {
            const project = change.projects;
            return (
              <article className="recentStatusItem" key={change.id}>
                <div className="recentStatusProject">
                  <span className="recentStatusProjectIcon">
                    <FolderKanban size={19} />
                  </span>
                  <div>
                    <h3>{project?.name || t('פרויקט')}</h3>
                    {(project?.client_name || project?.location) && (
                      <p>{[project.client_name, project.location].filter(Boolean).join(' · ')}</p>
                    )}
                  </div>
                </div>

                <div className="recentStatusTransition">
                  {change.old_status ? (
                    <StatusPill status={change.old_status} />
                  ) : (
                    <span className="recentStatusUnknown">—</span>
                  )}
                  <ArrowLeftRight size={18} />
                  <StatusPill status={change.new_status} />
                </div>

                <div className="recentStatusMeta">
                  <b>{change.profiles?.full_name || t('משתמש')}</b>
                  <time dateTime={change.created_at}>
                    {new Date(change.created_at).toLocaleString(locale, {
                      dateStyle: 'short',
                      timeStyle: 'short',
                    })}
                  </time>
                  {change.note && <p>{change.note}</p>}
                </div>

                <button
                  className="secondary recentStatusOpen"
                  onClick={() => navigate(projectDeepLinkPath(project?.id || change.project_id))}
                >
                  <ExternalLink size={16} />
                  {t('פתח פרויקט')}
                </button>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
