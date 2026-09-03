import { supabase } from '../supabase.js';

export function insertProjectPhoto(payload) {
  return supabase.from('project_photos').insert(payload);
}

export function deleteProjectPhoto(photoId) {
  return supabase.from('project_photos').delete().eq('id', photoId);
}
