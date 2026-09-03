import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

const headers = { 'Content-Type': 'application/json' };
const APP_URL = 'https://infrastructure-tracker.vercel.app/app';

function israelParts(now = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Jerusalem', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23', weekday: 'short',
    }).formatToParts(now).map((part) => [part.type, part.value]),
  );
  const weekdayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
    weekday: weekdayMap[parts.weekday],
  };
}

function timeMinutes(value: string) {
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY')!;
    const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY')!;
    const vapidSubject = Deno.env.get('VAPID_SUBJECT') || 'mailto:office@maya-tm.com';
    const db = createClient(supabaseUrl, serviceRoleKey);
    const local = israelParts();

    const { data: settings, error: settingsError } = await db
      .from('attendance_reminder_settings').select('*').eq('id', true).single();
    if (settingsError) throw settingsError;
    if (!settings.enabled || !settings.weekdays.includes(local.weekday)) {
      return new Response(JSON.stringify({ ok: true, phase: 'inactive' }), { headers });
    }

    const first = timeMinutes(settings.first_reminder_time);
    const phases = [
      { type: 'attendance_reminder_first', minute: first, target: 'worker' },
      { type: 'attendance_reminder_repeat', minute: first + settings.repeat_after_minutes, target: 'worker' },
      { type: 'attendance_missing_escalation', minute: first + settings.escalation_after_minutes, target: 'manager' },
    ];
    const phase = phases.find((item) => local.minutes >= item.minute && local.minutes < item.minute + 5);
    if (!phase) return new Response(JSON.stringify({ ok: true, phase: 'waiting' }), { headers });

    const dayStart = `${local.date}T00:00:00.000Z`;
    const [{ data: workers, error: workersError }, { data: sessions, error: sessionsError }] = await Promise.all([
      db.from('profiles').select('id,full_name').eq('role', 'field_worker'),
      db.from('attendance_sessions').select('worker_id').eq('attendance_date', local.date),
    ]);
    if (workersError) throw workersError;
    if (sessionsError) throw sessionsError;
    const presentIds = new Set((sessions || []).map((item) => item.worker_id));
    const missingWorkers = (workers || []).filter((worker) => !presentIds.has(worker.id));
    if (!missingWorkers.length) return new Response(JSON.stringify({ ok: true, phase: phase.type, missing: 0 }), { headers });

    const { data: managers, error: managersError } = phase.target === 'manager'
      ? await db.from('profiles').select('id').eq('role', 'manager')
      : { data: [], error: null };
    if (managersError) throw managersError;

    const newNotifications: Array<{ recipient_id: string; title: string; body: string }> = [];
    for (const worker of missingWorkers) {
      const recipients = phase.target === 'worker' ? [worker.id] : (managers || []).map((manager) => manager.id);
      const title = phase.target === 'worker' ? 'תזכורת כניסה לעבודה' : `לא בוצעה כניסה: ${worker.full_name}`;
      const body = phase.target === 'worker'
        ? `${worker.full_name}, עדיין לא נרשמה כניסה לעבודה היום.`
        : `${worker.full_name} עדיין לא ביצע כניסה לעבודה היום.`;
      for (const recipientId of recipients) {
        const { data: duplicate } = await db.from('notifications').select('id').eq('recipient_id', recipientId)
          .eq('type', phase.type).eq('title', title).gte('created_at', dayStart).maybeSingle();
        if (duplicate) continue;
        const { error } = await db.from('notifications').insert({ recipient_id: recipientId, type: phase.type, title, body });
        if (!error) newNotifications.push({ recipient_id: recipientId, title, body });
      }
    }

    if (newNotifications.length && vapidPublicKey && vapidPrivateKey) {
      const recipientIds = [...new Set(newNotifications.map((item) => item.recipient_id))];
      const [{ data: subscriptions }, { data: unread }] = await Promise.all([
        db.from('push_subscriptions').select('id,user_id,endpoint,p256dh,auth').in('user_id', recipientIds),
        db.from('notifications').select('recipient_id').in('recipient_id', recipientIds).eq('is_read', false),
      ]);
      const counts = new Map<string, number>();
      for (const item of unread || []) counts.set(item.recipient_id, (counts.get(item.recipient_id) || 0) + 1);
      webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
      await Promise.all((subscriptions || []).map(async (subscription) => {
        const notice = newNotifications.find((item) => item.recipient_id === subscription.user_id)!;
        try {
          await webpush.sendNotification({ endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } }, JSON.stringify({
            title: notice.title, body: notice.body, url: APP_URL, tag: phase.type,
            badgeCount: counts.get(subscription.user_id) || 1,
          }), { TTL: 60 * 60 });
        } catch (error) {
          const status = Number((error as { statusCode?: number }).statusCode || 0);
          if (status === 404 || status === 410) await db.from('push_subscriptions').delete().eq('id', subscription.id);
        }
      }));
    }

    return new Response(JSON.stringify({ ok: true, phase: phase.type, missing: missingWorkers.length, created: newNotifications.length }), { headers });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }), { status: 500, headers });
  }
});
