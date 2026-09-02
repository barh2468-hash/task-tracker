import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL || import.meta.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const envReady = Boolean(url && anon);

const REQUEST_TIMEOUT_MS = 7000;

async function fetchWithTimeout(input, init = {}) {
  const method = (init.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();
  const maxAttempts = method === 'GET' || method === 'HEAD' ? 2 : 1;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const controller = new AbortController();
    const onAbort = () => controller.abort(init.signal?.reason);
    if (init.signal) {
      if (init.signal.aborted) onAbort();
      else init.signal.addEventListener('abort', onAbort, { once: true });
    }
    const timeout = setTimeout(() => controller.abort(new Error('Request timed out')), REQUEST_TIMEOUT_MS);

    try {
      return await fetch(input, { ...init, signal: controller.signal });
    } catch (error) {
      const canRetry = attempt < maxAttempts && !init.signal?.aborted;
      if (!canRetry) throw error;
      await new Promise((resolve) => setTimeout(resolve, 300));
    } finally {
      clearTimeout(timeout);
      init.signal?.removeEventListener('abort', onAbort);
    }
  }

  throw new Error('Network request failed');
}

export const supabase = createClient(url || 'https://missing.supabase.co', anon || 'missing-key', {
  global: { fetch: fetchWithTimeout },
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

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
