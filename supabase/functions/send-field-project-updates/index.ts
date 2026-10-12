import { createClient } from 'jsr:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';
import { sendEmail } from '../_shared/smtp.ts';
import { deliverFieldUpdate } from './delivery.js';

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const respond = (body: unknown, status = 200) => Response.json(body, { status, headers });
function secureEquals(a: string, b: string) {
  const left = new TextEncoder().encode(a), right = new TextEncoder().encode(b);
  if (!left.length || left.length !== right.length) return false;
  let difference = 0;
  for (let i = 0; i < left.length; i++) difference |= left[i] ^ right[i];
  return difference === 0;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers });
  if (req.method !== 'POST') return respond({ error: 'Method not allowed' }, 405);
  try {
    const url = Deno.env.get('SUPABASE_URL')!, anon = Deno.env.get('SUPABASE_ANON_KEY')!, service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    let appUrl = Deno.env.get('APP_URL') || '';
    if (!secureEquals(Deno.env.get('CRON_SECRET') || '', req.headers.get('x-cron-secret') || '')) {
      const userClient = createClient(url, anon, { global: { headers: { Authorization: req.headers.get('Authorization') || '' } } });
      const { data, error } = await userClient.auth.getUser();
      if (error || !data.user) return respond({ error: 'Unauthorized' }, 401);
      const { data: profile } = await userClient.from('profiles').select('role').eq('id', data.user.id).single();
      if (!['manager', 'admin'].includes(profile?.role || '')) return respond({ error: 'Manager access required' }, 403);
      // A direct application call can provide its own origin for the mail link.
      const body = await req.json().catch(() => ({}));
      if (!appUrl && typeof body.appUrl === 'string') {
        const candidate = new URL(body.appUrl);
        if (candidate.protocol === 'https:' || ['127.0.0.1', 'localhost'].includes(candidate.hostname)) appUrl = candidate.origin;
      }
    }
    const client = createClient(url, service);
    const { data: jobs, error } = await client.rpc('claim_field_project_updates', { p_limit: 5 });
    if (error) throw error;
    const vapidPublic = Deno.env.get('VAPID_PUBLIC_KEY'), vapidPrivate = Deno.env.get('VAPID_PRIVATE_KEY');
    if (vapidPublic && vapidPrivate) webpush.setVapidDetails(Deno.env.get('VAPID_SUBJECT') || 'mailto:office@maya-tm.com', vapidPublic, vapidPrivate);
    const results = await Promise.all((jobs || []).map((job: { recipient_id: string; id: string; title: string; body: string; project_id: string }) => deliverFieldUpdate({
      job, client, sendEmail, appUrl,
      sendPush: async () => {
        if (!vapidPublic || !vapidPrivate) return;
        const { data: subscriptions, error: loadError } = await client.from('push_subscriptions').select('id,endpoint,p256dh,auth').eq('user_id', job.recipient_id);
        if (loadError) throw loadError;
        const { count, error: countError } = await client.from('notifications').select('id', { count: 'exact', head: true }).eq('recipient_id', job.recipient_id).eq('is_read', false);
        if (countError) throw countError;
        await Promise.all((subscriptions || []).map(async (subscription) => {
          try {
            await webpush.sendNotification({ endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } }, JSON.stringify({ title: job.title, body: job.body, tag: `field-update-${job.id}`, url: `/app/projects?project=${encodeURIComponent(job.project_id)}`, badgeCount: count || 0 }), { TTL: 3600 });
          } catch (pushError) {
            if ([404, 410].includes(Number((pushError as { statusCode?: number }).statusCode))) {
              const { error: deleteError } = await client.from('push_subscriptions').delete().eq('id', subscription.id);
              if (deleteError) throw deleteError;
            } else throw pushError;
          }
        }));
      },
    })));
    return respond({ ok: true, processed: results.length, delivered: results.filter((result) => result.ok).length, failed: results.filter((result) => !result.ok).length });
  } catch (error) { return respond({ error: error instanceof Error ? error.message : String(error) }, 500); }
});
