import { supabase } from '../supabase.js';

export function insertStatusHistory(payload) {
  return supabase.from('status_history').insert(payload);
}

export function getHistory() {
  return supabase
    .from('status_history')
    .select('*, profiles:changed_by(full_name)')
    .order('created_at', { ascending: false })
    .limit(100);
}
