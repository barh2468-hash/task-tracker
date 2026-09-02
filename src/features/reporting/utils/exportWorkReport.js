import { csvEscape, durationMinutes, formatHoursDecimal, mapsLink, sessionStartedInRange } from '../../../utils/format.js';
import { attendanceTypeLabel } from '../../attendance/api.js';
import { buildWorkReportRows } from './buildWorkReportRows.js';

export function exportWorkReport({
  workSessions,
  attendanceSessions,
  workers,
  workerId,
  fromDate,
  toDate,
  setMessage,
}) {
  const filteredSessions = workSessions
    .filter((item) => workerId === 'all' || item.worker_id === workerId)
    .filter((item) => sessionStartedInRange(item, fromDate, toDate));
  const filteredAttendance = attendanceSessions
    .filter((item) => workerId === 'all' || item.worker_id === workerId)
    .filter((item) => {
      const date = item.attendance_date || item.started_at.slice(0, 10);
      return (!fromDate || date >= fromDate) && (!toDate || date <= toDate);
    });

  if (!filteredSessions.length && !filteredAttendance.length) {
    setMessage(
      workerId === 'all'
        ? 'אין נתוני שעות לייצוא בטווח התאריכים שנבחר.'
        : 'אין נתוני שעות לעובד שנבחר בטווח התאריכים.',
    );
    return;
  }

  const rows = buildWorkReportRows(filteredSessions);
  const headers = [
    'מתאריך',
    'עד תאריך',
    'סוג דיווח',
    'עובד',
    'מייל',
    'פרויקט',
    'לקוח',
    'מיקום',
    'עובדים ועוזרים נוספים',
    'תאריכי עבודה',
    'מספר ימים',
    'סה״כ דקות',
    'סה״כ שעות',
    'כניסות פתוחות',
    'מיקומי התחלה',
    'מיקומי סיום',
  ];
  const csvRows = [
    headers,
    ...filteredAttendance.map((item) => {
      const minutes = item.is_all_day
        ? 0
        : durationMinutes(item.started_at, item.ended_at);
      const label = attendanceTypeLabel[item.attendance_type] || 'נוכחות כללית';
      return [
        fromDate || '',
        toDate || '',
        label,
        item.profiles?.full_name || 'עובד',
        item.profiles?.email || '',
        label,
        '',
        '',
        '',
        item.attendance_date || item.started_at.slice(0, 10),
        '1',
        String(minutes),
        formatHoursDecimal(minutes),
        item.is_all_day || item.ended_at ? '0' : '1',
        item.is_all_day ? '' : mapsLink(item.started_lat, item.started_lng),
        item.is_all_day ? '' : mapsLink(item.ended_lat, item.ended_lng),
      ];
    }),
    ...rows.map((r) => [
      fromDate || '',
      toDate || '',
      'פרויקט',
      r.workerName,
      r.email,
      r.projectName,
      r.clientName,
      r.location,
      r.crewNames.join(' | '),
      r.workDates.join(' | '),
      String(r.days),
      String(r.totalMinutes),
      formatHoursDecimal(r.totalMinutes),
      String(r.openSessions),
      r.startMapLinks.join(' | '),
      r.endMapLinks.join(' | '),
    ]),
  ];
  const csv =
    '﻿' + csvRows.map((row) => row.map(csvEscape).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const selectedWorker = workers.find((w) => w.id === workerId);
  const workerPart = selectedWorker
    ? `-${selectedWorker.full_name.replace(/\s+/g, '-')}`
    : '-כל-העובדים';
  const rangePart = `${fromDate || 'ללא-התחלה'}-עד-${toDate || 'ללא-סיום'}`;
  a.download = `דוח-שעות-עובדים${workerPart}-${rangePart}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
