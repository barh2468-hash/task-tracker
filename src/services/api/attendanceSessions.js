import { supabase } from '../supabase.js';

function buildAttendanceRequest(select) {
  let request = supabase
    .from('attendance_sessions')
    .select(select)
    .order('started_at', { ascending: false });
  return request;
}

export async function getAttendanceSessions({ scopedToWorkerId } = {}) {
  const detailedSelect = `
    *,
    profiles:worker_id(full_name,email),
    sick_certificate:sick_leave_certificates(
      id,worker_id,valid_from,valid_to,file_path,original_name,mime_type,size_bytes,uploaded_at
    )
  `;
  let request = buildAttendanceRequest(detailedSelect);
  if (scopedToWorkerId) request = request.eq('worker_id', scopedToWorkerId);
  const result = await request;
  if (!result.error) return result;

  const relationUnavailable =
    ['PGRST200', 'PGRST205', '42P01', '42703'].includes(result.error.code) ||
    /sick_leave_certificates|sick_leave_certificate_id/i.test(result.error.message || '');
  if (!relationUnavailable) return result;

  let fallback = buildAttendanceRequest('*, profiles:worker_id(full_name,email)');
  if (scopedToWorkerId) fallback = fallback.eq('worker_id', scopedToWorkerId);
  return fallback;
}

export function insertAttendanceSession(payload) {
  return supabase.from('attendance_sessions').insert(payload);
}

export function updateAttendanceSession(sessionId, payload) {
  return supabase.from('attendance_sessions').update(payload).eq('id', sessionId);
}

export function updateOpenAttendanceSession(sessionId, payload) {
  return supabase.from('attendance_sessions').update(payload).eq('id', sessionId).is('ended_at', null);
}

export function deleteAttendanceSession(sessionId) {
  return supabase.from('attendance_sessions').delete().eq('id', sessionId);
}

export function closeStaleSessions() {
  return supabase.rpc('close_stale_work_sessions');
}
