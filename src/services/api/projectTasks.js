import { supabase } from '../supabase.js';

export function insertProjectTask(payload) {
  return supabase.from('project_tasks').insert(payload);
}

export function updateProjectTask(taskId, payload) {
  return supabase.from('project_tasks').update(payload).eq('id', taskId);
}

export function deleteProjectTask(taskId) {
  return supabase.from('project_tasks').delete().eq('id', taskId);
}
