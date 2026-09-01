import { supabase } from '../supabase.js';

export function getProfileById(id) {
  return supabase.from('profiles').select('*').eq('id', id).maybeSingle();
}

export function getProfileByEmail(email) {
  return supabase.from('profiles').select('*').eq('email', email).maybeSingle();
}

export function createProfile({ id, email, fullName, role }) {
  return supabase
    .from('profiles')
    .insert({ id, email, full_name: fullName, role })
    .select('*')
    .maybeSingle();
}

export function getAllProfiles() {
  return supabase.from('profiles').select('*').order('full_name');
}
