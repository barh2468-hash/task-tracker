import { supabase } from '../supabase.js';

export function getNotificationPreferences(userId) {
  return supabase.from('notification_preferences').select('category,enabled').eq('user_id', userId);
}

export function saveNotificationPreference(userId, category, enabled) {
  return supabase
    .from('notification_preferences')
    .upsert({ user_id: userId, category, enabled }, { onConflict: 'user_id,category' })
    .select('category,enabled')
    .single();
}

export function getNotifications(userId, { offset = 0, limit = 80 } = {}) {
  return supabase
    .from('notifications')
    .select(
      '*, profiles:created_by(full_name), projects:project_id(name), gpr_work_orders:gpr_order_id(title,order_number,deleted_at)',
    )
    .eq('recipient_id', userId)
    .eq('delivery_enabled', true)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .range(offset, offset + limit - 1);
}

export function getUnreadNotificationCount(userId) {
  return supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('recipient_id', userId)
    .eq('delivery_enabled', true)
    .eq('is_read', false);
}

export function getUnreadGprNotifications(userId) {
  return supabase
    .from('notifications')
    .select(
      'id,type,title,body,gpr_order_id,is_read,created_at,gpr_work_orders:gpr_order_id(title,order_number,deleted_at)',
    )
    .eq('recipient_id', userId)
    .eq('delivery_enabled', true)
    .eq('type', 'gpr_email_order_received')
    .eq('is_read', false)
    .order('created_at', { ascending: false });
}

export function setNotificationsRead(notificationIds, isRead, userId) {
  return supabase
    .from('notifications')
    .update({ is_read: isRead })
    .eq('recipient_id', userId)
    .in('id', notificationIds)
    .select('id');
}

export function markNotificationRead(notificationId, userId) {
  return setNotificationsRead([notificationId], true, userId);
}

export function markAllNotificationsRead(userId) {
  return supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('recipient_id', userId)
    .eq('is_read', false);
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
