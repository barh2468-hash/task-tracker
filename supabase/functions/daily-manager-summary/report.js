export const REPORT_TIME_ZONE = 'Asia/Jerusalem';

const DAY_MS = 24 * 60 * 60 * 1000;
const severityOrder = { high: 0, medium: 1, low: 2 };

function partsInTimeZone(date, timeZone) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  const values = Object.fromEntries(
    formatter
      .formatToParts(date)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, Number(part.value)]),
  );
  return values;
}

function zonedDateTimeToUtc(parts, timeZone) {
  const targetTimestamp = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour || 0,
    parts.minute || 0,
    parts.second || 0,
  );
  let guess = targetTimestamp;

  // Two passes also cover dates around daylight-saving transitions.
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const actual = partsInTimeZone(new Date(guess), timeZone);
    const actualTimestamp = Date.UTC(
      actual.year,
      actual.month - 1,
      actual.day,
      actual.hour,
      actual.minute,
      actual.second,
    );
    guess += targetTimestamp - actualTimestamp;
  }
  return new Date(guess);
}

export function getDateKey(date = new Date(), timeZone = REPORT_TIME_ZONE) {
  const parts = partsInTimeZone(date, timeZone);
  return `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
}

export function getHourInTimeZone(date = new Date(), timeZone = REPORT_TIME_ZONE) {
  return partsInTimeZone(date, timeZone).hour;
}

export function getDayBounds(date = new Date(), timeZone = REPORT_TIME_ZONE) {
  const dateKey = getDateKey(date, timeZone);
  const [year, month, day] = dateKey.split('-').map(Number);
  const nextDate = new Date(Date.UTC(year, month - 1, day + 1));
  const start = zonedDateTimeToUtc({ year, month, day }, timeZone);
  const end = zonedDateTimeToUtc(
    {
      year: nextDate.getUTCFullYear(),
      month: nextDate.getUTCMonth() + 1,
      day: nextDate.getUTCDate(),
    },
    timeZone,
  );
  return { dateKey, start: start.toISOString(), end: end.toISOString() };
}

export function ageInDays(value, now = new Date()) {
  if (!value) return 0;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 0;
  return Math.max(0, Math.floor((now.getTime() - date.getTime()) / DAY_MS));
}

export function durationInMinutes(startedAt, endedAt, now = new Date()) {
  const start = new Date(startedAt);
  const end = endedAt ? new Date(endedAt) : now;
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000));
}

export function formatDuration(minutes) {
  return `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')}`;
}

export function formatDateTime(value, timeZone = REPORT_TIME_ZONE) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('he-IL', {
    timeZone,
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));
}

export function formatReportDate(value = new Date(), timeZone = REPORT_TIME_ZONE) {
  return new Intl.DateTimeFormat('he-IL', {
    timeZone,
    dateStyle: 'long',
  }).format(value);
}

