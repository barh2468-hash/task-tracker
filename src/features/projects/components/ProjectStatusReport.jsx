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
import { csvEscape } from '../../../utils/format.js';
import StatusPill from '../../../components/StatusPill.jsx';

export default function ProjectStatusReport() {
  const { projects } = useProjects();
  const [reportSearch, setReportSearch] = useState('');
  const [reportStatus, setReportStatus] = useState('');
  const [reportAssignment, setReportAssignment] = useState('all');
  const sortedProjects = useMemo(
    () =>
      [...projects].sort((a, b) =>
        a.name.localeCompare(b.name, 'he'),
      ),
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
        `${project.name} ${project.status} ${project.profiles?.full_name || ''}`
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
  const assignedProjects = projects.filter(
    (project) => !!project.assigned_to,
  ).length;
  const completedProjects = projects.filter(
    (project) => project.status === 'הושלם',
  ).length;

  function exportProjectsStatusExcel() {
    if (!filteredProjects.length) return;
    const headers = [
      'מס׳',
      'שם הפרויקט',
      'סטטוס נוכחי',
      'עובד שטח אחראי',
    ];
    const rows = filteredProjects.map((project, index) => [
      String(index + 1),
      project.name,
      project.status,
      project.profiles?.full_name || 'לא משויך',
    ]);
    const csv =
      "\uFEFF" +
      [headers, ...rows]
        .map((row) => row.map((value) => csvEscape(value)).join(','))
        .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `דוח-מצב-פרויקטים-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="card projectStatusReport">
      <div className="projectStatusVisualHero">
        <div className="projectStatusHeroCopy">
          <div className="projectStatusHeroIcon"><FileText size={28} /></div>
          <div>
            <span className="projectStatusEyebrow">PROJECT OVERVIEW</span>
            <h2>תמונת מצב של כל הפרויקטים</h2>
            <p>סטטוס עדכני, אחריות ברורה וייצוא מהיר לקובץ Excel.</p>
          </div>
        </div>
        <button
          className="excelExportBtn"
          onClick={exportProjectsStatusExcel}
          disabled={!filteredProjects.length}
        >
          <Download size={20} />
          <span>
            הורדת דוח Excel
            <small>{filteredProjects.length} פרויקטים בדוח</small>
          </span>
        </button>
      </div>

      <div className="projectStatusStats">
        <div className="projectStatusMetric metricBlue">
          <span className="metricIcon"><FolderKanban /></span>
          <div><strong>{projects.length}</strong><span>כל הפרויקטים</span></div>
        </div>
        <div className="projectStatusMetric metricTeal">
          <span className="metricIcon"><Users /></span>
          <div><strong>{assignedProjects}</strong><span>עם עובד אחראי</span></div>
        </div>
        <div className="projectStatusMetric metricGreen">
          <span className="metricIcon"><CheckCircle /></span>
          <div><strong>{completedProjects}</strong><span>פרויקטים שהושלמו</span></div>
        </div>
        <div className="projectStatusMetric metricOrange">
          <span className="metricIcon"><AlertTriangle /></span>
          <div><strong>{projects.length - assignedProjects}</strong><span>ממתינים לשיוך</span></div>
        </div>
      </div>

      <div className="projectStatusFilters">
        <label className="projectStatusSearch">
          <Search size={18} />
          <input
            value={reportSearch}
            onChange={(event) => setReportSearch(event.target.value)}
            placeholder="חיפוש לפי פרויקט, סטטוס או עובד..."
          />
        </label>
        <select
          value={reportStatus}
          onChange={(event) => setReportStatus(event.target.value)}
          aria-label="סינון לפי סטטוס"
        >
          <option value="">כל הסטטוסים</option>
          {reportStatuses.map((status) => (
            <option key={status} value={status}>{status}</option>
          ))}
        </select>
        <select
          value={reportAssignment}
          onChange={(event) => setReportAssignment(event.target.value)}
          aria-label="סינון לפי שיוך"
        >
          <option value="all">כל השיוכים</option>
          <option value="assigned">עם עובד אחראי</option>
          <option value="unassigned">ללא עובד אחראי</option>
        </select>
        <span className="projectStatusResultCount">
          מציג {filteredProjects.length} מתוך {projects.length}
        </span>
      </div>

      <div className="tableWrap projectStatusTableWrap">
        <table className="reportTable projectStatusTable">
          <thead>
            <tr>
              <th>מס׳</th>
              <th>שם הפרויקט</th>
              <th>סטטוס נוכחי</th>
              <th>עובד שטח אחראי</th>
            </tr>
          </thead>
          <tbody>
            {filteredProjects.map((project, index) => (
              <tr key={project.id}>
                <td><span className="projectRowNumber">{index + 1}</span></td>
                <td>
                  <div className="projectReportName">
                    <span className="projectReportIcon"><FolderKanban size={17} /></span>
                    <div>
                      <b>{project.name}</b>
                      {project.is_archived && (
                        <small><Archive size={12} /> בארכיון</small>
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
                      <AlertTriangle size={14} /> טרם שויך
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
            <b>לא נמצאו פרויקטים</b>
            <span>נסו לשנות את החיפוש או את הסינון.</span>
          </div>
        )}
      </div>
    </section>
  );
}
