import { createClient } from 'jsr:@supabase/supabase-js@2';

type AdminAction =
  | 'list-users'
  | 'update-user'
  | 'invite-user'
  | 'send-password-reset'
  | 'set-user-status';

type Payload = {
  action?: AdminAction;
  userId?: string;
  email?: string;
  fullName?: string;
  role?: string;
  redirectTo?: string;
  active?: boolean;
};

type Profile = {
  id: string;
  email: string | null;
  full_name: string;
  role: string;
};

class HttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const allowedRoles = new Set(['admin', 'manager', 'field_worker', 'drafter', 'accounting']);

const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: corsHeaders });

const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

const normalizeEmail = (value?: string) =>
  value?.trim().toLocaleLowerCase('en-US') || '';

const isEmail = (value: string) =>
  value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

const getAccountStatus = (user: {
  banned_until?: string;
  confirmed_at?: string;
  email_confirmed_at?: string;
}) => {
  const bannedUntil = user.banned_until ? Date.parse(user.banned_until) : 0;
  if (Number.isFinite(bannedUntil) && bannedUntil > Date.now()) return 'inactive';
  if (!user.confirmed_at && !user.email_confirmed_at) return 'invited';
  return 'active';
};

const validateRedirectTo = (value: string, requestOrigin: string | null) => {
  let redirect: URL;
  try {
    redirect = new URL(value);
  } catch {
    throw new HttpError(400, 'A valid redirect URL is required');
  }

  const isLocalhost = redirect.hostname === 'localhost' || redirect.hostname === '127.0.0.1';
  if (redirect.protocol !== 'https:' && !(redirect.protocol === 'http:' && isLocalhost)) {
    throw new HttpError(400, 'The redirect URL must use HTTPS');
  }
  if (requestOrigin && redirect.origin !== requestOrigin) {
    throw new HttpError(400, 'The redirect URL must match the application origin');
  }
  if (redirect.pathname !== '/reset-password') {
    throw new HttpError(400, 'The redirect URL must point to the reset-password page');
  }
  return redirect.toString();
};

