import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type Payload = {
  recipientUserId?: string;
  recipientRole?: 'manager';
  title: string;
  body: string;
  projectId?: string;
  url?: string;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY')!;
    const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY')!;
    const vapidSubject = Deno.env.get('VAPID_SUBJECT') || 'mailto:office@maya-tm.com';
    if (!vapidPublicKey || !vapidPrivateKey) throw new Error('Push credentials are not configured');

    const authHeader = req.headers.get('Authorization') || '';
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user) throw new Error('Unauthorized');

    const payload = await req.json() as Payload;
    const title = String(payload.title || '').trim().slice(0, 180);
    const body = String(payload.body || '').trim().slice(0, 1000);
    if (!title || !body) throw new Error('Missing notification content');

    let notificationQuery = adminClient
      .from('notifications')
      .select('recipient_id')
      .eq('created_by', userData.user.id)
      .eq('title', title)
      .gte('created_at', new Date(Date.now() - 2 * 60 * 1000).toISOString());

    if (payload.recipientUserId) {
      notificationQuery = notificationQuery.eq('recipient_id', payload.recipientUserId);
    } else if (payload.recipientRole === 'manager') {
      const { data: managers, error: managerError } = await adminClient
        .from('profiles')
        .select('id')
        .eq('role', 'manager');
      if (managerError) throw managerError;
      const managerIds = (managers || []).map((manager) => manager.id);
      if (!managerIds.length) return Response.json({ ok: true, sent: 0 }, { headers: corsHeaders });
      notificationQuery = notificationQuery.in('recipient_id', managerIds);
    } else {
      throw new Error('Missing recipient');
    }

    const { data: matchingNotifications, error: notificationError } = await notificationQuery;
    if (notificationError) throw notificationError;
    const recipientIds = Array.from(new Set((matchingNotifications || []).map((item) => item.recipient_id)));
    if (!recipientIds.length) throw new Error('No matching internal notification');

    const { data: unreadNotifications, error: unreadError } = await adminClient
      .from('notifications')
      .select('recipient_id')
      .in('recipient_id', recipientIds)
      .eq('is_read', false);
    if (unreadError) throw unreadError;

    const unreadCountByRecipient = new Map<string, number>();
    for (const notification of unreadNotifications || []) {
      unreadCountByRecipient.set(
        notification.recipient_id,
        (unreadCountByRecipient.get(notification.recipient_id) || 0) + 1,
      );
    }

    const { data: subscriptions, error: subscriptionError } = await adminClient
      .from('push_subscriptions')
      .select('id,user_id,endpoint,p256dh,auth')
      .in('user_id', recipientIds);
    if (subscriptionError) throw subscriptionError;
    if (!subscriptions?.length) {
      return Response.json({ ok: true, sent: 0, reason: 'no_subscriptions' }, { headers: corsHeaders });
    }

    webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
    let sent = 0;
    const expiredIds: string[] = [];
    let failed = 0;
    await Promise.all(subscriptions.map(async (subscription) => {
      try {
        const notificationData = JSON.stringify({
          title,
          body,
          url: typeof payload.url === 'string' && payload.url.startsWith('/') ? payload.url : '/',
          tag: payload.projectId ? `project-${payload.projectId}` : undefined,
          badgeCount: unreadCountByRecipient.get(subscription.user_id) || 1,
        });
        await webpush.sendNotification({
          endpoint: subscription.endpoint,
          keys: { p256dh: subscription.p256dh, auth: subscription.auth },
        }, notificationData, { TTL: 60 * 60 });
        sent += 1;
      } catch (error) {
        failed += 1;
        const statusCode = Number((error as { statusCode?: number }).statusCode || 0);
        if (statusCode === 404 || statusCode === 410) expiredIds.push(subscription.id);
        else console.error('Push delivery failed', statusCode || error);
      }
    }));

    if (expiredIds.length) {
      await adminClient.from('push_subscriptions').delete().in('id', expiredIds);
    }

    return Response.json({
      ok: true,
      sent,
      failed,
      expired: expiredIds.length,
    }, {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error(error);
    return Response.json({ error: error instanceof Error ? error.message : String(error) }, {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
