import * as notificationsApi from '../../services/api/notifications.js';
import * as edgeFunctions from '../../services/api/edgeFunctions.js';

export async function getNotifications() {
  const { data, error } = await notificationsApi.getNotifications();
  if (error) {
    // The table may not exist until the SQL migration is run, so do not block the app.
    console.warn('Notifications load failed:', error.message);
    return [];
  }
  return data || [];
}

export function markNotificationRead(notificationId) {
  return notificationsApi.markNotificationRead(notificationId);
}

export function markAllNotificationsRead() {
  return notificationsApi.markAllNotificationsRead();
}

export async function sendPushNotification({ recipientUserId, recipientRole, title, body, projectId }) {
  const { error } = await edgeFunctions.sendPushNotification({
    recipientUserId,
    recipientRole,
    title,
    body,
    projectId,
    url: projectId ? `/app/projects?project=${encodeURIComponent(projectId)}` : '/app',
  });
  if (error) console.warn('Push notification failed:', error.message);
}

export async function createManagerNotification(type, title, body, projectId, taskId) {
  const { error } = await notificationsApi.createManagerNotifications({ type, title, body, projectId, taskId });
  if (error) {
    console.warn('Internal notification failed:', error.message);
    return;
  }
  await sendPushNotification({ recipientRole: 'manager', title, body, projectId });
}

export async function createUserNotification(userId, type, title, body, projectId, taskId) {
  if (!userId) return;
  const { error } = await notificationsApi.createUserNotificationRow({
    userId,
    type,
    title,
    body,
    projectId,
    taskId,
  });
  if (error) {
    console.warn('User notification failed:', error.message);
    return;
  }
  await sendPushNotification({ recipientUserId: userId, title, body, projectId });
}
