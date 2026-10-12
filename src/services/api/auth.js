import { supabase } from '../supabase.js';

export function getSession() {
  return supabase.auth.getSession();
}

export function onAuthStateChange(callback) {
  return supabase.auth.onAuthStateChange(callback);
}

export async function getCurrentUser() {
  const { data } = await supabase.auth.getUser();
  return data.user;
}

export function signInWithPassword(email, password) {
  return supabase.auth.signInWithPassword({ email, password });
}

export function requestPasswordReset(email, redirectTo) {
  return supabase.auth.resetPasswordForEmail(email, { redirectTo });
}

export function updatePassword(password) {
  return supabase.auth.updateUser({ password });
}

export function signUp(email, password, fullName) {
  return supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName } },
  });
}

export function signOut(options) {
  return supabase.auth.signOut(options);
}