async function getTargetProfile(adminClient: ReturnType<typeof createClient>, userId: string) {
  const { data, error } = await adminClient
    .from('profiles')
    .select('id,email,full_name,role')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new HttpError(404, 'User profile not found');
  return data as Profile;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      throw new HttpError(500, 'Missing Supabase Edge Function configuration');
    }

    const authorization = req.headers.get('Authorization');
    if (!authorization) throw new HttpError(401, 'Authentication required');

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const publicAuthClient = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: authData, error: authError } = await userClient.auth.getUser();
    if (authError || !authData.user) throw new HttpError(401, 'Authentication required');

    const { data: requester, error: requesterError } = await adminClient
      .from('profiles')
      .select('role')
      .eq('id', authData.user.id)
      .maybeSingle();
    if (requesterError) throw requesterError;
    if (requester?.role !== 'admin') throw new HttpError(403, 'Administrator access required');

    let payload: Payload;
    try {
      payload = await req.json() as Payload;
    } catch {
      throw new HttpError(400, 'Invalid JSON body');
    }

    // Older clients omitted the action because this function originally updated email only.
    const action = payload.action || 'update-user';

    if (action === 'list-users') {
      const [{ data: profileRows, error: profilesError }, { data: authUsers, error: usersError }] =
        await Promise.all([
          adminClient.from('profiles').select('id,email,full_name,role').order('full_name'),
          adminClient.auth.admin.listUsers({ page: 1, perPage: 1000 }),
        ]);
      if (profilesError) throw profilesError;
      if (usersError) throw usersError;

      const authById = new Map(authUsers.users.map((user) => [user.id, user]));
      const profiles = (profileRows || []).map((profile) => {
        const authUser = authById.get(profile.id);
        return {
          ...profile,
          account_status: authUser ? getAccountStatus(authUser) : 'inactive',
        };
      });
      return json({ ok: true, profiles });
    }

    if (action === 'invite-user') {
      const email = normalizeEmail(payload.email);
      const fullName = payload.fullName?.trim() || '';
      const role = payload.role?.trim() || '';
      if (!isEmail(email)) throw new HttpError(400, 'A valid email address is required');
      if (!fullName || fullName.length > 120) throw new HttpError(400, 'A full name is required');
      if (!allowedRoles.has(role)) throw new HttpError(400, 'A valid role is required');
      const redirectTo = validateRedirectTo(payload.redirectTo || '', req.headers.get('Origin'));

      const { data: existingProfile, error: existingProfileError } = await adminClient
        .from('profiles')
        .select('id')
        .ilike('email', email)
        .maybeSingle();
      if (existingProfileError) throw existingProfileError;
      if (existingProfile) throw new HttpError(409, 'A user with this email already exists');

      const { data: invited, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(
        email,
        { data: { full_name: fullName }, redirectTo },
      );
      if (inviteError || !invited.user) {
        throw new HttpError(400, inviteError?.message || 'The invitation could not be sent');
      }

      const { data: profile, error: profileError } = await adminClient
        .from('profiles')
        .insert({ id: invited.user.id, email, full_name: fullName, role })
        .select('id,email,full_name,role')
        .single();

      if (profileError) {
        const { error: cleanupError } = await adminClient.auth.admin.deleteUser(invited.user.id);
        if (cleanupError) console.error('Invited Auth user cleanup failed', cleanupError.message);
        throw new HttpError(500, 'The user profile could not be created');
      }

      return json({ ok: true, profile: { ...profile, account_status: 'invited' } });
    }

    const userId = payload.userId?.trim() || '';
    if (!isUuid(userId)) throw new HttpError(400, 'A valid user ID is required');
    const targetProfile = await getTargetProfile(adminClient, userId);

    if (action === 'set-user-status') {
      if (typeof payload.active !== 'boolean') {
        throw new HttpError(400, 'An active status is required');
      }
      if (userId === authData.user.id) {
        throw new HttpError(409, 'You cannot disable your own administrator account');
      }

      const { data: statusData, error: statusError } =
        await adminClient.auth.admin.updateUserById(userId, {
          ban_duration: payload.active ? 'none' : '876000h',
        });
      if (statusError || !statusData.user) {
        throw new HttpError(400, statusError?.message || 'The account status could not be updated');
      }
      return json({
        ok: true,
        accountStatus: getAccountStatus(statusData.user),
      });
    }

    if (action === 'send-password-reset') {
      const email = normalizeEmail(targetProfile.email || '');
      if (!isEmail(email)) throw new HttpError(400, 'This user does not have a valid email address');
      const redirectTo = validateRedirectTo(payload.redirectTo || '', req.headers.get('Origin'));
      const { error: resetError } = await publicAuthClient.auth.resetPasswordForEmail(email, {
        redirectTo,
      });
      if (resetError) throw new HttpError(400, resetError.message);
      return json({ ok: true });
    }

    if (action !== 'update-user') throw new HttpError(400, 'Unsupported admin action');

    const email = normalizeEmail(payload.email);
    const role = payload.role?.trim() || targetProfile.role;
    if (!isEmail(email)) throw new HttpError(400, 'A valid email address is required');
    if (!allowedRoles.has(role)) throw new HttpError(400, 'A valid role is required');
    if (userId === authData.user.id && role !== targetProfile.role) {
      throw new HttpError(409, 'You cannot change your own administrator role');
    }

    const { data: authUserData, error: authUserError } = await adminClient.auth.admin.getUserById(userId);
    if (authUserError || !authUserData.user) throw new HttpError(404, 'Auth user not found');

    const oldAuthEmail = authUserData.user.email || '';
    const oldProfileEmail = targetProfile.email || '';
    const emailChanged = oldAuthEmail.toLocaleLowerCase('en-US') !== email ||
      oldProfileEmail.toLocaleLowerCase('en-US') !== email;
    const roleChanged = targetProfile.role !== role;
    if (!emailChanged && !roleChanged) return json({ ok: true, profile: targetProfile });

    if (emailChanged) {
      const { error: updateAuthError } = await adminClient.auth.admin.updateUserById(userId, {
        email,
        email_confirm: true,
      });
      if (updateAuthError) throw new HttpError(400, updateAuthError.message);
    }

    const { data: updatedProfile, error: updateProfileError } = await adminClient
      .from('profiles')
      .update({ email, role })
      .eq('id', userId)
      .select('id,email,full_name,role')
      .single();

    if (updateProfileError) {
      if (emailChanged && oldAuthEmail) {
        const { error: rollbackError } = await adminClient.auth.admin.updateUserById(userId, {
          email: oldAuthEmail,
          email_confirm: true,
        });
        if (rollbackError) console.error('Auth email rollback failed', rollbackError.message);
      }
      throw new HttpError(500, 'The user profile could not be synchronized');
    }

    return json({ ok: true, profile: updatedProfile });
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500;
    const message = error instanceof Error ? error.message : 'Unexpected error';
    if (status >= 500) console.error('Admin user operation failed', message);
    return json({ error: message }, status);
  }
});
