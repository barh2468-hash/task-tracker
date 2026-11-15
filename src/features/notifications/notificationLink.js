import { projectDeepLinkPath } from '../../utils/navigation.js';

export function notificationLink(notification) {
  if(notification.type?.startsWith('quote_'))return {path:notification.quote_id?`/app/quotes?quote=${encodeURIComponent(notification.quote_id)}`:'/app/quotes',label:'quotes.title'};
  if (notification.type === 'gpr_email_order_received' && notification.gpr_order_id) {
    return {
      path: `/app/gpr?order=${encodeURIComponent(notification.gpr_order_id)}`,
      label: 'gpr.openOrder',
    };
  }
  if (notification.project_id) {
    return { path: projectDeepLinkPath(notification.project_id), label: 'פתח פרויקט' };
  }
  return null;
}
