import { toLocalDateKey } from '../../../utils/format.js';

export function getTodayAttendance({
  workSessions,
  attendanceSessions,
  workers,
  today = toLocalDateKey(),
}) {
  const todaySessions = workSessions.filter(
    (session) => toLocalDateKey(new Date(session.started_at)) === today,
  );
  const todayAttendance = attendanceSessions.filter(
    (session) =>
      (session.attendance_date || toLocalDateKey(new Date(session.started_at))) === today,
  );
  const activeSessions = [...attendanceSessions, ...workSessions]
    .filter((session) => !session.ended_at && !session.is_all_day)
    .sort((a, b) => new Date(b.started_at) - new Date(a.started_at));

  // Show each worker once, using their most recent open check-in.
  const presentByWorker = new Map();
  for (const session of activeSessions) {
    if (!presentByWorker.has(session.worker_id)) presentByWorker.set(session.worker_id, session);
  }
  const todayWorkerIds = new Set([
    ...todayAttendance.map((session) => session.worker_id),
    ...todaySessions.map((session) => session.worker_id),
    ...presentByWorker.keys(),
  ]);

  return {
    todaySessions,
    todayAttendance,
    activeSessions,
    presentSessions: [...presentByWorker.values()],
    notStarted: workers.filter(
      (worker) => worker.role === 'field_worker' && !todayWorkerIds.has(worker.id),
    ),
  };
}
