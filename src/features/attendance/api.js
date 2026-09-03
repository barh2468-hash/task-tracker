import * as authApi from '../../services/api/auth.js';
import * as workSessionsApi from '../../services/api/workSessions.js';
import * as attendanceSessionsApi from '../../services/api/attendanceSessions.js';
import * as statusHistoryApi from '../../services/api/statusHistory.js';
import { createManagerNotification } from '../notifications/api.js';
import { getCurrentLocationWithFallback } from '../../hooks/useGeolocation.js';
import { formatDuration, formatLocation, durationMinutes, toLocalDateKey } from '../../utils/format.js';
import { enqueueOfflineAction } from '../../services/offlineStore.js';

export const attendanceTypeOptions = [
  { value: 'field', label: 'עבודה בשטח', timed: true },
  { value: 'office', label: 'משרד', timed: true },
  { value: 'vacation', label: 'חופש', timed: false },
  { value: 'sick', label: 'מחלה', timed: false },
  { value: 'reserve_duty', label: 'מילואים', timed: false },
];

export const attendanceTypeLabel = Object.fromEntries(attendanceTypeOptions.map((item) => [item.value, item.label]));

export async function getWorkSessions(_isManager) {
  const { data, error } = await workSessionsApi.getWorkSessions();
  if (error) throw error;
  return data || [];
}

export async function getAttendanceSessions(isManager, userId) {
  const { data, error } = await attendanceSessionsApi.getAttendanceSessions({
    scopedToWorkerId: isManager ? undefined : userId,
  });
  if (error) throw error;
  return data || [];
}

export async function closeStaleSessions() {
  const { data, error } = await attendanceSessionsApi.closeStaleSessions();
  if (error) throw error;
  return data;
}

export async function startWork(project, profile) {
  const user = await authApi.getCurrentUser();
  if (!user) return { message: '' };

  const openSession = project.work_sessions?.find((w) => w.worker_id === user.id && !w.ended_at);
  if (openSession) return { message: 'כבר קיימת שעת התחלה פתוחה לפרויקט הזה. לחץ סיים עבודה כדי לסגור אותה.' };

  const location = await getCurrentLocationWithFallback();
  if (location === false) return { message: 'התחלת העבודה בוטלה כי לא התקבל אישור מיקום.' };

  const startedAt = new Date();
  const sessionPayload = {
    project_id: project.id,
    worker_id: user.id,
    started_at: startedAt.toISOString(),
    started_lat: location?.lat ?? null,
    started_lng: location?.lng ?? null,
    started_accuracy: location?.accuracy ?? null,
  };
  if (!navigator.onLine) {
    const localId = crypto.randomUUID();
    await enqueueOfflineAction('work_start', {
      session: { id: localId, ...sessionPayload },
      history: { project_id: project.id, old_status: null, new_status: 'התחלת עבודה', changed_by: user.id, note: `שעת התחלה: ${startedAt.toLocaleString('he-IL')} · נשמר במצב אופליין` },
    });
    return { message: 'אין חיבור. הכניסה נשמרה במכשיר ותסונכרן אוטומטית.', offlineSession: { id: localId, ...sessionPayload, pending_sync: true } };
  }
  const { error } = await workSessionsApi.insertWorkSession({
    ...sessionPayload,
  });
  if (error) {
    return {
      message: error.code === '23505' || error.message?.includes('open_work_session_exists')
        ? 'כבר קיימת שעת התחלה פתוחה לפרויקט הזה. לחץ סיים עבודה כדי לסגור אותה.'
        : error.message,
    };
  }

  const locationText = location ? ` · מיקום התחלה: ${formatLocation(location)}` : ' · מיקום התחלה לא נשמר';
  await statusHistoryApi.insertStatusHistory({
    project_id: project.id,
    old_status: null,
    new_status: 'התחלת עבודה',
    changed_by: user.id,
    note: `שעת התחלה: ${startedAt.toLocaleString('he-IL')}${locationText}`,
  });

  if (profile?.role === 'field_worker' || profile?.role === 'manager') {
    await createManagerNotification(
      'work_started',
      `התחלת עבודה: ${project.name}`,
      `${profile.full_name} התחיל עבודה בפרויקט ${project.name}.${location ? ` מיקום: ${formatLocation(location)}` : ''}`,
      project.id,
    );
  }

  return { message: `נרשמה שעת התחלה עבור ${project.name}${location ? ' כולל מיקום' : ''}` };
}

