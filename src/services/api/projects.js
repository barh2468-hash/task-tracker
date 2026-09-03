import { supabase } from '../supabase.js';

// Kept as one literal string (not built dynamically) so the exact shape of
// what the UI receives is easy to diff against the previous page.tsx query.
const PROJECT_SELECT =
  '*, profiles:assigned_to(full_name), project_workers(worker_id,profiles:worker_id(full_name,email,role)), project_photos(id,file_path,category,created_at), project_tasks(id,project_id,title,description,is_done,created_by,created_at,updated_at,profiles:created_by(full_name)), project_review_files(id,project_id,uploaded_by,file_path,file_name,created_at,profiles:uploaded_by(full_name)), work_sessions(id,worker_id,started_at,ended_at,started_lat,started_lng,started_accuracy,ended_lat,ended_lng,ended_accuracy,end_note,crew_members,profiles:worker_id(full_name))';

export function getProjectIdsForWorker(workerId) {
  return supabase.from('project_workers').select('project_id').eq('worker_id', workerId);
}

export function getProjectsForManager() {
  return supabase.from('projects').select(PROJECT_SELECT).order('updated_at', { ascending: false });
}

export function getProjectsByIds(ids) {
  return supabase
    .from('projects')
    .select(PROJECT_SELECT)
    .order('updated_at', { ascending: false })
    .in('id', ids);
}

export function getProjectsByIdsAndStatuses(ids, statuses) {
  return supabase
    .from('projects')
    .select(PROJECT_SELECT)
    .order('updated_at', { ascending: false })
    .in('id', ids)
    .in('status', statuses);
}

export function getProjectsByAssignmentOr(filters) {
  return supabase
    .from('projects')
    .select(PROJECT_SELECT)
    .order('updated_at', { ascending: false })
    .or(filters.join(','));
}

export function insertProject(payload) {
  return supabase.from('projects').insert(payload).select('id').single();
}

export function updateProject(projectId, payload) {
  return supabase.from('projects').update(payload).eq('id', projectId);
}

export function deleteProject(projectId) {
  return supabase.from('projects').delete().eq('id', projectId);
}
