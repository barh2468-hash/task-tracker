import { supabase } from '../supabase.js';

export function getNotifications(userId) {
  return supabase
    .from('notifications')
    .select(
      '*, profiles:created_by(full_name), projects:project_id(name), gpr_work_orders:gpr_order_id(title,order_number,deleted_at)',
    )
    .eq('recipient_id', userId)
    .order('created_at', { ascending: false })
    .limit(80);
}

export function getUnreadNotificationCount(userId) {
  return supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('recipient_id', userId)
    .eq('is_read', false);
}

export function getUnreadGprNotifications(userId) {
  return supabase
    .from('notifications')
    .select(
      'id,type,title,body,gpr_order_id,is_read,created_at,gpr_work_orders:gpr_order_id(title,order_number,deleted_at)',
    )
    .eq('recipient_id', userId)
    .eq('type', 'gpr_email_order_received')
    .eq('is_read', false)
    .order('created_at', { ascending: false });
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
