import { supabase } from './supabase.js';
import { safeFileName } from './api/storage.js';
import { projectFileMimeType } from '../features/projects/utils/projectFiles.js';
import { validateTaskReport } from '../features/projects/task-reports/model.js';

// Stable report/document IDs survive network retries and IndexedDB sync.
export async function persistTaskReport(payload) {
  const validation = validateTaskReport(payload.report);
  if (validation) throw new Error(validation);
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || auth?.user?.id !== payload.userId)
    throw new Error('Task report belongs to a different signed-in user');
  const { report, projectId, userId } = payload;
  const documentIds = [...report.document_ids];
  for (const { id, file } of report.files || []) {
    const path = `${projectId}/${userId}/task-reports/${report.id}/${id}-${safeFileName(file.name)}`;
    const { error: uploadError } = await supabase.storage
      .from('project-documents')
      .upload(path, file, {
        upsert: false,
        contentType: projectFileMimeType(file),
      });
    if (
      uploadError &&
      String(uploadError.statusCode) !== '409' &&
      !['Duplicate', 'ResourceAlreadyExists'].includes(uploadError.error) &&
      !/resource already exists/i.test(uploadError.message || '')
    )
      throw uploadError;
    const { error } = await supabase.from('project_documents').upsert(
      {
        id,
        project_id: projectId,
        uploaded_by: userId,
        file_path: path,
        file_name: file.name,
        file_size: file.size,
        mime_type: projectFileMimeType(file),
        document_type: 'drawing_source',
      },
      { onConflict: 'id', ignoreDuplicates: true },
    );
    if (error) throw error;
    documentIds.push(id);
  }
  const { files: _files, ...data } = report;
  const { data: saved, error } = await supabase.rpc('submit_task_report', {
    p_report: { ...data, document_ids: documentIds },
    p_expected_report_id: payload.expectedReportId,
  });
  if (error) throw error;
  // The durable queue is the fallback. Kick delivery now without extending
  // the save operation or waiting for the next pg_cron worker to start.
  void supabase.functions
    .invoke('notify-task-done', { body: { reportId: saved.id } })
    .then(({ error: deliveryError }) => {
      if (deliveryError) console.warn('Task report delivery remains queued');
    })
    .catch(() => console.warn('Task report delivery remains queued'));
  return saved;
}
