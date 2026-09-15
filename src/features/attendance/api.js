import * as authApi from '../../services/api/auth.js';
import * as workSessionsApi from '../../services/api/workSessions.js';
import * as attendanceSessionsApi from '../../services/api/attendanceSessions.js';
import * as sickLeaveCertificatesApi from '../../services/api/sickLeaveCertificates.js';
import * as storageApi from '../../services/api/storage.js';
import * as statusHistoryApi from '../../services/api/statusHistory.js';
import { createManagerNotification } from '../notifications/api.js';
import { getCurrentLocationWithFallback } from '../../hooks/useGeolocation.js';
import { formatDuration, formatLocation, durationMinutes, toLocalDateKey } from '../../utils/format.js';
import { enqueueOfflineAction } from '../../services/offlineStore.js';
import { attendanceTypeLabel, attendanceTypeOptions } from './constants.js';

export { attendanceTypeLabel, attendanceTypeOptions } from './constants.js';

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

const SICK_CERTIFICATE_BUCKET = 'sick-leave-certificates';
const SICK_CERTIFICATE_MAX_BYTES = 10 * 1024 * 1024;
const SICK_CERTIFICATE_MIME_TYPES = new Set(['application/pdf', 'image/jpeg', 'image/png']);

function inclusiveDateKeys(fromDate, toDate) {
  const start = new Date(`${fromDate}T12:00:00Z`);
  const end = new Date(`${toDate}T12:00:00Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return [];
  const dates = [];
  for (const cursor = new Date(start); cursor <= end; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    dates.push(cursor.toISOString().slice(0, 10));
  }
  return dates;
}

function isSickLeaveFeatureUnavailable(error) {
  return (
    ['PGRST200', 'PGRST205', '42P01', '42703'].includes(error?.code) ||
    /sick_leave_certificates|sick_leave_certificate_id|sick-leave-certificates|bucket.*not found/i.test(
      error?.message || '',
    )
  );
}

async function saveSickLeaveReport({ user, profile, attendanceSessions, sickLeave }) {
  if (!navigator.onLine) {
    return {
      message: 'נדרש חיבור לאינטרנט לשמירת דיווח מחלה ואישור מצורף.',
      success: false,
    };
  }

  const fromDate = sickLeave?.fromDate;
  const toDate = sickLeave?.toDate;
  const dates = inclusiveDateKeys(fromDate, toDate);
  if (!dates.length) return { message: 'טווח התאריכים אינו תקין.', success: false };
  if (dates.length > 92) {
    return { message: 'ניתן לדווח על עד 92 ימי מחלה בכל פעולה.', success: false };
  }

  const file = sickLeave?.file || null;
  if (file && (!SICK_CERTIFICATE_MIME_TYPES.has(file.type) || file.size > SICK_CERTIFICATE_MAX_BYTES)) {
    return {
      message:
        file.size > SICK_CERTIFICATE_MAX_BYTES
          ? 'גודל הקובץ המקסימלי הוא 10MB.'
          : 'אפשר לצרף קובץ PDF, JPG או PNG בלבד.',
      success: false,
    };
  }

  const suppliedCertificate =
    sickLeave?.existingCertificate ||
    attendanceSessions.find(
      (item) =>
        item.worker_id === user.id &&
        item.attendance_type === 'sick' &&
        item.is_all_day &&
        dates.includes(item.attendance_date) &&
        item.sick_certificate?.id,
    )?.sick_certificate;
  const existingCertificate =
    suppliedCertificate?.id && suppliedCertificate.worker_id === user.id
      ? suppliedCertificate
      : null;
  const certificateId = existingCertificate?.id || crypto.randomUUID();
  let uploadedPath = null;

  if (file) {
    uploadedPath = `${user.id}/${certificateId}/${Date.now()}-${storageApi.safeFileName(file.name)}`;
    const { error: uploadError } = await storageApi.uploadFile(
      SICK_CERTIFICATE_BUCKET,
      uploadedPath,
      file,
      { cacheControl: '3600', upsert: false, contentType: file.type },
    );
    if (uploadError) {
      return {
        message: isSickLeaveFeatureUnavailable(uploadError)
          ? 'יש להפעיל את עדכון אישורי המחלה ב-Supabase.'
          : uploadError.message,
        success: false,
      };
    }
  }

  const certificatePayload = {
    worker_id: user.id,
    valid_from: fromDate,
    valid_to: toDate,
    file_path: uploadedPath || existingCertificate?.file_path || null,
    original_name: file?.name || existingCertificate?.original_name || null,
    mime_type: file?.type || existingCertificate?.mime_type || null,
    size_bytes: file?.size ?? existingCertificate?.size_bytes ?? null,
    uploaded_at: file ? new Date().toISOString() : existingCertificate?.uploaded_at || null,
  };
  const certificateResult = existingCertificate
    ? await sickLeaveCertificatesApi.updateSickLeaveCertificate(certificateId, certificatePayload)
    : await sickLeaveCertificatesApi.insertSickLeaveCertificate({
        id: certificateId,
        ...certificatePayload,
      });

  if (certificateResult.error) {
    if (uploadedPath) await storageApi.removeFiles(SICK_CERTIFICATE_BUCKET, [uploadedPath]);
    return {
      message: isSickLeaveFeatureUnavailable(certificateResult.error)
        ? 'יש להפעיל את עדכון אישורי המחלה ב-Supabase.'
        : certificateResult.error.message,
      success: false,
    };
  }

  for (const date of dates) {
    const reportedAt = new Date(`${date}T12:00:00`).toISOString();
    const payload = {
      worker_id: user.id,
      started_at: reportedAt,
      ended_at: reportedAt,
      attendance_type: 'sick',
      attendance_date: date,
      is_all_day: true,
      sick_leave_certificate_id: certificateId,
    };
    const existingDayStatus = attendanceSessions.find(
      (item) => item.worker_id === user.id && item.is_all_day && item.attendance_date === date,
    );
    const result = existingDayStatus
      ? await attendanceSessionsApi.updateAttendanceSession(existingDayStatus.id, payload)
      : await attendanceSessionsApi.insertAttendanceSession(payload);
    if (result.error) {
      return {
        message: isSickLeaveFeatureUnavailable(result.error)
          ? 'יש להפעיל את עדכון אישורי המחלה ב-Supabase.'
          : `האישור נשמר, אך דיווח המחלה לתאריך ${date} נכשל: ${result.error.message}`,
        success: false,
      };
    }
  }

  if (uploadedPath && existingCertificate?.file_path && existingCertificate.file_path !== uploadedPath) {
    await storageApi.removeFiles(SICK_CERTIFICATE_BUCKET, [existingCertificate.file_path]);
  }

  if (profile?.role === 'field_worker' || profile?.role === 'manager') {
    const rangeLabel = fromDate === toDate ? fromDate : `${fromDate}–${toDate}`;
    await createManagerNotification(
      'attendance_day_status',
      'דיווח נוכחות: מחלה',
      `${profile.full_name} דיווח מחלה לתאריכים ${rangeLabel}.${certificatePayload.file_path ? ' צורף אישור מחלה.' : ' לא צורף אישור מחלה.'}`,
    );
  }

  return {
    message: `דיווח המחלה נשמר עבור ${dates.length === 1 ? 'יום אחד' : `${dates.length} ימים`}${certificatePayload.file_path ? ' עם אישור מחלה.' : ' ללא אישור מצורף.'}`,
    success: true,
  };
}

export async function startAttendance(
  attendanceType,
  {
    profile,
    attendanceSessions,
    attendanceAvailable,
    project = null,
    workSessions = [],
    sickLeave = null,
  },
) {
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

  if (attendanceType === 'sick' && sickLeave) {
    return saveSickLeaveReport({ user, profile, attendanceSessions, sickLeave });
  }

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
      return { message: `אין חיבור. דיווח ${attendanceTypeLabel[attendanceType]} נשמר לסנכרון.`, offlineSession: localSession, success: true };
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
    return { message: `נרשם דיווח ${attendanceTypeLabel[attendanceType]} להיום.`, success: true };
  }

  if (
    project &&
    workSessions.some(
      (item) => item.project_id === project.id && item.worker_id === user.id && !item.ended_at,
    )
  ) {
    return {
      message: `כבר קיימת שעת עבודה פתוחה עבור ${project.name}. יש לסיים אותה לפני התחלה חדשה.`,
      success: false,
    };
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
  const projectSessionPayload = project
    ? {
        project_id: project.id,
        worker_id: user.id,
        started_at: startedAt.toISOString(),
        started_lat: location?.lat ?? null,
        started_lng: location?.lng ?? null,
        started_accuracy: location?.accuracy ?? null,
      }
    : null;
  if (!navigator.onLine) {
    const localSession = { id: crypto.randomUUID(), ...attendancePayload, pending_sync: true };
    await enqueueOfflineAction('attendance_start', { session: localSession });
    let offlineWorkSession = null;
    if (projectSessionPayload) {
      offlineWorkSession = {
        id: crypto.randomUUID(),
        ...projectSessionPayload,
        projects: { name: project.name },
        pending_sync: true,
      };
      await enqueueOfflineAction('work_start', {
        session: { id: offlineWorkSession.id, ...projectSessionPayload },
        history: {
          project_id: project.id,
          old_status: null,
          new_status: 'התחלת עבודה',
          changed_by: user.id,
          note: `שעת התחלה: ${startedAt.toLocaleString('he-IL')} · נשמר במצב אופליין`,
        },
      });
    }
    return {
      message: project
        ? `אין חיבור. יום העבודה והעבודה בפרויקט ${project.name} נשמרו לסנכרון.`
        : 'אין חיבור. הכניסה נשמרה במכשיר ותסונכרן אוטומטית.',
      offlineSession: localSession,
      offlineWorkSession,
      projectSessionStarted: Boolean(project),
      success: true,
    };
  }
  const { error } = await attendanceSessionsApi.insertAttendanceSession(attendancePayload);

  if (error) {
    return { message: error.code === '23505' ? 'כבר קיימת משמרת כללית פתוחה.' : error.message, success: false };
  }

  let projectSessionStarted = false;
  let projectStartError = null;
  if (projectSessionPayload) {
    const { error: workError } = await workSessionsApi.insertWorkSession(projectSessionPayload);
    if (workError) projectStartError = workError;
    else {
      projectSessionStarted = true;
      const locationText = location
        ? ` · מיקום התחלה: ${formatLocation(location)}`
        : ' · מיקום התחלה לא נשמר';
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
    }
  }

  if (profile?.role === 'field_worker' || profile?.role === 'manager') {
    await createManagerNotification(
      'attendance_started',
      `תחילת ${attendanceTypeLabel[attendanceType]}`,
      `${profile.full_name} התחיל ${attendanceTypeLabel[attendanceType]}.${location ? ` מיקום: ${formatLocation(location)}` : ''}`,
    );
  }

  return {
    message: projectStartError
      ? `${attendanceTypeLabel[attendanceType]} התחיל, אך פתיחת שעות הפרויקט נכשלה: ${projectStartError.message}`
      : project
        ? `${attendanceTypeLabel[attendanceType]} והעבודה בפרויקט ${project.name} התחילו ב-${startedAt.toLocaleTimeString('he-IL')}.`
        : `${attendanceTypeLabel[attendanceType]} התחיל ב-${startedAt.toLocaleTimeString('he-IL')}${location ? ' כולל מיקום' : ''}.`,
    projectSessionStarted,
    success: true,
  };
}

export async function finishAttendance(
  endNote,
  { profile, attendanceSessions, workSessions = [], crewMembers = [] },
) {
  const user = await authApi.getCurrentUser();
  if (!user) return { message: '', success: false };

  const openSession = attendanceSessions.find((item) => item.worker_id === user.id && !item.ended_at);
  if (!openSession) return { message: 'לא נמצאה משמרת כללית פתוחה.', success: false };

  const location = await getCurrentLocationWithFallback();
  if (location === false) return { message: 'סיום יום העבודה בוטל כי לא התקבל אישור מיקום.', success: false };

  const endedAt = new Date();
  const minutes = durationMinutes(openSession.started_at, endedAt.toISOString());
  const linkedWorkSession = workSessions.find(
    (item) =>
      item.worker_id === user.id &&
      !item.ended_at &&
      Math.abs(new Date(item.started_at).getTime() - new Date(openSession.started_at).getTime()) <
        5000,
  );
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
  };
  const workEndChanges = { ...endChanges, crew_members: normalizedCrew };
  if (!navigator.onLine) {
    await enqueueOfflineAction('attendance_end', { sessionId: openSession.id, changes: endChanges });
    if (linkedWorkSession) {
      await enqueueOfflineAction('work_end', {
        sessionId: linkedWorkSession.id,
        changes: workEndChanges,
        history: {
          project_id: linkedWorkSession.project_id,
          old_status: null,
          new_status: 'סיום עבודה',
          changed_by: user.id,
          note: `שעת סיום: ${endedAt.toLocaleString('he-IL')} · זמן עבודה: ${formatDuration(minutes)}${crewText ? ` · צוות: ${crewText}` : ''} · נשמר במצב אופליין`,
        },
      });
    }
    return {
      message: linkedWorkSession
        ? 'אין חיבור. סיום יום העבודה והפרויקט נשמר ויסונכרן אוטומטית.'
        : 'אין חיבור. היציאה נשמרה במכשיר ותסונכרן אוטומטית.',
      success: true,
      offlineChanges: endChanges,
      sessionId: openSession.id,
      linkedWorkSessionId: linkedWorkSession?.id || null,
      linkedWorkOfflineChanges: linkedWorkSession ? workEndChanges : null,
    };
  }
  const { error } = await attendanceSessionsApi.updateOpenAttendanceSession(openSession.id, endChanges);
  if (error) return { message: error.message, success: false };

  let projectEndError = null;
  if (linkedWorkSession) {
    const { error: workError } = await workSessionsApi.updateWorkSession(
      linkedWorkSession.id,
      workEndChanges,
    );
    if (workError) projectEndError = workError;
    else {
      const projectName = linkedWorkSession.projects?.name || 'הפרויקט שנבחר';
      const locationText = location
        ? ` · מיקום סיום: ${formatLocation(location)}`
        : ' · מיקום סיום לא נשמר';
      await statusHistoryApi.insertStatusHistory({
        project_id: linkedWorkSession.project_id,
        old_status: null,
        new_status: 'סיום עבודה',
        changed_by: user.id,
        note: `שעת סיום: ${endedAt.toLocaleString('he-IL')} · זמן עבודה: ${formatDuration(minutes)}${locationText}${crewText ? ` · צוות: ${crewText}` : ''}${endNote.trim() ? ` · הערת סיום: ${endNote.trim()}` : ''}`,
      });
      if (profile?.role === 'field_worker' || profile?.role === 'manager') {
        await createManagerNotification(
          'work_ended',
          `סיום עבודה: ${projectName}`,
          `${profile.full_name} סיים עבודה בפרויקט ${projectName}. זמן עבודה: ${formatDuration(minutes)}.${location ? ` מיקום: ${formatLocation(location)}` : ''}${crewText ? ` צוות: ${crewText}.` : ''}${endNote.trim() ? ` הערה: ${endNote.trim()}` : ''}`,
          linkedWorkSession.project_id,
        );
      }
    }
  }

  if (profile?.role === 'field_worker' || profile?.role === 'manager') {
    await createManagerNotification(
      'attendance_ended',
      `סיום ${attendanceTypeLabel[openSession.attendance_type]}`,
      `${profile.full_name} סיים ${attendanceTypeLabel[openSession.attendance_type]}. משך המשמרת: ${formatDuration(minutes)}.${location ? ` מיקום: ${formatLocation(location)}` : ''}${endNote.trim() ? ` הערה: ${endNote.trim()}` : ''}`,
    );
  }

  return {
    message: projectEndError
      ? `${attendanceTypeLabel[openSession.attendance_type]} הסתיים, אך סגירת שעות הפרויקט נכשלה: ${projectEndError.message}`
      : linkedWorkSession
        ? `${attendanceTypeLabel[openSession.attendance_type]} והעבודה בפרויקט הסתיימו. משך המשמרת: ${formatDuration(minutes)}.${crewText ? ` צוות: ${crewText}.` : ''}`
        : `${attendanceTypeLabel[openSession.attendance_type]} הסתיים. משך המשמרת: ${formatDuration(minutes)}.`,
    linkedWorkSessionId: linkedWorkSession?.id || null,
    success: true,
  };
}
