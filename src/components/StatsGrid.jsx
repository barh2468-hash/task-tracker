import { useTranslation } from 'react-i18next';
import { t } from '../features/language/LanguageContext.jsx';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import {
  FolderKanban,
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

export default function StatsGrid() {
  useTranslation();
  const { isManager, isDrafter } = useAuth();
  const { stats } = useProjectStats();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const onProjectsList = location.pathname === '/app/projects';
  const currentFilter = searchParams.get('filter') || '';
  const currentStatus = searchParams.get('status') || '';
  const isMineOrAll =
    onProjectsList && (currentFilter === 'mine' || currentFilter === 'all' || !currentFilter);

  function openProjectsByStatus(status = '') {
    const filter = isManager ? 'all' : 'mine';
    navigate(
      status
        ? `/app/projects?filter=${filter}&status=${encodeURIComponent(status)}`
        : `/app/projects?filter=${filter}`,
    );
  }

  return (
    <div className="grid">
      <Stat
        number={stats.total}
        label={t('סה״כ פרויקטים')}
        icon={<FolderKanban />}
        onClick={() => openProjectsByStatus()}
        active={isMineOrAll && !currentStatus}
      />

      <Stat
        number={stats.field}
        label={t('בעבודה בשטח')}
        icon={<Clock />}
        onClick={() => openProjectsByStatus('בעבודה בשטח')}
        active={isMineOrAll && currentStatus === 'בעבודה בשטח'}
      />

      <Stat
        number={stats.gpr}
        label={t('נדרש GPR')}
        icon={<Shield />}
        onClick={() => openProjectsByStatus('נדרש GPR')}
        active={isMineOrAll && currentStatus === 'נדרש GPR'}
      />

      <Stat
        number={stats.drafting}
        label={t('עבר לשרטוט')}
        icon={<Pencil />}
        onClick={() => openProjectsByStatus('עבר לשרטוט')}
        active={isMineOrAll && currentStatus === 'עבר לשרטוט'}
      />

      <Stat
        number={stats.review}
        label={t('בהגהה')}
        icon={<FileText />}
        onClick={() => openProjectsByStatus(REVIEW_STATUS)}
        active={isMineOrAll && currentStatus === REVIEW_STATUS}
      />

      <Stat
        number={stats.done}
        label={t('הושלמו')}
        icon={<CheckCircle />}
        onClick={() => openProjectsByStatus('הושלם')}
        active={isMineOrAll && currentStatus === 'הושלם'}
      />

      {isManager && (
        <Stat
          number={stats.unassigned}
          label={t('ללא שיוך')}
          icon={<Users />}
          onClick={() => navigate('/app/projects?filter=unassigned')}
          active={onProjectsList && currentFilter === 'unassigned'}
        />
      )}
      {isManager && (
        <Stat
          number={stats.archived}
          label={t('בארכיון')}
          icon={<Archive />}
          onClick={() => navigate('/app/projects?filter=archive')}
          active={onProjectsList && currentFilter === 'archive'}
        />
      )}
      {!isDrafter && (
        <Stat
          number={stats.exceptions}
          label={t('חריגות לטיפול')}
          icon={<AlertTriangle />}
          onClick={() => navigate('/app/exceptions')}
          active={location.pathname === '/app/exceptions'}
        />
      )}
      {!isDrafter && (
        <Stat
          number={stats.openTasks}
          label={t('משימות פתוחות')}
          icon={<PlusCircle />}
          onClick={() => navigate('/app/tasks')}
          active={location.pathname === '/app/tasks'}
        />
      )}
    </div>
  );
}
