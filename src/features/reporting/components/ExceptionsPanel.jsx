import { useTranslation } from 'react-i18next';
import { t } from '../../language/LanguageContext.jsx';
import { AlertTriangle, Download } from 'lucide-react';
import { useAuth } from '../../auth/useAuth.js';
import { useProjects } from '../../projects/ProjectsContext.jsx';
import { useMessage } from '../../../context/MessageContext.jsx';
import { buildProjectExceptions, exportExceptionsExcel } from '../utils/exceptions.js';

export default function ExceptionsPanel() {
  useTranslation();
  const { isManager } = useAuth();
  const { projects } = useProjects();
  const { setMessage } = useMessage();
  const activeProjects = projects.filter((p) => !p.is_archived);
  const exceptions = buildProjectExceptions(activeProjects);
  return (
    <section className="card exceptionsPanel">
      <div className="reportHeader">
        <div>
          <h2>{t('דוח חריגות יומי')}</h2>
          <p className="muted">
            {isManager
              ? t(
                  'כל החריגות בפרויקטים הפעילים: פרויקטים ללא שיוך, עבודה פתוחה, סטטוס תקוע ומשימות ישנות.',
                )
              : t('חריגות בפרויקטים שאליהם אתה משויך: עבודה פתוחה, סטטוס שלא עודכן ומשימות ישנות.')}
          </p>
        </div>
        <button
          className="ghost"
          disabled={!exceptions.length}
          onClick={() => exportExceptionsExcel(exceptions, setMessage)}
        >
          <Download size={16} />
          {t('ייצוא חריגות')}
        </button>
      </div>
      {exceptions.length === 0 && <div className="empty">{t('אין חריגות כרגע')}</div>}
      <div className="exceptionsList">
        {exceptions.map((item, index) => (
          <div
            className={`exceptionItem severity-${item.severity}`}
            key={`${item.project.id}-${item.type}-${index}`}
          >
            <div className="exceptionIcon">
              <AlertTriangle size={18} />
            </div>
            <div>
              <b>{t(item.title)}</b>
              <p>{t(item.descriptionKey || item.description, item.descriptionValues)}</p>
              <span className="muted">
                {item.project.name} · {item.project.location} ·{' '}
                {item.project.profiles?.full_name || t('לא משויך')}
              </span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
