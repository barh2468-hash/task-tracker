import { supabase } from '../supabase.js';

export function insertProjectDocument(payload) {
  return supabase.from('project_documents').insert(payload).select('id').single();
}

export function deleteProjectDocument(documentId) {
  return supabase.from('project_documents').delete().eq('id', documentId);
}

