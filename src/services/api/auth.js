import { supabase } from '../supabase.js';
import { resolveLoginIdentifier } from '../../../supabase/functions/_shared/client-login.js';

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
  const identifier = resolveLoginIdentifier(email);
  if (!identifier) return Promise.resolve({ data: { user: null, session: null }, error: { message: 'Invalid login credentials' } });
  return supabase.auth.signInWithPassword({ email: identifier, password });
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
