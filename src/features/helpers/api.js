import { supabase } from '../../services/supabase.js';
import { readProjectPages } from '../../services/api/readProjectPages.js';

const fields = 'id,name,is_active,created_at,updated_at';

export async function listHelpers({ activeOnly = false } = {}) {
  const { data, error } = await readProjectPages(() => {
    let query = supabase.from('crew_helpers').select(fields).order('created_at').order('id');
    if (activeOnly) query = query.eq('is_active', true);
    return query;
  });
  if (error) throw error;
  return data || [];
}

export async function saveHelper(id, changes) {
  const payload = {};
  if ('name' in changes) payload.name = changes.name.trim();
  if ('is_active' in changes) payload.is_active = changes.is_active;
  const query = id ? supabase.from('crew_helpers').update(payload).eq('id', id)
    : supabase.from('crew_helpers').insert({ name: payload.name });
  const { data, error } = await query.select(fields).single();
  if (error) throw error;
  window.dispatchEvent(new Event('maya-helpers-changed'));
  return data;
}
