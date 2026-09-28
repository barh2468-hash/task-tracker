import { supabase } from '../supabase.js';

const DRAWING_BATCH_SELECT = `
  *,
  created_by_profile:profiles!project_drawing_batches_created_by_fkey(full_name),
  assigned_drafter_profile:profiles!project_drawing_batches_assigned_drafter_fkey(full_name,email),
  project_drawing_batch_events(
    id,event_type,old_status,new_status,note,created_by,created_at,
    profiles:created_by(full_name)
  )
`;

export function getDrawingBatches(projectId) {
  return supabase
    .from('project_drawing_batches')
    .select(DRAWING_BATCH_SELECT)
    .eq('project_id', projectId)
    .order('batch_number', { ascending: false });
}

export function insertDrawingBatch(payload) {
  return supabase
    .from('project_drawing_batches')
    .insert(payload)
    .select(DRAWING_BATCH_SELECT)
    .single();
}

export function updateDrawingBatch(drawingBatchId, payload) {
  return supabase
    .from('project_drawing_batches')
    .update(payload)
    .eq('id', drawingBatchId)
    .select(DRAWING_BATCH_SELECT)
    .single();
}

export function assignDrafterToActiveBatches(projectId, drafterId) {
  return supabase
    .from('project_drawing_batches')
    .update({ assigned_drafter: drafterId })
    .eq('project_id', projectId)
    .in('status', ['pending_drafting', 'in_drafting', 'sent_to_review']);
}
