import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anon) {
  // The app will show a setup screen if env vars are missing.
}

export const supabase = createClient(url || 'https://missing.supabase.co', anon || 'missing-key');

export const statuses = [
  'בעבודה בשטח',
  'עבר לשרטוט',
  'נדרש GPR',
  'מחכה להיתרים',
  'הושלם'
] as const;

export const statusProgress: Record<string, number> = {
  'בעבודה בשטח': 25,
  'נדרש GPR': 35,
  'מחכה להיתרים': 10,
  'עבר לשרטוט': 75,
  'הושלם': 100
};

export const envReady = Boolean(url && anon);
