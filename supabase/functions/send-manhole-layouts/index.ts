import { createClient } from 'npm:@supabase/supabase-js@2.112.3';
import { sendEmail } from '../_shared/smtp.ts';
import { createLayoutEmailHandler } from './handler.js';

Deno.serve(createLayoutEmailHandler({ createClient, sendEmail, env: (name: string) => Deno.env.get(name) }));
