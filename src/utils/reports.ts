import type { AttendanceSession, Profile, ProjectException, WorkSession } from "@/src/types";
import { attendanceTypeLabel } from "@/src/constants/attendance";
import { csvEscape, downloadCsv } from "./csv";
import { durationMinutes, formatHoursDecimal } from "./duration";
import { mapsLink } from "./location";
import { sessionStartedInRange } from "./dates";

export function buildWorkReportRows(workSessions: WorkSession[]) {
  const map = new Map<
    string,
    {
      workerName: string;
      email: string;
      projectName: string;
      clientName: string;
      location: string;
      totalMinutes: number;
      daysSet: Set<string>;
      openSessions: number;
      startMapLinks: string[];
      endMapLinks: string[];
      workDatesSet: Set<string>;
    }
  >();

  for (const item of workSessions) {
    const key = `${item.worker_id}_${item.project_id}`;
    const started = new Date(item.started_at);
    const ended = item.ended_at ? new Date(item.ended_at) : new Date();
    const minutes = Math.max(0, Math.round((ended.getTime() - started.getTime()) / 60000));
    const existing = map.get(key) || {
      workerName: item.profiles?.full_name || "עובד",
      email: item.profiles?.email || "",
      projectName: item.projects?.name || "פרויקט",
      clientName: item.projects?.client_name || "",
      location: item.projects?.location || "",
      totalMinutes: 0,
      daysSet: new Set<string>(),
      openSessions: 0,
      startMapLinks: [],
      endMapLinks: [],
      workDatesSet: new Set<string>(),
    };

    existing.totalMinutes += minutes;
    const workDate = started.toISOString().slice(0, 10);
    existing.daysSet.add(workDate);
    existing.workDatesSet.add(workDate);
    const startLink = mapsLink(item.started_lat, item.started_lng);
    const endLink = mapsLink(item.ended_lat, item.ended_lng);
    if (startLink && !existing.startMapLinks.includes(startLink)) existing.startMapLinks.push(startLink);
    if (endLink && !existing.endMapLinks.includes(endLink)) existing.endMapLinks.push(endLink);
    if (!item.ended_at) existing.openSessions += 1;
    map.set(key, existing);
  }

  return Array.from(map.values())
    .map((row) => ({
      ...row,
      days: row.daysSet.size,
      workDates: Array.from(row.workDatesSet).sort(),
    }))
    .sort((a, b) => a.workerName.localeCompare(b.workerName, "he"));
}

export function exportWorkReportCsv({
  workSessions,
  attendanceSessions,
  workers,
  workerId,
  fromDate,
  toDate,
}: {
  workSessions: WorkSession[];
  attendanceSessions: AttendanceSession[];
  workers: Profile[];
  workerId: string;
  fromDate: string;
  toDate: string;
}) {
  const filteredSessions = workSessions
    .filter((item) => workerId === "all" || item.worker_id === workerId)
    .filter((item) => sessionStartedInRange(item, fromDate, toDate));
  const filteredAttendance = attendanceSessions
    .filter((item) => workerId === "all" || item.worker_id === workerId)
    .filter((item) => {
      const date = item.attendance_date || item.started_at.slice(0, 10);
      return (!fromDate || date >= fromDate) && (!toDate || date <= toDate);
    });

  if (!filteredSessions.length && !filteredAttendance.length) {
    return {
      ok: false as const,
      message:
        workerId === "all"
          ? "אין נתוני שעות לייצוא בטווח התאריכים שנבחר."
          : "אין נתוני שעות לעובד שנבחר בטווח התאריכים.",
    };
  }

  const rows = buildWorkReportRows(filteredSessions);
  const headers = [
    "מתאריך",
    "עד תאריך",
    "סוג דיווח",
    "עובד",
    "מייל",
    "פרויקט",
    "לקוח",
    "מיקום",
    "תאריכי עבודה",
    "מספר ימים",
    "סה״כ דקות",
    "סה״כ שעות",
    "כניסות פתוחות",
    "מיקומי התחלה",
    "מיקומי סיום",
  ];
  const csvRows = [
    headers,
    ...filteredAttendance.map((item) => {
      const minutes = item.is_all_day ? 0 : durationMinutes(item.started_at, item.ended_at);
      const label = attendanceTypeLabel[item.attendance_type] || "נוכחות כללית";
      return [
        fromDate || "",
        toDate || "",
        label,
        item.profiles?.full_name || "עובד",
        item.profiles?.email || "",
        label,
        "",
        "",
        item.attendance_date || item.started_at.slice(0, 10),
        "1",
        String(minutes),
        formatHoursDecimal(minutes),
        item.is_all_day || item.ended_at ? "0" : "1",
        item.is_all_day ? "" : mapsLink(item.started_lat, item.started_lng),
        item.is_all_day ? "" : mapsLink(item.ended_lat, item.ended_lng),
      ];
    }),
    ...rows.map((row) => [
      fromDate || "",
      toDate || "",
      "פרויקט",
      row.workerName,
      row.email,
      row.projectName,
      row.clientName,
      row.location,
      row.workDates.join(" | "),
      String(row.days),
      String(row.totalMinutes),
      formatHoursDecimal(row.totalMinutes),
      String(row.openSessions),
      row.startMapLinks.join(" | "),
      row.endMapLinks.join(" | "),
    ]),
  ];
  const csv = "\uFEFF" + csvRows.map((row) => row.map(csvEscape).join(",")).join("\n");
  const selectedWorker = workers.find((worker) => worker.id === workerId);
  const workerPart = selectedWorker
    ? `-${selectedWorker.full_name.replace(/\s+/g, "-")}`
    : "-כל-העובדים";
  const rangePart = `${fromDate || "ללא-התחלה"}-עד-${toDate || "ללא-סיום"}`;
  downloadCsv(`דוח-שעות-עובדים${workerPart}-${rangePart}.csv`, csv);
  return { ok: true as const };
}

export function exportExceptionsCsv(exceptions: ProjectException[]) {
  if (!exceptions.length) return;
  const headers = ["סוג חריגה", "פרויקט", "לקוח", "מיקום", "עובד", "תיאור", "חומרה"];
  const rows = exceptions.map((item) => [
    item.title,
    item.project.name,
    item.project.client_name || "",
    item.project.location,
    item.project.profiles?.full_name || "לא משויך",
    item.description,
    item.severity,
  ]);
  const csv = "\uFEFF" + [headers, ...rows].map((row) => row.map(csvEscape).join(",")).join("\n");
  downloadCsv(`דוח-חריגות-${new Date().toISOString().slice(0, 10)}.csv`, csv);
}
