import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const envReady = Boolean(url && anon);

export const supabase = createClient(url || 'https://missing.supabase.co', anon || 'missing-key');

export const statuses = [
  'בעבודה בשטח',
  'עבר לשרטוט',
  'נדרש GPR',
  'מחכה להיתרים',
  'הושלם',
];

export const statusProgress = {
  'בעבודה בשטח': 25,
  'נדרש GPR': 35,
  'מחכה להיתרים': 10,
  'עבר לשרטוט': 75,
  'הושלם': 100,
};

export const REVIEW_STATUS = 'נשלח להגהה';

export const appStatuses = statuses.includes(REVIEW_STATUS)
  ? statuses
  : [...statuses, REVIEW_STATUS];

export const roleLabel = {
  manager: 'מנהל מערכת',
  field_worker: 'עובד שטח',
  drafter: 'שרטט',
};
