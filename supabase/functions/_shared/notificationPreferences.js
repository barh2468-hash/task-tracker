// Shared by delivery functions and the settings screen. Unknown events have an
// explicit switch rather than silently bypassing a user's notification choice.
export const notificationPreferenceCategories = [
  'status_changes',
  'assignments',
  'work_started',
  'work_ended',
  'attendance_updates',
  'attendance_reminders',
  'new_tasks',
  'completed_tasks',
  'drawings',
  'documents',
  'continuation_reports',
  'gpr',
  'vehicles',
  'chat',
  'other',
];

export function notificationPreferenceCategory(type = '') {
  if (type === 'chat_message') return 'chat';
  if (type.startsWith('gpr_')) return 'gpr';
  if (type.startsWith('vehicle_')) return 'vehicles';
  if (type === 'work_started') return 'work_started';
  if (type === 'work_ended') return 'work_ended';
  if (type.startsWith('attendance_reminder_') || type === 'attendance_missing_escalation')
    return 'attendance_reminders';
  if (type.startsWith('attendance_')) return 'attendance_updates';
  if (['status_change', 'manager_project_status_changed'].includes(type)) return 'status_changes';
  if (['project_assigned', 'drafter_assigned', 'project_drafter_assigned'].includes(type))
    return 'assignments';
  if (type === 'task_done') return 'completed_tasks';
  if (type.startsWith('task_')) return 'new_tasks';
  if (type.startsWith('continuation_')) return 'continuation_reports';
  if (['photo_deleted', 'project_document_uploaded', 'drawing_document_uploaded'].includes(type))
    return 'documents';
  if (
    type.startsWith('drawing_') ||
    type.startsWith('project_review_') ||
    type === 'daily_drafting_ready'
  )
    return 'drawings';
  return 'other';
}

export async function filterEnabledNotifications(client, notices) {
  const candidates = notices.filter((notice) => notice.delivery_enabled !== false);
  const ids = [...new Set(candidates.map((notice) => notice.recipient_id))];
  if (!ids.length) return [];
  const disabled = new Set();
  for (let offset = 0; offset < ids.length; offset += 50) {
    const { data, error } = await client
      .from('notification_preferences')
      .select('user_id,category')
      .in('user_id', ids.slice(offset, offset + 50))
      .eq('enabled', false);
    if (error) throw error;
    for (const row of data || []) disabled.add(`${row.user_id}:${row.category}`);
  }
  return candidates.filter(
    (notice) =>
      !disabled.has(`${notice.recipient_id}:${notificationPreferenceCategory(notice.type)}`),
  );
}
