import { supabase } from '../supabase.js';

export function getNotifications() {
  return supabase
    .from('notifications')
    .select('*, profiles:created_by(full_name), projects:project_id(name)')
    .order('created_at', { ascending: false })
    .limit(80);
}

export function markNotificationRead(notificationId) {
  return supabase.from('notifications').update({ is_read: true }).eq('id', notificationId);
}

export function markAllNotificationsRead() {
  return supabase.from('notifications').update({ is_read: true }).eq('is_read', false);
}

export function createManagerNotifications({ type, title, body, projectId, taskId }) {
  return supabase.rpc('create_manager_notifications', {
    p_type: type,
    p_title: title,
    p_body: body,
    p_project_id: projectId || null,
    p_task_id: taskId || null,
  });
}

export function createUserNotificationRow({ userId, type, title, body, projectId, taskId }) {
  return supabase.rpc('create_user_notification', {
    p_user_id: userId,
    p_type: type,
    p_title: title,
    p_body: body,
    p_project_id: projectId || null,
    p_task_id: taskId || null,
  });
}
