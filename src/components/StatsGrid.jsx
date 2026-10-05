import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { t } from '../features/language/LanguageContext.jsx';
import {
  Clock,
  Shield,
  Pencil,
  FileText,
  CheckCircle,
  Users,
  Archive,
  AlertTriangle,
  PlusCircle,
} from 'lucide-react';
import { useAuth } from '../features/auth/useAuth.js';
import { useProjectStats } from '../features/projects/hooks/useProjectStats.js';
import { REVIEW_STATUS } from '../services/supabase.js';
import Stat from './Stat.jsx';

export default function StatsGrid({ children, loading = false, combineSections = false, combinedPanelProps = {} }) {
  useTranslation();
  const { isManager, isDrafter } = useAuth();
  const navigate = useNavigate();
  const { stats: projectStats } = useProjectStats();
  const stats = loading
    ? Object.fromEntries(Object.keys(projectStats).map((key) => [key, '—']))
    : projectStats;
  // Same default list as the "Projects" nav item, narrowed to one status.
  const projectsFilter = isManager ? 'all' : 'mine';
  const openStatus = (status) => () =>
    navigate(`/app/projects?${new URLSearchParams({ filter: projectsFilter, status })}`);
  const openPath = (path) => () => navigate(path);

  const statusSection = (
    <section className="statsGroup" aria-labelledby="project-status-stats-heading">
      <h2 id="project-status-stats-heading">{t('סטטוס פרויקטים')}</h2>
      <div className="grid">
        <Stat number={stats.field} label={t('בעבודה בשטח')} icon={<Clock />} onClick={openStatus('בעבודה בשטח')} />
        <Stat number={stats.gpr} label={t('נדרש GPR')} icon={<Shield />} onClick={openStatus('נדרש GPR')} />
        <Stat number={stats.drafting} label={t('עבר לשרטוט')} icon={<Pencil />} onClick={openStatus('עבר לשרטוט')} />
        <Stat number={stats.review} label={t('בהגהה')} icon={<FileText />} onClick={openStatus(REVIEW_STATUS)} />
        <Stat number={stats.done} label={t('הושלמו')} icon={<CheckCircle />} onClick={openStatus('הושלם')} />
      </div>
    </section>
  );
  const managementSection = (isManager || !isDrafter) && (
    <section className="statsGroup" aria-labelledby="overview-stats-heading">
      <h2 id="overview-stats-heading">{t('ניהול ומעקב')}</h2>
      <div className="grid" style={{ '--overview-columns': isManager ? 4 : 2 }}>
        {isManager && (
          <Stat
            number={stats.unassigned}
            label={t('ללא שיוך')}
            icon={<Users />}
            onClick={openPath('/app/projects?filter=unassigned')}
          />
        )}
        {isManager && (
          <Stat
            number={stats.archived}
            label={t('בארכיון')}
            icon={<Archive />}
            onClick={openPath('/app/projects?filter=archive')}
          />
        )}
        {!isDrafter && (
          <Stat
            number={stats.exceptions}
            label={t('חריגות לטיפול')}
            icon={<AlertTriangle />}
            onClick={openPath('/app/exceptions')}
          />
        )}
        {!isDrafter && (
          <Stat
            number={stats.openTasks}
            label={t('משימות פתוחות')}
            icon={<PlusCircle />}
            onClick={openPath('/app/tasks')}
          />
        )}
      </div>
    </section>
  );

  return (
    <div className="statsGroups">
      {combineSections ? (
        <div className="overviewMetrics" {...combinedPanelProps}>
          {statusSection}
          {managementSection}
        </div>
      ) : statusSection}
      {children}
      {!combineSections && managementSection}
    </div>
  );
}
