import { clientLoginEmail, normalizeClientUsername } from '../_shared/client-login.js';

export class ClientUserError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

export async function createClientUser(admin, payload) {
  const username = normalizeClientUsername(payload.username);
  if (!username) throw new ClientUserError('clientLogin.invalidUsername');
  const email = clientLoginEmail(username);
  const { data: existing, error: lookupError } = await admin
    .from('profiles')
    .select('id')
    .eq('email', email)
    .maybeSingle();
  if (lookupError) throw new ClientUserError('clientLogin.createError', 500);
  if (existing) throw new ClientUserError('clientLogin.exists', 409);
  const random = crypto.getRandomValues(new Uint8Array(16));
  const password =
    'Mc7!' + Array.from(random, (byte) => byte.toString(16).padStart(2, '0')).join('');
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: username },
  });
  if (error || !data?.user) throw new ClientUserError('clientLogin.createError', 400);
  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .insert({
      id: data.user.id,
      email,
      full_name: username,
      role: 'demo',
    })
    .select('id,email,full_name,role')
    .single();
  if (profileError) {
    const { error: cleanupError } = await admin.auth.admin.deleteUser(data.user.id);
    if (cleanupError) console.error('Client user profile cleanup failed');
    throw new ClientUserError('clientLogin.createError', 500);
  }
  // The password is returned once to the authenticated administrator. Never log it.
  return { ok: true, profile: { ...profile, account_status: 'active' }, username, password };
}
