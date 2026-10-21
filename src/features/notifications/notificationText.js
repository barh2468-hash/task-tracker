export function notificationText(notification, t) {
  if (notification.type !== 'project_review_approved') {
    return { title: notification.title, body: notification.body };
  }

  return {
    title: notification.projects?.name
      ? t('ההגהה אושרה והפרויקט עבר לבקרה: {{name}}', { name: notification.projects.name })
      : t('ההגהה אושרה והפרויקט עבר לבקרה'),
    body: notification.profiles?.full_name
      ? t('{{name}} אישר את ההגהה. הפרויקט עבר לבקרה.', { name: notification.profiles.full_name })
      : t('הפרויקט עבר לבקרה לאחר אישור ההגהה.'),
  };
}
