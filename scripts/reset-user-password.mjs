// One-off local admin script — sets a user's password directly via the
// Supabase Admin API, bypassing email delivery entirely.
//
// Usage (PowerShell):
//   $env:SUPABASE_SERVICE_ROLE_KEY = "<service_role key from Project Settings > API>"
//   $env:USER_EMAIL = "saramauda06@gmail.com"
//   $env:NEW_PASSWORD = "<choose a password>"
//   node scripts/reset-user-password.mjs
//
// Never commit this file with real values, and delete/clear the env vars
// when you're done. The service_role key has full admin access to the DB.

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://qopsdkmzvncamjrxjwni.supabase.co';
const { SUPABASE_SERVICE_ROLE_KEY, USER_EMAIL, NEW_PASSWORD } = process.env;

if (!SUPABASE_SERVICE_ROLE_KEY || !USER_EMAIL || !NEW_PASSWORD) {
  console.error('Set SUPABASE_SERVICE_ROLE_KEY, USER_EMAIL and NEW_PASSWORD env vars first.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const { data: list, error: listError } = await supabase.auth.admin.listUsers({ perPage: 1000 });
if (listError) {
  console.error('Failed to list users:', listError.message);
  process.exit(1);
}

const user = list.users.find((u) => u.email === USER_EMAIL);
if (!user) {
  console.error('No user found with email', USER_EMAIL);
  process.exit(1);
}

const { data, error } = await supabase.auth.admin.updateUserById(user.id, {
  password: NEW_PASSWORD,
});

if (error) {
  console.error('Failed to update password:', error.message);
  process.exit(1);
}

console.log('Password updated for', data.user.email);