export async function endWork(project, profile, { endNote = '', crewMembers = [] } = {}) {
  const user = await authApi.getCurrentUser();
  if (!user) return { message: '', success: false };

  const openSession = project.work_sessions?.find((w) => w.worker_id === user.id && !w.ended_at);
  if (!openSession) return { message: 'לא נמצאה שעת התחלה פתוחה לפרויקט הזה.', success: false };

  const location = await getCurrentLocationWithFallback();
  if (location === false) return { message: 'סיום העבודה בוטל כי לא התקבל אישור מיקום.', success: false };

  const endedAt = new Date();
  const startedAt = new Date(openSession.started_at);
  const minutes = Math.max(0, Math.round((endedAt.getTime() - startedAt.getTime()) / 60000));
  const normalizedCrew = crewMembers
    .filter((member) => member?.name)
    .map((member) => ({
      id: member.id || null,
      name: String(member.name).trim().slice(0, 120),
      source: member.source === 'system' ? 'system' : 'helper',
    }));
  const crewText = normalizedCrew.map((member) => member.name).join(', ');

  const endChanges = {
    ended_at: endedAt.toISOString(),
    ended_lat: location?.lat ?? null,
    ended_lng: location?.lng ?? null,
    ended_accuracy: location?.accuracy ?? null,
    end_note: endNote.trim() || null,
    crew_members: normalizedCrew,
  };
  if (!navigator.onLine) {
    await enqueueOfflineAction('work_end', {
      sessionId: openSession.id,
      changes: endChanges,
      history: { project_id: project.id, old_status: null, new_status: 'סיום עבודה', changed_by: user.id, note: `שעת סיום: ${endedAt.toLocaleString('he-IL')} · זמן עבודה: ${formatDuration(minutes)} · נשמר במצב אופליין` },
    });
    return { message: 'אין חיבור. סיום העבודה נשמר וייסונכרן אוטומטית.', success: true, offlineChanges: endChanges, sessionId: openSession.id };
  }

  const { error } = await workSessionsApi.updateWorkSession(openSession.id, endChanges);
  if (error) return { message: error.message, success: false };

  const locationText = location ? ` · מיקום סיום: ${formatLocation(location)}` : ' · מיקום סיום לא נשמר';
  await statusHistoryApi.insertStatusHistory({
    project_id: project.id,
    old_status: null,
    new_status: 'סיום עבודה',
    changed_by: user.id,
    note: `שעת סיום: ${endedAt.toLocaleString('he-IL')} · זמן עבודה: ${formatDuration(minutes)}${locationText}${crewText ? ` · צוות: ${crewText}` : ''}${endNote.trim() ? ` · הערת סיום: ${endNote.trim()}` : ''}`,
  });

  if (profile?.role === 'field_worker' || profile?.role === 'manager') {
    await createManagerNotification(
      'work_ended',
      `סיום עבודה: ${project.name}`,
      `${profile.full_name} סיים עבודה בפרויקט ${project.name}. זמן עבודה: ${formatDuration(minutes)}.${location ? ` מיקום: ${formatLocation(location)}` : ''}${crewText ? ` צוות: ${crewText}.` : ''}${endNote.trim() ? ` הערת סיום: ${endNote.trim()}` : ''}`,
      project.id,
    );
  }

  return {
    message: `נרשמה שעת סיום עבור ${project.name}. זמן עבודה: ${formatDuration(minutes)}${crewText ? ` · צוות: ${crewText}` : ''}${location ? ' כולל מיקום' : ''}`,
    success: true,
  };
}

