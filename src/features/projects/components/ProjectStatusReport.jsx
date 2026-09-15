import { useTranslation } from 'react-i18next';
import { t } from '../../language/LanguageContext.jsx';
import { useMemo, useState } from 'react';
import {
  FileText,
  Download,
  FolderKanban,
  Users,
  CheckCircle,
  AlertTriangle,
  Search,
  Archive,
} from 'lucide-react';
import { useProjects } from '../ProjectsContext.jsx';
import { useMessage } from '../../../context/MessageContext.jsx';
import { exportProjectStatusExcel } from '../../reporting/utils/exportProjectStatusReport.js';
import {
  compareProjectsByOrderNumber,
  getProjectOrderNumber,
} from '../utils/projectOrderNumber.js';
import StatusPill from '../../../components/StatusPill.jsx';

export default function ProjectStatusReport() {
  useTranslation();
  const { projects } = useProjects();
  const { setMessage } = useMessage();
  const [reportSearch, setReportSearch] = useState('');
  const [reportStatus, setReportStatus] = useState('');
  const [reportAssignment, setReportAssignment] = useState('all');
  const sortedProjects = useMemo(
    () => [...projects].sort(compareProjectsByOrderNumber),
    [projects],
  );
  const reportStatuses = useMemo(
    () => Array.from(new Set(projects.map((project) => project.status))).sort(),
    [projects],
  );
  const filteredProjects = useMemo(() => {
    const normalizedSearch = reportSearch.trim().toLowerCase();
    return sortedProjects.filter((project) => {
      const matchesSearch =
        !normalizedSearch ||
        `${getProjectOrderNumber(project)} ${project.name} ${project.status} ${project.profiles?.full_name || ''}`
          .toLowerCase()
          .includes(normalizedSearch);
      const matchesStatus = !reportStatus || project.status === reportStatus;
      const matchesAssignment =
        reportAssignment === 'all' ||
        (reportAssignment === 'assigned' && !!project.assigned_to) ||
        (reportAssignment === 'unassigned' && !project.assigned_to);
      return matchesSearch && matchesStatus && matchesAssignment;
    });
  }, [sortedProjects, reportSearch, reportStatus, reportAssignment]);
  const assignedProjects = projects.filter((project) => !!project.assigned_to).length;
  const completedProjects = projects.filter((project) => project.status === 'הושלם').length;

  function exportProjectsStatusExcel() {
    const filterParts = [
      reportStatus ? t(reportStatus) : t('כל הסטטוסים'),
      reportAssignment === 'assigned'
        ? t('עם עובד אחראי')
        : reportAssignment === 'unassigned'
          ? t('ללא עובד אחראי')
          : t('כל השיוכים'),
    ];
    if (reportSearch.trim()) filterParts.push(`${t('חיפוש')}: ${reportSearch.trim()}`);
    void exportProjectStatusExcel(filteredProjects, {
      setMessage,
      filterDescription: filterParts.join(' · '),
    });
  }

  return (
    <section className="card projectStatusReport">
      <div className="projectStatusVisualHero">
        <div className="projectStatusHeroCopy">
          <div className="projectStatusHeroIcon">
            <FileText size={28} />
          </div>
          <div>
            <span className="projectStatusEyebrow">PROJECT OVERVIEW</span>
            <h2>{t('תמונת מצב של כל הפרויקטים')}</h2>
            <p>{t('סטטוס עדכני, אחריות ברורה וייצוא מהיר לקובץ Excel.')}</p>
          </div>
        </div>
        <button
          className="excelExportBtn"
          onClick={exportProjectsStatusExcel}
          disabled={!filteredProjects.length}
        >
          <Download size={20} />
          <span>
            {t('הורדת דוח Excel')}

            <small>
              {filteredProjects.length}
              {t('פרויקטים בדוח')}
            </small>
          </span>
        </button>
      </div>

      <div className="projectStatusStats">
        <div className="projectStatusMetric metricBlue">
          <span className="metricIcon">
            <FolderKanban />
          </span>
          <div>
            <strong>{projects.length}</strong>
            <span>{t('כל הפרויקטים')}</span>
          </div>
        </div>
        <div className="projectStatusMetric metricTeal">
          <span className="metricIcon">
            <Users />
          </span>
          <div>
            <strong>{assignedProjects}</strong>
            <span>{t('עם עובד אחראי')}</span>
          </div>
        </div>
        <div className="projectStatusMetric metricGreen">
          <span className="metricIcon">
            <CheckCircle />
          </span>
          <div>
            <strong>{completedProjects}</strong>
            <span>{t('פרויקטים שהושלמו')}</span>
          </div>
        </div>
        <div className="projectStatusMetric metricOrange">
          <span className="metricIcon">
            <AlertTriangle />
          </span>
          <div>
            <strong>{projects.length - assignedProjects}</strong>
            <span>{t('ממתינים לשיוך')}</span>
          </div>
        </div>
      </div>

      <div className="projectStatusFilters">
        <label className="projectStatusSearch">
          <Search size={18} />
          <input
            value={reportSearch}
            onChange={(event) => setReportSearch(event.target.value)}
            placeholder={t('חיפוש לפי פרויקט, סטטוס או עובד...')}
          />
        </label>
        <select
          value={reportStatus}
          onChange={(event) => setReportStatus(event.target.value)}
          aria-label={t('סינון לפי סטטוס')}
        >
          <option value="">{t('כל הסטטוסים')}</option>
          {reportStatuses.map((status) => (
            <option key={status} value={status}>
              {t(status)}
            </option>
          ))}
        </select>
        <select
          value={reportAssignment}
          onChange={(event) => setReportAssignment(event.target.value)}
          aria-label={t('סינון לפי שיוך')}
        >
          <option value="all">{t('כל השיוכים')}</option>
          <option value="assigned">{t('עם עובד אחראי')}</option>
          <option value="unassigned">{t('ללא עובד אחראי')}</option>
        </select>
        <span className="projectStatusResultCount">
          {t('מציג')}
          {filteredProjects.length}
          {t('מתוך')}
          {projects.length}
        </span>
      </div>

      <div className="tableWrap projectStatusTableWrap">
        <table className="reportTable projectStatusTable">
          <thead>
            <tr>
              <th>{t('מספר הזמנה')}</th>
              <th>{t('שם הפרויקט')}</th>
              <th>{t('סטטוס נוכחי')}</th>
              <th>{t('עובד שטח אחראי')}</th>
            </tr>
          </thead>
          <tbody>
            {filteredProjects.map((project) => (
              <tr key={project.id}>
                <td>
                  <span className="projectOrderNumber">
                    {getProjectOrderNumber(project) || '-'}
                  </span>
                </td>
                <td>
                  <div className="projectReportName">
                    <span className="projectReportIcon">
                      <FolderKanban size={17} />
                    </span>
                    <div>
                      <b>{project.name}</b>
                      {project.is_archived && (
                        <small>
                          <Archive size={12} />
                          {t('בארכיון')}
                        </small>
                      )}
                    </div>
                  </div>
                </td>
                <td>
                  <StatusPill status={project.status} />
                </td>
                <td>
                  {project.profiles?.full_name ? (
                    <div className="projectReportWorker">
                      <span>{project.profiles.full_name[0]}</span>
                      <b>{project.profiles.full_name}</b>
                    </div>
                  ) : (
                    <span className="unassignedReportBadge">
                      <AlertTriangle size={14} />
                      {t('טרם שויך')}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filteredProjects.length === 0 && (
          <div className="projectStatusEmpty">
            <Search size={28} />
            <b>{t('לא נמצאו פרויקטים')}</b>
            <span>{t('נסו לשנות את החיפוש או את הסינון.')}</span>
          </div>
        )}
      </div>
    </section>
  );
}
