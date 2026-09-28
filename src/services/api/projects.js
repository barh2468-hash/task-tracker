import { supabase } from '../supabase.js';
import { getDrawingBatches } from './drawingBatches.js';

// Kept as one literal string (not built dynamically) so the exact shape of
// what the UI receives is easy to diff against the previous page.tsx query.
const PROJECT_SELECT =
  '*, profiles:assigned_to(full_name), project_workers(worker_id,profiles:worker_id(full_name,email,role)), project_tasks(id,project_id,title,description,is_done,created_by,created_at,updated_at,profiles:created_by(full_name))';

export async function getProjectAssets(projectId) {
  let [photos, reviewFiles, documents, drawingBatches] = await Promise.all([
    supabase.from('project_photos').select('id,file_path,category,created_at').eq('project_id', projectId).order('created_at', { ascending: false }),
    supabase.from('project_review_files').select('id,project_id,drawing_batch_id,uploaded_by,file_path,file_name,created_at,profiles:uploaded_by(full_name)').eq('project_id', projectId).order('created_at', { ascending: false }),
    supabase.from('project_documents').select('id,project_id,drawing_batch_id,uploaded_by,file_path,file_name,file_size,mime_type,document_type,created_at,profiles:uploaded_by(full_name)').eq('project_id', projectId).order('created_at', { ascending: false }),
    getDrawingBatches(projectId),
  ]);
  if (photos.error) throw photos.error;
  const schemaUnavailableCodes = new Set(['42P01', '42703', 'PGRST204', 'PGRST205']);
  const schemaUnavailable = (error) => error && schemaUnavailableCodes.has(error.code);

  // Keep the existing project view usable between frontend deployment and the
  // additive drawing-batches migration. Once the migration is applied, the
  // first queries above provide the linked records automatically.
  if (schemaUnavailable(reviewFiles.error)) {
    reviewFiles = await supabase
      .from('project_review_files')
      .select('id,project_id,uploaded_by,file_path,file_name,created_at,profiles:uploaded_by(full_name)')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });
  }
  if (schemaUnavailable(documents.error)) {
    documents = await supabase
      .from('project_documents')
      .select('id,project_id,uploaded_by,file_path,file_name,file_size,mime_type,document_type,created_at,profiles:uploaded_by(full_name)')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });
  }
  if (schemaUnavailable(drawingBatches.error)) {
    drawingBatches = { data: [], error: null };
  }

  if (reviewFiles.error) throw reviewFiles.error;
  if (documents.error) throw documents.error;
  if (drawingBatches.error) throw drawingBatches.error;
  return {
    project_photos: photos.data || [],
    project_review_files: reviewFiles.data || [],
    project_documents: documents.data || [],
    project_drawing_batches: drawingBatches.data || [],
  };
}

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
