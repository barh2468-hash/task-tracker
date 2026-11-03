import { notificationText } from './notificationText.js';

export const notificationCategories = [
  'projects',
  'tasks',
  'attendance',
  'drawings',
  'gpr',
  'vehicles',
  'other',
];

export function notificationCategory(item) {
  const type = item.type || '';
  if (type.startsWith('gpr_')) return 'gpr';
  if (type.startsWith('task_')) return 'tasks';
  if (type.startsWith('attendance_') || ['work_started', 'work_ended'].includes(type))
    return 'attendance';
  if (/^(drawing_|drafter_)/.test(type) || type.startsWith('project_review_')) return 'drawings';
  if (type.startsWith('vehicle_')) return 'vehicles';
  return item.project_id ? 'projects' : 'other';
}

export function filterNotifications(notifications, { status, category, search }, t, locale) {
  const query = search.trim().toLocaleLowerCase(locale);
  return notifications.filter((item) => {
    if (status === 'unread' && item.is_read) return false;
    if (status === 'read' && !item.is_read) return false;
    if (category !== 'all' && notificationCategory(item) !== category) return false;
    if (!query) return true;
    const text = notificationText(item, t);
    return [
      text.title,
      text.body,
      item.projects?.name,
      item.profiles?.full_name,
      item.gpr_work_orders?.title,
      item.gpr_work_orders?.order_number,
    ].some((value) =>
      String(value || '')
        .toLocaleLowerCase(locale)
        .includes(query),
    );
  });
}
