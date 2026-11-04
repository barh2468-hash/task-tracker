import { supabase } from '../supabase.js';
import { getDrawingBatches } from './drawingBatches.js';
import { readProjectPages } from './readProjectPages.js';
import { hydrateProjectTasks } from './projectGraph.js';

// Avoid recursively embedding tasks/reports into every project/team row.
// The independent reads below retain RLS and reconstruct the same UI shape.
const PROJECT_SELECT =
  '*, profiles:assigned_to(full_name), project_workers(worker_id,profiles:worker_id(full_name,email,role))';
const TASK_SELECT = 'id,project_id,title,description,is_done,latest_report_id,created_by,created_at,updated_at,profiles:created_by(full_name)';

async function readProjects(buildRequest) {
  return hydrateProjectTasks(await readProjectPages(buildRequest, { pageSize: 500 }),
    (projectIds) => readProjectPages(() => supabase.from('project_tasks').select(TASK_SELECT)
      .in('project_id', projectIds).order('created_at', { ascending: false }).order('id')),
    (_taskIds, reportIds) => reportIds.length
      ? readProjectPages(() => supabase.from('project_task_reports')
        .select('*,reporter:created_by(full_name)').in('id', reportIds)
        .order('created_at', { ascending: false }).order('id'))
      : Promise.resolve({ data: [] }));
}

export async function getProjectAssets(projectId) {
  let [photos, reviewFiles, documents, drawingBatches, taskReports, workSessions] = await Promise.all([
    supabase.from('project_photos').select('id,file_path,category,created_at').eq('project_id', projectId).order('created_at', { ascending: false }),
    supabase.from('project_review_files').select('id,project_id,drawing_batch_id,uploaded_by,file_path,file_name,created_at,profiles:uploaded_by(full_name)').eq('project_id', projectId).order('created_at', { ascending: false }),
    supabase.from('project_documents').select('id,project_id,drawing_batch_id,uploaded_by,file_path,file_name,file_size,mime_type,document_type,created_at,profiles:uploaded_by(full_name)').eq('project_id', projectId).order('created_at', { ascending: false }),
    getDrawingBatches(projectId),
    readProjectPages(() => supabase.from('project_task_reports')
      .select('*,reporter:created_by(full_name)').eq('project_id', projectId)
      .order('created_at', { ascending: false }).order('id')),
    readProjectPages(() => supabase.from('work_sessions')
      .select('id,project_id,worker_id,started_at,ended_at,end_note,crew_members,started_lat,started_lng,ended_lat,ended_lng,profiles:worker_id(full_name)')
      .eq('project_id', projectId).order('started_at', { ascending: false }).order('id')),
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
  if (taskReports.error) throw taskReports.error;
  if (workSessions.error) throw workSessions.error;
  return {
    project_photos: photos.data || [],
    project_review_files: reviewFiles.data || [],
    project_documents: documents.data || [],
    project_drawing_batches: drawingBatches.data || [],
    project_task_reports: taskReports.data || [],
    work_sessions: workSessions.data || [],
  };
}

export function getProjectIdsForWorker(workerId) {
  return readProjectPages(() => supabase.from('project_workers').select('project_id')
    .eq('worker_id', workerId).order('project_id'));
}

export function getProjectsForManager() {
  return readProjects(() => supabase.from('projects').select(PROJECT_SELECT)
    .order('updated_at', { ascending: false }).order('id'));
}

export function getProjectsByIds(ids) {
  return readProjects(() => supabase
    .from('projects')
    .select(PROJECT_SELECT)
    .order('updated_at', { ascending: false })
    .in('id', ids).order('id'));
}

export function getProjectsByIdsAndStatuses(ids, statuses) {
  return readProjects(() => supabase
    .from('projects')
    .select(PROJECT_SELECT)
    .order('updated_at', { ascending: false })
    .in('id', ids)
    .in('status', statuses).order('id'));
}

export function getProjectsByAssignmentOr(filters) {
  return readProjects(() => supabase
    .from('projects')
    .select(PROJECT_SELECT)
    .order('updated_at', { ascending: false })
    .or(filters.join(',')).order('id'));
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
