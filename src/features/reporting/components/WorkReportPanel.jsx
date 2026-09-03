import { useMemo, useState } from 'react';
import { Clock, Download, History, Users } from 'lucide-react';
import { useAttendance } from '../../attendance/AttendanceContext.jsx';
import { useProjects } from '../../projects/ProjectsContext.jsx';
import { useMessage } from '../../../context/MessageContext.jsx';
import { attendanceTypeLabel } from '../../attendance/api.js';
import {
  durationMinutes,
  formatDuration,
  formatHoursDecimal,
  getMonthRange,
  mapsLink,
  sessionStartedInRange,
  toDateInputValue,
} from '../../../utils/format.js';
import MapLinks from '../../../components/MapLinks.jsx';
import Stat from '../../../components/Stat.jsx';
import { buildWorkReportRows } from '../utils/buildWorkReportRows.js';
import { exportWorkReport } from '../utils/exportWorkReport.js';

export default function WorkReportPanel() {
  const { workSessions, attendanceSessions, attendanceAvailable } = useAttendance();
  const { workers } = useProjects();
  const { setMessage } = useMessage();

  const defaultReportRange = getMonthRange();
  const [reportWorkerId, setReportWorkerId] = useState('all');
  const [reportMonth, setReportMonth] = useState(defaultReportRange.month);
  const [reportFromDate, setReportFromDate] = useState(defaultReportRange.from);
  const [reportToDate, setReportToDate] = useState(defaultReportRange.to);

  const reportWorkers = useMemo(() => {
    const seen = new Set();
    return workers
      .filter((worker) => {
        if (seen.has(worker.id)) return false;
        seen.add(worker.id);
        return true;
      })
      .sort((a, b) => a.full_name.localeCompare(b.full_name, 'he'));
  }, [workers]);
  const filteredSessions = useMemo(
    () =>
      workSessions
        .filter(
          (item) =>
            reportWorkerId === 'all' || item.worker_id === reportWorkerId,
        )
        .filter((item) =>
          sessionStartedInRange(item, reportFromDate, reportToDate),
        ),
    [workSessions, reportWorkerId, reportFromDate, reportToDate],
  );
  const filteredAttendance = useMemo(
    () =>
      attendanceSessions
        .filter(
          (item) =>
            reportWorkerId === 'all' || item.worker_id === reportWorkerId,
        )
        .filter((item) => {
          const date = item.attendance_date || item.started_at.slice(0, 10);
          return (!reportFromDate || date >= reportFromDate) &&
            (!reportToDate || date <= reportToDate);
        }),
    [attendanceSessions, reportWorkerId, reportFromDate, reportToDate],
  );
  const rows = useMemo(
    () => buildWorkReportRows(filteredSessions),
    [filteredSessions],
  );
  const totalMinutes = rows.reduce((sum, row) => sum + row.totalMinutes, 0);
  const totalDays = rows.reduce((sum, row) => sum + row.days, 0);
  const totalAttendanceMinutes = filteredAttendance.reduce(
    (sum, item) =>
      sum + (item.is_all_day ? 0 : durationMinutes(item.started_at, item.ended_at)),
    0,
  );
  const timedAttendanceCount = filteredAttendance.filter((item) => !item.is_all_day).length;
  function applyMonth(value) {
    setReportMonth(value);
    if (!value) return;
    const [year, month] = value.split('-').map(Number);
    if (!year || !month) return;
    setReportFromDate(toDateInputValue(new Date(year, month - 1, 1)));
    setReportToDate(toDateInputValue(new Date(year, month, 0)));
  }

  return (
    <section className="card">
      <div className="reportHeader">
        <div>
          <h2>דוח שעות עובדים</h2>
          <p className="muted">
            נוכחות כללית לצד שעות לפי פרויקט. אפשר לבחור חודש מלא או טווח
            מותאם ולייצא את שני סוגי הדיווח לאקסל.
          </p>
        </div>
        <div className="reportActions reportActionsWide">
          <label>
            עובד
            <select
              value={reportWorkerId}
              onChange={(e) => setReportWorkerId(e.target.value)}
            >
              <option value="all">כל העובדים</option>
              {reportWorkers.map((worker) => (
                <option key={worker.id} value={worker.id}>
                  {worker.full_name} - {worker.email}
                </option>
              ))}
            </select>
          </label>
          <label>
            חודש
            <input
              type="month"
              value={reportMonth}
              onChange={(e) => applyMonth(e.target.value)}
            />
          </label>
          <label>
            מתאריך
            <input
              type="date"
              value={reportFromDate}
              onChange={(e) => setReportFromDate(e.target.value)}
            />
          </label>
          <label>
            עד תאריך
            <input
              type="date"
              value={reportToDate}
              onChange={(e) => setReportToDate(e.target.value)}
            />
          </label>
          <button
            onClick={() =>
              exportWorkReport({
                workSessions,
                attendanceSessions,
                workers,
                workerId: reportWorkerId,
                fromDate: reportFromDate,
                toDate: reportToDate,
                setMessage,
              })
            }
          >
            <Download size={16} /> ייצוא לאקסל
          </button>
        </div>
      </div>
      <div className="reportStats">
        <Stat number={timedAttendanceCount} label="משמרות כלליות" icon={<Users />} />
        <Stat
          number={Math.round((totalAttendanceMinutes / 60) * 10) / 10}
          label="שעות נוכחות כלליות"
          icon={<Clock />}
        />
        <Stat
          number={Math.round((totalMinutes / 60) * 10) / 10}
          label="שעות משויכות לפרויקטים"
          icon={<Clock />}
        />
        <Stat number={totalDays} label="ימי עבודה בדוח" icon={<History />} />
      </div>
      {!attendanceAvailable && (
        <p className="attendanceSetupNotice">
          נתוני הנוכחות הכללית אינם זמינים עד להפעלת migration הנוכחות ב-Supabase.
        </p>
      )}
      <div className="attendanceReportBlock">
        <div className="attendanceReportHeading">
          <div>
            <h3>נוכחות כללית</h3>
            <p className="muted">כולל נסיעות, מעברים וזמן שאינו משויך לפרויקט מסוים.</p>
          </div>
          <strong>{formatDuration(totalAttendanceMinutes)}</strong>
        </div>
        <div className="tableWrap">
          <table className="reportTable attendanceReportTable">
            <thead>
              <tr>
                <th>עובד</th>
                <th>תאריך</th>
                <th>סוג דיווח</th>
                <th>כניסה</th>
                <th>יציאה</th>
                <th>משך</th>
                <th>מיקומים</th>
                <th>הערה</th>
              </tr>
            </thead>
            <tbody>
              {filteredAttendance.length === 0 && (
                <tr><td colSpan={8}>אין נתוני נוכחות כללית בטווח שנבחר</td></tr>
              )}
              {filteredAttendance.map((item) => (
                <tr key={item.id}>
                  <td>
                    <b>{item.profiles?.full_name || 'עובד'}</b>
                    <br />
                    <span className="muted">{item.profiles?.email || ''}</span>
                  </td>
                  <td>{new Date(`${item.attendance_date || item.started_at.slice(0, 10)}T12:00:00`).toLocaleDateString('he-IL')}</td>
                  <td>{attendanceTypeLabel[item.attendance_type]}</td>
                  <td>{item.is_all_day ? '-' : new Date(item.started_at).toLocaleTimeString('he-IL')}</td>
                  <td>{item.is_all_day ? '-' : item.ended_at ? new Date(item.ended_at).toLocaleTimeString('he-IL') : 'פתוח'}</td>
                  <td>{item.is_all_day ? 'ללא שעות' : formatDuration(durationMinutes(item.started_at, item.ended_at))}</td>
                  <td>
                    {item.is_all_day ? '-' : (
                      <MapLinks
                        startLinks={[mapsLink(item.started_lat, item.started_lng)].filter(Boolean)}
                        endLinks={[mapsLink(item.ended_lat, item.ended_lng)].filter(Boolean)}
                      />
                    )}
                  </td>
                  <td>{item.end_note || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="attendanceReportHeading projectHoursHeading">
        <div>
          <h3>שעות לפי פרויקט</h3>
          <p className="muted">משמשות לחישובים ולשיוך פיננסי לכל עבודה.</p>
        </div>
        <strong>{formatDuration(totalMinutes)}</strong>
      </div>
      <div className="tableWrap">
        <table className="reportTable">
          <thead>
            <tr>
              <th>עובד</th>
              <th>פרויקט</th>
              <th>לקוח</th>
              <th>מיקום</th>
              <th>צוות נוסף</th>
              <th>תאריכי עבודה</th>
              <th>ימים</th>
              <th>זמן עבודה</th>
              <th>פתוח</th>
              <th>מיקומי שטח</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={10}>אין נתוני שעות בטווח שנבחר</td>
              </tr>
            )}
            {rows.map((row) => (
              <tr key={`${row.email}_${row.projectName}`}>
                <td>
                  <b>{row.workerName}</b>
                  <br />
                  <span className="muted">{row.email}</span>
                </td>
                <td>{row.projectName}</td>
                <td>{row.clientName || '-'}</td>
                <td>{row.location || '-'}</td>
                <td>{row.crewNames.join(', ') || '-'}</td>
                <td>{row.workDates.join(', ') || '-'}</td>
                <td>{row.days}</td>
                <td>
                  {formatDuration(row.totalMinutes)}
                  <br />
                  <span className="muted">
                    {formatHoursDecimal(row.totalMinutes)} שעות
                  </span>
                </td>
                <td>{row.openSessions ? `${row.openSessions} פתוח` : '-'}</td>
                <td>
                  <MapLinks
                    startLinks={row.startMapLinks}
                    endLinks={row.endMapLinks}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
