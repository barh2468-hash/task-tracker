import { supabase } from '../supabase.js';

export function getWorkDiariesForProject(projectId) {
  return supabase
    .from('work_diaries')
    .select('*, profiles:created_by(full_name)')
    .eq('project_id', projectId)
    .order('diary_number', { ascending: false });
}

export function insertWorkDiary(payload) {
  return supabase.from('work_diaries').insert(payload).select('*, profiles:created_by(full_name)').single();
}

export function deleteWorkDiary(diaryId, projectId) {
  return supabase.from('work_diaries').delete().eq('id', diaryId).eq('project_id', projectId);
}
