import { createClient } from 'npm:@supabase/supabase-js@2.112.3';
import { createMicrosoftHandler } from './handler.js';

const client = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  {
    auth: { persistSession: false, autoRefreshToken: false },
  },
);
const gprHandler = createMicrosoftHandler({ client, env: (key: string) => Deno.env.get(key) });
Deno.serve((req: Request) => {
  const url = new URL(req.url);
  // Share the already registered redirect URI, with independent one-use states.
  if (
    req.method === 'GET' &&
    url.searchParams.get('callback') === '1' &&
    /^q_[A-Za-z0-9_-]{43}$/.test(url.searchParams.get('state') || '')
  ) {
    url.pathname = url.pathname.replace(/\/gpr-microsoft$/, '/quotes-microsoft');
    return fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(25000) });
  }
  return gprHandler(req);
});
