import { supabase } from '../supabase.js';

export async function getPersonalNotes() {
  return supabase.from('personal_notes').select('*').order('updated_at', { ascending: false });
}
export function savePersonalNote(id, payload) {
  return id ? supabase.from('personal_notes').update(payload).eq('id', id).select().single() : supabase.from('personal_notes').insert(payload).select().single();
}
export function deletePersonalNote(id) {
  return supabase.from('personal_notes').delete().eq('id', id);
}
