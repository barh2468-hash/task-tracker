import { supabase } from '../supabase.js';
export async function quoteAction(action, payload = {}) {
  const { data, error } = await supabase.functions.invoke('quotes-microsoft', {
    body: { action, ...payload },
  });
  if (error) {
    let code = 'service_unavailable';
    try {
      code = (await error.context?.json())?.error || code;
    } catch {
      /* hide provider internals */
    }
    throw Object.assign(new Error(code), { code });
  }
  return data;
}
