import { supabase } from '../supabase.js';

export function getWorkSessions() {
  return supabase
    .from('work_sessions')
    .select('*, profiles:worker_id(full_name,email), projects:project_id(name,client_name,location)')
    .order('started_at', { ascending: false });
}

export function insertWorkSession(payload) {
  return supabase.from('work_sessions').insert(payload);
}

export function updateWorkSession(sessionId, payload) {
  return supabase.from('work_sessions').update(payload).eq('id', sessionId);
}
