import { createClient } from '@supabase/supabase-js';
import { fetchWithTimeout } from './fetchWithTimeout.js';

const url = import.meta.env.VITE_SUPABASE_URL || import.meta.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const envReady = Boolean(url && anon);

export const supabase = createClient(url || 'https://missing.supabase.co', anon || 'missing-key', {
  global: { fetch: fetchWithTimeout },
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export const REVIEW_STATUS = 'נשלח להגהה';
export const REVIEW_COMPLETED_STATUS = 'עבר לבקרה';
export const DEFAULT_PROJECT_STATUS = 'ממתין לתיאום';

export const FIELD_WORKER_STATUSES = ['בעבודה בשטח', 'עבר לשרטוט'];

export const statuses = [
  DEFAULT_PROJECT_STATUS,
  'בעבודה בשטח',
  'נדרש GPR',
  'מחכה להיתרים',
  'עבר לשרטוט',
  REVIEW_STATUS,
  REVIEW_COMPLETED_STATUS,
  'הושלם',
];

export const statusProgress = {
  [DEFAULT_PROJECT_STATUS]: 0,
  'בעבודה בשטח': 25,
  'נדרש GPR': 35,
  'מחכה להיתרים': 10,
  'עבר לשרטוט': 75,
  [REVIEW_STATUS]: 85,
  [REVIEW_COMPLETED_STATUS]: 95,
  'הושלם': 100,
};

export const appStatuses = statuses;

export const roleLabel = {
  admin: 'מנהל ראשי',
  manager: 'מנהל מערכת',
  field_worker: 'עובד שטח',
  drafter: 'שרטט',
  accounting_main: 'הנהלת חשבונות ראשית',
  accounting: 'הנהלת חשבונות',
};
