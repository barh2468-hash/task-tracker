import { mapsLink } from '../../../utils/format.js';

export function buildWorkReportRows(workSessions) {
  const map = new Map();

  for (const item of workSessions) {
    const key = `${item.worker_id}_${item.project_id}`;
    const started = new Date(item.started_at);
    const ended = item.ended_at ? new Date(item.ended_at) : new Date();
    const minutes = Math.max(
      0,
      Math.round((ended.getTime() - started.getTime()) / 60000),
    );
    const existing = map.get(key) || {
      workerName: item.profiles?.full_name || 'עובד',
      email: item.profiles?.email || '',
      projectName: item.projects?.name || 'פרויקט',
      clientName: item.projects?.client_name || '',
      location: item.projects?.location || '',
      totalMinutes: 0,
      daysSet: new Set(),
      openSessions: 0,
      startMapLinks: [],
      endMapLinks: [],
      workDatesSet: new Set(),
    };

    existing.totalMinutes += minutes;
    const workDate = started.toISOString().slice(0, 10);
    existing.daysSet.add(workDate);
    existing.workDatesSet.add(workDate);
    const startLink = mapsLink(item.started_lat, item.started_lng);
    const endLink = mapsLink(item.ended_lat, item.ended_lng);
    if (startLink && !existing.startMapLinks.includes(startLink))
      existing.startMapLinks.push(startLink);
    if (endLink && !existing.endMapLinks.includes(endLink))
      existing.endMapLinks.push(endLink);
    if (!item.ended_at) existing.openSessions += 1;
    map.set(key, existing);
  }

  return Array.from(map.values())
    .map((r) => ({
      ...r,
      days: r.daysSet.size,
      workDates: Array.from(r.workDatesSet).sort(),
    }))
    .sort((a, b) => a.workerName.localeCompare(b.workerName, 'he'));
}
