import { useTranslation } from 'react-i18next';
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
import Stat from './Stat.jsx';

export default function StatsGrid({ children, loading = false, combineSections = false, combinedPanelProps = {} }) {
  useTranslation();
  const { isManager, isDrafter } = useAuth();
  const { stats: projectStats } = useProjectStats();
  const stats = loading
    ? Object.fromEntries(Object.keys(projectStats).map((key) => [key, '—']))
    : projectStats;

  const statusSection = (
    <section className="statsGroup" aria-labelledby="project-status-stats-heading">
      <h2 id="project-status-stats-heading">{t('סטטוס פרויקטים')}</h2>
      <div className="grid">
        <Stat number={stats.field} label={t('בעבודה בשטח')} icon={<Clock />} />
        <Stat number={stats.gpr} label={t('נדרש GPR')} icon={<Shield />} />
        <Stat number={stats.drafting} label={t('עבר לשרטוט')} icon={<Pencil />} />
        <Stat number={stats.review} label={t('בהגהה')} icon={<FileText />} />
        <Stat number={stats.done} label={t('הושלמו')} icon={<CheckCircle />} />
      </div>
    </section>
  );
  const managementSection = (isManager || !isDrafter) && (
    <section className="statsGroup" aria-labelledby="overview-stats-heading">
      <h2 id="overview-stats-heading">{t('ניהול ומעקב')}</h2>
      <div className="grid" style={{ '--overview-columns': isManager ? 4 : 2 }}>
        {isManager && <Stat number={stats.unassigned} label={t('ללא שיוך')} icon={<Users />} />}
        {isManager && <Stat number={stats.archived} label={t('בארכיון')} icon={<Archive />} />}
        {!isDrafter && (
          <Stat number={stats.exceptions} label={t('חריגות לטיפול')} icon={<AlertTriangle />} />
        )}
        {!isDrafter && (
          <Stat number={stats.openTasks} label={t('משימות פתוחות')} icon={<PlusCircle />} />
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
