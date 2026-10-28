import { createClient } from 'npm:@supabase/supabase-js@2.112.3';
import { createMicrosoftHandler } from './handler.js';

const client = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  {
    auth: { persistSession: false, autoRefreshToken: false },
  },
);
Deno.serve(createMicrosoftHandler({ client, env: (key: string) => Deno.env.get(key) }));
