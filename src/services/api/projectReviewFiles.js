import { supabase } from '../supabase.js';

export function insertProjectReviewFile(payload) {
  return supabase.from('project_review_files').insert(payload).select('id').single();
}

export function insertProjectReviewFiles(payloads) {
  return supabase.from('project_review_files').insert(payloads).select('id');
}

export function deleteProjectReviewFile(fileId) {
  return supabase.from('project_review_files').delete().eq('id', fileId);
}

export function deleteProjectReviewFiles(fileIds) {
  return supabase.from('project_review_files').delete().in('id', fileIds);
}
