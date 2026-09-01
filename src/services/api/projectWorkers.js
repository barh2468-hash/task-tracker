import { supabase } from '../supabase.js';

export function insertProjectWorkers(rows) {
  return supabase.from('project_workers').insert(rows);
}

export function deleteProjectWorkersByProject(projectId) {
  return supabase.from('project_workers').delete().eq('project_id', projectId);
}

export function deleteProjectWorkersByProjectAndWorkers(projectId, workerIds) {
  return supabase.from('project_workers').delete().eq('project_id', projectId).in('worker_id', workerIds);
}