export async function startAttendance(attendanceType, { profile, attendanceSessions, attendanceAvailable }) {
  const user = await authApi.getCurrentUser();
  if (!user) return { message: '' };
  if (!attendanceAvailable) {
    return { message: 'שעון הנוכחות הכללי עדיין לא הופעל ב-Supabase. יש להריץ את קובץ ההתקנה המצורף.' };
  }

  const openSession = attendanceSessions.find((item) => item.worker_id === user.id && !item.ended_at);
  if (openSession) return { message: 'כבר קיימת משמרת כללית פתוחה.' };

  const option = attendanceTypeOptions.find((item) => item.value === attendanceType);
  const attendanceDate = toLocalDateKey();
  const existingDayStatus = attendanceSessions.find(
    (item) => item.worker_id === user.id && item.is_all_day && item.attendance_date === attendanceDate,
  );

  if (!option?.timed) {
    const reportedAt = new Date().toISOString();
    const payload = {
      worker_id: user.id,
      started_at: reportedAt,
      ended_at: reportedAt,
      attendance_type: attendanceType,
      attendance_date: attendanceDate,
      is_all_day: true,
    };
    if (!navigator.onLine) {
      if (existingDayStatus) return { message: 'כדי להחליף דיווח יומי קיים יש להתחבר לאינטרנט.' };
      const localSession = { id: crypto.randomUUID(), ...payload, pending_sync: true };
      await enqueueOfflineAction('attendance_start', { session: localSession });
      return { message: `אין חיבור. דיווח ${attendanceTypeLabel[attendanceType]} נשמר לסנכרון.`, offlineSession: localSession };
    }
    const result = existingDayStatus
      ? await attendanceSessionsApi.updateAttendanceSession(existingDayStatus.id, payload)
      : await attendanceSessionsApi.insertAttendanceSession(payload);

    if (result.error) return { message: result.error.message };

    if (profile?.role === 'field_worker' || profile?.role === 'manager') {
      await createManagerNotification(
        'attendance_day_status',
        `דיווח נוכחות: ${attendanceTypeLabel[attendanceType]}`,
        `${profile.full_name} דיווח ${attendanceTypeLabel[attendanceType]} לתאריך ${new Date().toLocaleDateString('he-IL')}.`,
      );
    }
    return { message: `נרשם דיווח ${attendanceTypeLabel[attendanceType]} להיום.` };
  }

  if (existingDayStatus) {
    const replaceStatus = window.confirm(
      `כבר קיים להיום דיווח "${attendanceTypeLabel[existingDayStatus.attendance_type]}". להחליף אותו בתחילת ${attendanceTypeLabel[attendanceType]}?`,
    );
    if (!replaceStatus) return null;
    const { error: deleteError } = await attendanceSessionsApi.deleteAttendanceSession(existingDayStatus.id);
    if (deleteError) return { message: deleteError.message };
  }

  const location = await getCurrentLocationWithFallback();
  if (location === false) return { message: 'תחילת יום העבודה בוטלה כי לא התקבל אישור מיקום.' };

  const startedAt = new Date();
  const attendancePayload = {
    worker_id: user.id,
    started_at: startedAt.toISOString(),
    attendance_type: attendanceType,
    attendance_date: attendanceDate,
    is_all_day: false,
    started_lat: location?.lat ?? null,
    started_lng: location?.lng ?? null,
    started_accuracy: location?.accuracy ?? null,
  };
  if (!navigator.onLine) {
    const localSession = { id: crypto.randomUUID(), ...attendancePayload, pending_sync: true };
    await enqueueOfflineAction('attendance_start', { session: localSession });
    return { message: 'אין חיבור. הכניסה נשמרה במכשיר ותסונכרן אוטומטית.', offlineSession: localSession };
  }
  const { error } = await attendanceSessionsApi.insertAttendanceSession(attendancePayload);

  if (error) {
    return { message: error.code === '23505' ? 'כבר קיימת משמרת כללית פתוחה.' : error.message };
  }

  if (profile?.role === 'field_worker' || profile?.role === 'manager') {
    await createManagerNotification(
      'attendance_started',
      `תחילת ${attendanceTypeLabel[attendanceType]}`,
      `${profile.full_name} התחיל ${attendanceTypeLabel[attendanceType]}.${location ? ` מיקום: ${formatLocation(location)}` : ''}`,
    );
  }

  return {
    message: `${attendanceTypeLabel[attendanceType]} התחיל ב-${startedAt.toLocaleTimeString('he-IL')}${location ? ' כולל מיקום' : ''}.`,
  };
}

export async function finishAttendance(endNote, { profile, attendanceSessions }) {
  const user = await authApi.getCurrentUser();
  if (!user) return { message: '', success: false };

  const openSession = attendanceSessions.find((item) => item.worker_id === user.id && !item.ended_at);
  if (!openSession) return { message: 'לא נמצאה משמרת כללית פתוחה.', success: false };

  const location = await getCurrentLocationWithFallback();
  if (location === false) return { message: 'סיום יום העבודה בוטל כי לא התקבל אישור מיקום.', success: false };

  const endedAt = new Date();
  const minutes = durationMinutes(openSession.started_at, endedAt.toISOString());
  const endChanges = {
    ended_at: endedAt.toISOString(),
    ended_lat: location?.lat ?? null,
    ended_lng: location?.lng ?? null,
    ended_accuracy: location?.accuracy ?? null,
    end_note: endNote.trim() || null,
  };
  if (!navigator.onLine) {
    await enqueueOfflineAction('attendance_end', { sessionId: openSession.id, changes: endChanges });
    return { message: 'אין חיבור. היציאה נשמרה במכשיר ותסונכרן אוטומטית.', success: true, offlineChanges: endChanges, sessionId: openSession.id };
  }
  const { error } = await attendanceSessionsApi.updateOpenAttendanceSession(openSession.id, endChanges);
  if (error) return { message: error.message, success: false };

  if (profile?.role === 'field_worker' || profile?.role === 'manager') {
    await createManagerNotification(
      'attendance_ended',
      `סיום ${attendanceTypeLabel[openSession.attendance_type]}`,
      `${profile.full_name} סיים ${attendanceTypeLabel[openSession.attendance_type]}. משך המשמרת: ${formatDuration(minutes)}.${location ? ` מיקום: ${formatLocation(location)}` : ''}${endNote.trim() ? ` הערה: ${endNote.trim()}` : ''}`,
    );
  }

  return {
    message: `${attendanceTypeLabel[openSession.attendance_type]} הסתיים. משך המשמרת: ${formatDuration(minutes)}.`,
    success: true,
  };
}
