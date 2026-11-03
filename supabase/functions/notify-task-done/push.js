import { filterEnabledNotifications } from '../_shared/notificationPreferences.js';
import { taskReportEmail } from './template.js';

export async function deliverTaskReportPush(job, { client, sendPush, configured }) {
  if (!job.notification_id) return;
  const { data: notice, error } = await client
    .from('notifications')
    .select('id,recipient_id,type,delivery_enabled,is_read')
    .eq('id', job.notification_id)
    .eq('recipient_id', job.recipient_id)
    .maybeSingle();
  if (error) throw error;
  if (!notice || notice.is_read || !(await filterEnabledNotifications(client, [notice])).length)
    return;
  const { data: subscriptions, error: subscriptionError } = await client
    .from('push_subscriptions')
    .select('id,endpoint,p256dh,auth')
    .eq('user_id', job.recipient_id);
  if (subscriptionError) throw subscriptionError;
  if (!subscriptions?.length) return;
  if (!configured) throw new Error('Push credentials are not configured');
  const { count, error: countError } = await client
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('recipient_id', job.recipient_id)
    .eq('delivery_enabled', true)
    .eq('is_read', false);
  if (countError) throw countError;
  const title = taskReportEmail(job).subject.slice(0, 180);
  await Promise.all(
    subscriptions.map(async (subscription) => {
      try {
        await sendPush(
          {
            endpoint: subscription.endpoint,
            keys: { p256dh: subscription.p256dh, auth: subscription.auth },
          },
          JSON.stringify({
            title,
            body: job.report.summary.slice(0, 900),
            url: `/app/projects?project=${encodeURIComponent(job.report.project_id)}&tab=tasks`,
            tag: `task-report-${job.report_id}`,
            badgeCount: count || 1,
          }),
          { TTL: 3600 },
        );
      } catch (error) {
        if ([404, 410].includes(Number(error.statusCode))) {
          const { error: deleteError } = await client
            .from('push_subscriptions')
            .delete()
            .eq('id', subscription.id);
          if (deleteError) throw deleteError;
        } else throw error;
      }
    }),
  );
}
