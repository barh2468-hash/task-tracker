import { supabase } from '../supabase.js';

export function insertProjectPhoto(payload) {
  return supabase.from('project_photos').insert(payload);
}
