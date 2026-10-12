import { supabase } from '../supabase.js';

async function readPages(buildRequest) {
  const rows = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await buildRequest().range(offset, offset + 499);
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < 500) return rows;
  }
}

export async function getPersonalAttendanceRange(userId, from, to) {
  if (!userId || !from || !to || from > to) return { attendance: [], work: [] };
  // Read the selected dates directly and paginate so older months cannot be
  // silently truncated by the API's default row limit. Broad UTC work bounds
  // are filtered to exact Israel calendar dates by the report.
  const workFrom = new Date(new Date(`${from}T00:00:00Z`).getTime() - 86400000).toISOString();
  const workTo = new Date(new Date(`${to}T00:00:00Z`).getTime() + 2 * 86400000).toISOString();
  const [attendance, work] = await Promise.all([
    readPages(() => supabase.from('attendance_sessions').select('*').eq('worker_id', userId).gte('attendance_date', from).lte('attendance_date', to).order('started_at', { ascending: false }).order('id')),
    readPages(() => supabase.from('work_sessions').select('*,projects:project_id(name)').eq('worker_id', userId).gte('started_at', workFrom).lt('started_at', workTo).order('started_at', { ascending: false }).order('id')),
  ]);
  return { attendance, work };
}
