import * as authApi from '../../services/api/auth.js';
import * as profilesApi from '../../services/api/profiles.js';

export function signIn(email, password) {
  return authApi.signInWithPassword(email, password);
}

export function signUp(email, password, fullName) {
  return authApi.signUp(email, password, fullName);
}

export function signOut() {
  return authApi.signOut();
}

export function getSession() {
  return authApi.getSession();
}

export function onAuthStateChange(callback) {
  return authApi.onAuthStateChange(callback);
}

// Mirrors the previous loadProfileAndData profile-resolution steps: fetch by
// id, fall back to fetch by email, then auto-provision a field_worker
// profile if neither exists yet.
export async function getOrCreateProfile(user) {
  let { data: prof, error } = await profilesApi.getProfileById(user.id);

  if (!prof && user.email && !error) {
    const byEmail = await profilesApi.getProfileByEmail(user.email);
    prof = byEmail.data;
    error = byEmail.error;
  }

  if (!prof && !error) {
    const fullNameFromAuth = user.user_metadata?.full_name || user.email?.split('@')[0] || 'עובד שטח';
    const created = await profilesApi.createProfile({
      id: user.id,
      email: user.email,
      fullName: fullNameFromAuth,
      role: 'field_worker',
    });
    prof = created.data;
    error = created.error;
  }

  return { profile: prof, error };
}
