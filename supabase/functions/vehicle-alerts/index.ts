import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';
import { buildAlerts, type Alert } from './alerts.ts';

// Daily fleet alerts: insurance / inspection / lease expiry, weekly digest of
// missing data, monthly odometer reminder + escalation, overdue forms.
// Scheduled hourly by pg_cron; the function itself only acts at 07:xx Israel
// time on Sunday-Thursday, so it is safe across daylight-saving changes.

const headers = { 'Content-Type': 'application/json' };
const APP_ORIGIN = 'https://infrastructure-tracker.vercel.app';
const RUN_HOUR = 7;
const WORKING_WEEKDAYS = [0, 1, 2, 3, 4];

function secureEquals(left: string, right: string) {
  const leftBytes = new TextEncoder().encode(left);
  const rightBytes = new TextEncoder().encode(right);
  if (leftBytes.length !== rightBytes.length) return false;
  let difference = 0;
  for (let index = 0; index < leftBytes.length; index += 1) difference |= leftBytes[index] ^ rightBytes[index];
  return difference === 0;
}

function isAuthorizedCronRequest(req: Request) {
  const expected = Deno.env.get('CRON_SECRET') || '';
  const supplied = req.headers.get('x-cron-secret') || '';
  return Boolean(expected && supplied && secureEquals(expected, supplied));
}

function israelNow(now = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Jerusalem', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', hourCycle: 'h23', weekday: 'short',
    }).formatToParts(now).map((part) => [part.type, part.value]),
  );
  const weekdayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    hour: Number(parts.hour),
    weekday: weekdayMap[parts.weekday],
  };
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  if (!isAuthorizedCronRequest(req)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers });
  }

  try {
    const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const local = israelNow();
    if (local.hour !== RUN_HOUR || !WORKING_WEEKDAYS.includes(local.weekday)) {
      return new Response(JSON.stringify({ ok: true, phase: 'waiting' }), { headers });
    }

    const monthStart = `${local.date.slice(0, 7)}-01`;
    const [vehicles, policies, inspections, readings, assignments, people, fines] = await Promise.all([
      db.from('vehicles').select('id,plate_number,make_model,kind,status,driver_id,lease_end').neq('status', 'retired'),
      db.from('vehicle_insurance_policies').select('vehicle_id,valid_to'),
      db.from('vehicle_inspections').select('vehicle_id,valid_to'),
      db.from('vehicle_odometer_readings').select('vehicle_id').eq('reading_month', monthStart),
      db.from('vehicle_assignments').select('vehicle_id,driver_id,driver_name').is('ended_at', null),
      db.from('profiles').select('id,full_name,role'),
      db.from('vehicle_fines').select('id,vehicle_id,driver_id,fine_number,amount_ils,due_date,status').in('status', ['new', 'forwarded']),
    ]);
    for (const result of [vehicles, policies, inspections, readings, assignments, people, fines]) {
      if (result.error) throw result.error;
    }

    const profiles = people.data || [];
    const alerts = buildAlerts({
      today: local.date,
      weekday: local.weekday,
      vehicles: vehicles.data || [],
      policies: policies.data || [],
      inspections: inspections.data || [],
      readingsThisMonth: readings.data || [],
      openAssignments: assignments.data || [],
      recipientIds: profiles.filter((profile) => profile.role === 'manager').map((profile) => profile.id),
      nameById: Object.fromEntries(profiles.map((profile) => [profile.id, profile.full_name])),
      unpaidFines: fines.data || [],
    });
    if (!alerts.length) return new Response(JSON.stringify({ ok: true, created: 0 }), { headers });

    // De-duplicate: same recipient + type + title already sent in the period.
    const dayStart = `${local.date}T00:00:00.000Z`;
    const types = [...new Set(alerts.map((alert) => alert.type))];
    const { data: existing, error: existingError } = await db
      .from('notifications')
      .select('recipient_id,type,title,created_at')
      .in('type', types)
      .gte('created_at', `${monthStart}T00:00:00.000Z`);
    if (existingError) throw existingError;
    const sent = new Set(
      (existing || []).map((row) => `${row.recipient_id}|${row.type}|${row.title}|${row.created_at >= dayStart ? 'day' : 'month'}`),
    );
    const fresh = alerts.filter((alert) => {
      const key = `${alert.recipientId}|${alert.type}|${alert.title}`;
      // A month-period alert is blocked by any send this month; a day-period one only by today's.
      return alert.period === 'month' ? !sent.has(`${key}|day`) && !sent.has(`${key}|month`) : !sent.has(`${key}|day`);
    });
    if (!fresh.length) return new Response(JSON.stringify({ ok: true, created: 0 }), { headers });

    const { error: insertError } = await db.from('notifications').insert(
      fresh.map((alert) => ({ recipient_id: alert.recipientId, type: alert.type, title: alert.title, body: alert.body })),
    );
    if (insertError) throw insertError;

    await sendPush(db, fresh);
    return new Response(JSON.stringify({ ok: true, created: fresh.length }), { headers });
  } catch (error) {
    console.error('Vehicle alerts failed:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500, headers });
  }
});

async function sendPush(db: ReturnType<typeof createClient>, alerts: Alert[]) {
  const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY');
  const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY');
  if (!vapidPublicKey || !vapidPrivateKey) return;

  const byRecipient = new Map<string, Alert[]>();
  for (const alert of alerts) byRecipient.set(alert.recipientId, [...(byRecipient.get(alert.recipientId) || []), alert]);
  const recipientIds = [...byRecipient.keys()];

  const [{ data: subscriptions }, { data: unread }] = await Promise.all([
    db.from('push_subscriptions').select('id,user_id,endpoint,p256dh,auth').in('user_id', recipientIds),
    db.from('notifications').select('recipient_id').in('recipient_id', recipientIds).eq('is_read', false),
  ]);
  const counts = new Map<string, number>();
  for (const item of unread || []) counts.set(item.recipient_id, (counts.get(item.recipient_id) || 0) + 1);

  webpush.setVapidDetails(Deno.env.get('VAPID_SUBJECT') || 'mailto:office@maya-tm.com', vapidPublicKey, vapidPrivateKey);
  await Promise.all((subscriptions || []).map(async (subscription) => {
    const mine = byRecipient.get(subscription.user_id) || [];
    if (!mine.length) return;
    // One push per person per run: a digest when there are several.
    const single = mine.length === 1 ? mine[0] : null;
    try {
      await webpush.sendNotification(
        { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } },
        JSON.stringify({
          title: single ? single.title : 'התראות רכבים',
          body: single ? single.body : `${mine.length} התראות חדשות על רכבי החברה`,
          url: `${APP_ORIGIN}${single ? single.url : '/app/notifications'}`,
          tag: 'vehicle-alerts',
          badgeCount: counts.get(subscription.user_id) || 1,
        }),
        { TTL: 6 * 60 * 60 },
      );
    } catch (error) {
      const status = Number((error as { statusCode?: number }).statusCode || 0);
      if (status === 404 || status === 410) await db.from('push_subscriptions').delete().eq('id', subscription.id);
    }
  }));
}
