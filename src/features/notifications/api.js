import * as notificationsApi from '../../services/api/notifications.js';
import * as edgeFunctions from '../../services/api/edgeFunctions.js';

export async function getNotifications(userId, limit = 80) {
  const rows = [];
  // Keep each request below the API row cap, including when viewing older history.
  for (let offset = 0; offset <= limit; offset += 80) {
    const size = Math.min(80, limit + 1 - offset);
    const { data, error } = await notificationsApi.getNotifications(userId, {
      offset,
      limit: size,
    });
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < size) break;
  }
  return { notifications: rows.slice(0, limit), hasMore: rows.length > limit };
}

export async function getNotificationSnapshot(userId, includeGpr, limit = 80) {
  const [history, unread, gpr] = await Promise.all([
    getNotifications(userId, limit),
    notificationsApi.getUnreadNotificationCount(userId),
    includeGpr ? notificationsApi.getUnreadGprNotifications(userId) : Promise.resolve({ data: [] }),
  ]);
  if (unread.error) console.warn('Unread notification count failed:', unread.error.code);
  if (gpr.error) console.warn('GPR notification load failed:', gpr.error.code);
  return {
    ...history,
    unreadCount: unread.error ? null : unread.count,
    gprUnread: gpr.data || [],
  };
}

export function markNotificationRead(notificationId, userId) {
  return notificationsApi.markNotificationRead(notificationId, userId);
}

export function markAllNotificationsRead(userId) {
  return notificationsApi.markAllNotificationsRead(userId);
}

export async function setNotificationsRead(notificationIds, isRead, userId) {
  const data = [];
  // Bound URL size and returned rows when selecting a large inbox.
  for (let offset = 0; offset < notificationIds.length; offset += 80) {
    const result = await notificationsApi.setNotificationsRead(
      notificationIds.slice(offset, offset + 80),
      isRead,
      userId,
    );
    if (result.error) return result;
    data.push(...(result.data || []));
  }
  return { data, error: null };
}

export async function sendPushNotification({
  recipientUserId,
  recipientRole,
  title,
  body,
  projectId,
}) {
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
  const { error } = await notificationsApi.createManagerNotifications({
    type,
    title,
    body,
    projectId,
    taskId,
  });
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
