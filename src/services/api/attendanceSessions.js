import { supabase } from '../supabase.js';

export function getAttendanceSessions({ scopedToWorkerId } = {}) {
  let request = supabase
    .from('attendance_sessions')
    .select('*, profiles:worker_id(full_name,email)')
    .order('started_at', { ascending: false });
  if (scopedToWorkerId) request = request.eq('worker_id', scopedToWorkerId);
  return request;
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
