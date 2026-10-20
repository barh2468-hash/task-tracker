import { isPlanRow } from './localPlans.js';

const columns = 'plan_date,rows,roster_names,version,published_at';

export function validatePublication(record) {
  if (record === null) return null;
  if (!record || !Array.isArray(record.rows) || !record.rows.every(isPlanRow)
    || new Set(record.rows.map((row) => row.id)).size !== record.rows.length
    || !Array.isArray(record.roster_names) || !record.roster_names.every((name) => typeof name === 'string')
    || !Number.isInteger(record.version) || record.version < 1
    || !Number.isFinite(Date.parse(record.published_at))) throw new Error('invalid');
  return record;
}

export async function loadPublication(date, client) {
  const { data, error } = await client.from('work_plan_publications').select(columns).eq('plan_date', date).maybeSingle();
  if (error) throw error;
  return validatePublication(data);
}

// Conditional updates prevent a second manager from silently replacing a newer publication.
export async function publishPlan({ date, rows, rosterNames, userId, version }, client) {
  const values = { plan_date: date, rows, roster_names: rosterNames, published_by: userId };
  const query = version
    ? client.from('work_plan_publications').update(values).eq('plan_date', date).eq('version', version)
    : client.from('work_plan_publications').insert(values);
  const { data, error } = await query.select(columns).maybeSingle();
  if (error?.code === '23505' || (!error && !data)) throw new Error('conflict');
  if (error) throw error;
  return validatePublication(data);
}
