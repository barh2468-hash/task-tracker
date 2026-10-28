export function notificationText(notification, t) {
  if (notification.type === 'gpr_email_order_received') {
    const order = notification.gpr_work_orders;
    return {
      title: order?.title
        ? t('gpr.notificationTitleNamed', { name: order.title })
        : t('gpr.notificationTitle'),
      body: order?.order_number
        ? t('gpr.notificationBodyNumbered', { number: order.order_number })
        : t('gpr.notificationBody'),
    };
  }
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
