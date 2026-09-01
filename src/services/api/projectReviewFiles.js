import { supabase } from '../supabase.js';

export function insertProjectReviewFile(payload) {
  return supabase.from('project_review_files').insert(payload);
}

export function deleteProjectReviewFile(fileId) {
  return supabase.from('project_review_files').delete().eq('id', fileId);
}
