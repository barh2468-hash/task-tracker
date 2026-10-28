import { useState } from 'react';
import { NotificationsContext } from '../notifications/context.js';
import NotificationsPanel from '../notifications/components/NotificationsPanel.jsx';
import GprInboxAlert from '../notifications/components/GprInboxAlert.jsx';

// DEV-only fixture: notification actions stay in memory and never call an API.
export default function GprNotificationsPreview({ order, onOpen }) {
  const [isRead, setIsRead] = useState(false);
  const notifications = [
    {
      id: 'local-gpr-notification',
      type: 'gpr_email_order_received',
      gpr_order_id: order.id,
      gpr_work_orders: order,
      created_at: order.created_at,
      is_read: isRead,
    },
  ];
  return (
    <NotificationsContext.Provider
      value={{
        notifications,
        unreadCount: isRead ? 0 : 1,
        markNotificationRead: () => setIsRead(true),
        markAllNotificationsRead: () => setIsRead(true),
        gprNotification: isRead || order.deleted_at ? null : notifications[0],
        dismissGprAlert: () => setIsRead(true),
      }}
    >
      <NotificationsPanel onNavigate={() => onOpen(order.id)} />
      <GprInboxAlert onNavigate={() => onOpen(order.id)} />
    </NotificationsContext.Provider>
  );
}
