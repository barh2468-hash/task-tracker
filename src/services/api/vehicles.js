import { supabase } from '../supabase.js';

export function getVehiclePage(from, pageSize) {
  return supabase.from('manager_vehicles').select('*').order('plate_key').range(from, from + pageSize - 1);
}

export function insertVehicle(payload) {
  return supabase.from('manager_vehicles').insert(payload).select('*').single();
}

export function updateVehicle(id, payload) {
  return supabase.from('manager_vehicles').update(payload).eq('id', id).select('*').single();
}

export function upsertVehicles(records) {
  return supabase.from('manager_vehicles').upsert(records, { onConflict: 'plate_key' });
}
