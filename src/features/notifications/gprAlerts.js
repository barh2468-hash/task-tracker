export function selectGprAlert(notifications, dismissedIds) {
  return (
    notifications.find(
      (item) =>
        item.type === 'gpr_email_order_received' &&
        !item.is_read &&
        !item.gpr_work_orders?.deleted_at &&
        !dismissedIds.includes(item.id),
    ) || null
  );
}

export function notificationUnreadCount(count, notifications, previous = 0) {
  return Number.isInteger(count) && count >= 0
    ? count
    : Math.max(previous, notifications.filter((item) => !item.is_read).length);
}

export function readDismissedGpr(storage, userId) {
  try {
    const ids = JSON.parse(storage.getItem(`gpr-alerts:${userId}`) || '[]');
    return Array.isArray(ids) ? ids.filter((id) => typeof id === 'string').slice(-1000) : [];
  } catch {
    return [];
  }
}

export function writeDismissedGpr(storage, userId, ids) {
  try {
    storage.setItem(`gpr-alerts:${userId}`, JSON.stringify(ids.slice(-1000)));
  } catch {
    /* Alerts remain usable when browser storage is unavailable. */
  }
}