export function buildDailyInsights({
  now = new Date(),
  workers = [],
  sessions = [],
  attendance = [],
  history = [],
  projects = [],
  equipmentImport = null,
  equipmentRecords = [],
} = {}) {
  const dateKey = getDateKey(now);
  const reportedWorkerIds = new Set(
    [
      ...sessions.map((session) => session.worker_id),
      ...attendance.map((entry) => entry.worker_id),
    ].filter(Boolean),
  );
  const notReportedWorkers = workers.filter((worker) => !reportedWorkerIds.has(worker.id));
  const activeProjects = projects.filter(
    (project) => !project.is_archived && project.status !== 'הושלם',
  );
  const openWorkSessions = sessions.filter((session) => !session.ended_at);
  const openAttendanceSessions = attendance.filter((entry) => !entry.is_all_day && !entry.ended_at);
  const staleProjects = activeProjects
    .map((project) => ({ ...project, ageDays: ageInDays(project.updated_at, now) }))
    .filter((project) => project.ageDays >= 4)
    .sort((left, right) => right.ageDays - left.ageDays);
  const permitWaitProjects = staleProjects.filter(
    (project) => project.status === 'מחכה להיתרים' && project.ageDays >= 7,
  );
  const unassignedProjects = activeProjects.filter((project) => !project.assigned_to);
  const overdueProjects = activeProjects
    .filter((project) => project.due_date && project.due_date < dateKey)
    .map((project) => ({
      ...project,
      overdueDays: Math.max(
        1,
        Math.round(
          (Date.parse(`${dateKey}T00:00:00Z`) - Date.parse(`${project.due_date}T00:00:00Z`)) /
            DAY_MS,
        ),
      ),
    }))
    .sort((left, right) => right.overdueDays - left.overdueDays);
  const oldTasks = activeProjects
    .flatMap((project) =>
      (project.project_tasks || [])
        .filter((task) => !task.is_done)
        .map((task) => ({ ...task, project, ageDays: ageInDays(task.created_at, now) })),
    )
    .filter((task) => task.ageDays >= 7)
    .sort((left, right) => right.ageDays - left.ageDays);

  const actions = [];
  overdueProjects.forEach((project) => {
    actions.push({
      severity: 'high',
      category: 'יעד',
      title: `פרויקט באיחור: ${project.name}`,
      detail: `${project.overdueDays} ימים אחרי תאריך היעד${project.profiles?.full_name ? ` · אחראי: ${project.profiles.full_name}` : ''}`,
      score: project.overdueDays,
    });
  });
  unassignedProjects.forEach((project) => {
    actions.push({
      severity: 'high',
      category: 'שיוך',
      title: `הפרויקט ${project.name} ללא עובד אחראי`,
      detail: project.location || project.client_name || 'נדרש שיוך עובד',
      score: 100,
    });
  });
  [...openWorkSessions, ...openAttendanceSessions].forEach((entry) => {
    const minutes = durationInMinutes(entry.started_at, null, now);
    const isProjectWork = Boolean(entry.project_id);
    actions.push({
      severity: minutes >= 10 * 60 ? 'high' : 'medium',
      category: 'נוכחות',
      title: `${isProjectWork ? 'עבודה בפרויקט' : 'משמרת'} עדיין פתוחה`,
      detail: `${entry.profiles?.full_name || 'עובד'} · ${formatDuration(minutes)} שעות${entry.projects?.name ? ` · ${entry.projects.name}` : ''}`,
      score: minutes,
    });
  });
  permitWaitProjects.forEach((project) => {
    actions.push({
      severity: project.ageDays >= 14 ? 'high' : 'medium',
      category: 'היתרים',
      title: `${project.name} ממתין להיתר`,
      detail: `${project.ageDays} ימים ללא עדכון`,
      score: project.ageDays,
    });
  });
  staleProjects
    .filter((project) => project.status !== 'מחכה להיתרים')
    .forEach((project) => {
      actions.push({
        severity: project.ageDays >= 7 ? 'high' : 'medium',
        category: 'פרויקט',
        title: `${project.name} ללא עדכון`,
        detail: `${project.ageDays} ימים · סטטוס: ${project.status}`,
        score: project.ageDays,
      });
    });
  oldTasks.forEach((task) => {
    actions.push({
      severity: task.ageDays >= 14 ? 'high' : 'low',
      category: 'משימה',
      title: task.title,
      detail: `${task.project.name} · פתוחה ${task.ageDays} ימים`,
      score: task.ageDays,
    });
  });
  notReportedWorkers.forEach((worker) => {
    actions.push({
      severity: 'low',
      category: 'דיווח',
      title: `${worker.full_name} לא דיווח היום`,
      detail: 'לא נמצאה נוכחות כללית או עבודה בפרויקט',
      score: 0,
    });
  });

  actions.sort(
    (left, right) =>
      severityOrder[left.severity] - severityOrder[right.severity] || right.score - left.score,
  );

  const equipmentItemCount = equipmentRecords.reduce(
    (total, record) => total + Number(record.checked_item_count || 0),
    0,
  );
  const highPriorityCount = actions.filter((action) => action.severity === 'high').length;

  return {
    metrics: {
      workersReported: reportedWorkerIds.size,
      workersNotReported: notReportedWorkers.length,
      projectWorkEntries: sessions.length,
      openSessions: openWorkSessions.length + openAttendanceSessions.length,
      statusUpdates: history.length,
      activeProjects: activeProjects.length,
      actionCount: actions.length,
      highPriorityCount,
    },
    actions,
    notReportedWorkers,
    overdueProjects,
    staleProjects,
    permitWaitProjects,
    unassignedProjects,
    oldTasks,
    equipment: {
      importTitle: equipmentImport?.title || '',
      importedAt: equipmentImport?.created_at || '',
      workerCount: equipmentRecords.length,
      itemCount: equipmentItemCount,
    },
  };
}
