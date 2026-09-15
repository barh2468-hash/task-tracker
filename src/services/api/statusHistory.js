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

export function getStatusChangesBetween(startIso, endIso, targetStatuses) {
  let query = supabase
    .from('status_history')
    .select(
      '*, profiles:changed_by(full_name), projects:project_id(id,name,client_name,location,is_archived)',
    )
    .gte('created_at', startIso)
    .lte('created_at', endIso);

  if (targetStatuses?.length) query = query.in('new_status', targetStatuses);

  return query.order('created_at', { ascending: false }).limit(500);
}
