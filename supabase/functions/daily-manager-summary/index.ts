import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

class HttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function secureEquals(left: string, right: string) {
  const leftBytes = new TextEncoder().encode(left);
  const rightBytes = new TextEncoder().encode(right);
  if (leftBytes.length !== rightBytes.length) return false;

  let difference = 0;
  for (let index = 0; index < leftBytes.length; index += 1) {
    difference |= leftBytes[index] ^ rightBytes[index];
  }
  return difference === 0;
}

function isAuthorizedCronRequest(req: Request) {
  const expectedSecret = Deno.env.get('CRON_SECRET') || '';
  const suppliedSecret = req.headers.get('x-cron-secret') || '';
  return Boolean(expectedSecret && suppliedSecret && secureEquals(expectedSecret, suppliedSecret));
}

async function requireManagerOrCron(
  req: Request,
  supabaseUrl: string,
  anonKey: string,
) {
  if (isAuthorizedCronRequest(req)) return;

  const authHeader = req.headers.get('Authorization') || '';
  if (!authHeader.toLowerCase().startsWith('bearer ')) {
    throw new HttpError(401, 'Unauthorized');
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) throw new HttpError(401, 'Unauthorized');

  const { data: profile, error: profileError } = await userClient
    .from('profiles')
    .select('role')
    .eq('id', userData.user.id)
    .maybeSingle();
  if (profileError) throw profileError;
  if (profile?.role !== 'manager') throw new HttpError(403, 'Manager access required');
}

function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  try {
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    const fromEmail = Deno.env.get('FROM_EMAIL');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!resendApiKey || !fromEmail || !supabaseUrl || !anonKey || !serviceRoleKey) {
      throw new Error('Missing RESEND_API_KEY, FROM_EMAIL, SUPABASE_URL, SUPABASE_ANON_KEY or SUPABASE_SERVICE_ROLE_KEY');
    }

    await requireManagerOrCron(req, supabaseUrl, anonKey);

    const body = await req.json().catch(() => ({}));
    const appUrl = body?.appUrl || '';
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const today = new Date().toISOString().slice(0, 10);
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const { data: managers, error: managersError } = await supabase
      .from('profiles')
      .select('email,full_name')
      .eq('role', 'manager')
      .not('email', 'is', null);
    if (managersError) throw managersError;

    const { data: sessions, error: sessionsError } = await supabase
      .from('work_sessions')
      .select('started_at,ended_at,end_note,profiles:worker_id(full_name,email),projects:project_id(name,client_name,location)')
      .gte('started_at', today)
      .lt('started_at', tomorrow)
      .order('started_at', { ascending: true });
    if (sessionsError) throw sessionsError;

    const { data: attendance, error: attendanceError } = await supabase
      .from('attendance_sessions')
      .select('started_at,ended_at,end_note,attendance_type,attendance_date,is_all_day,profiles:worker_id(full_name,email)')
      .eq('attendance_date', today)
      .order('started_at', { ascending: true });
    if (attendanceError) throw attendanceError;

    const { data: history, error: historyError } = await supabase
      .from('status_history')
      .select('new_status,note,created_at,profiles:changed_by(full_name),projects:project_id(name,client_name,location)')
      .gte('created_at', today)
      .lt('created_at', tomorrow)
      .order('created_at', { ascending: true });
    if (historyError) throw historyError;

    const recipients = (managers || []).map((m: any) => m.email).filter(Boolean);
    if (!recipients.length) return new Response(JSON.stringify({ ok: true, sentTo: 0, reason: 'no managers' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const sessionRows = (sessions || []).map((s: any) => {
      const start = new Date(s.started_at).toLocaleString('he-IL');
      const end = s.ended_at ? new Date(s.ended_at).toLocaleString('he-IL') : 'פתוח';
      return `<tr><td>${escapeHtml(s.profiles?.full_name || 'עובד')}</td><td><b>${escapeHtml(s.projects?.name || 'פרויקט')}</b><br/><span style="color:#64748b">${escapeHtml(s.projects?.location || '')}</span></td><td>${escapeHtml(start)}</td><td>${escapeHtml(end)}</td><td>${escapeHtml(s.end_note || '—')}</td></tr>`;
    }).join('');

    const attendanceRows = (attendance || []).map((s: any) => {
      const typeLabels: Record<string, string> = {
        field: 'עבודה בשטח',
        office: 'משרד',
        vacation: 'חופש',
        sick: 'מחלה',
        reserve_duty: 'מילואים',
      };
      const typeLabel = typeLabels[s.attendance_type] || 'נוכחות כללית';
      if (s.is_all_day) {
        return `<tr><td>${escapeHtml(s.profiles?.full_name || 'עובד')}</td><td>${escapeHtml(typeLabel)}</td><td colspan="3">דיווח יומי ללא שעות</td><td>${escapeHtml(s.end_note || '—')}</td></tr>`;
      }
      const start = new Date(s.started_at);
      const end = s.ended_at ? new Date(s.ended_at) : null;
      const minutes = Math.max(0, Math.round(((end || new Date()).getTime() - start.getTime()) / 60000));
      const duration = `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')}`;
      return `<tr><td>${escapeHtml(s.profiles?.full_name || 'עובד')}</td><td>${escapeHtml(typeLabel)}</td><td>${escapeHtml(start.toLocaleString('he-IL'))}</td><td>${escapeHtml(end ? end.toLocaleString('he-IL') : 'פתוח')}</td><td>${escapeHtml(duration)}</td><td>${escapeHtml(s.end_note || '—')}</td></tr>`;
    }).join('');

    const historyRows = (history || []).map((h: any) => {
      const time = new Date(h.created_at).toLocaleString('he-IL');
      return `<tr><td><b>${escapeHtml(h.projects?.name || 'פרויקט')}</b><br/><span style="color:#64748b">${escapeHtml(h.projects?.location || '')}</span></td><td>${escapeHtml(h.new_status)}</td><td>${escapeHtml(h.profiles?.full_name || 'משתמש')}</td><td>${escapeHtml(time)}</td><td>${escapeHtml(h.note || '—')}</td></tr>`;
    }).join('');

    const subject = `סיכום יומי - מערכת משימות מאיה - ${new Date().toLocaleDateString('he-IL')}`;
    const html = `
      <div dir="rtl" style="font-family:Arial,sans-serif;line-height:1.6;color:#0b2545;max-width:1100px;margin:auto">
        <h2>סיכום יומי - מערכת משימות מאיה</h2>
        <p>תאריך: ${new Date().toLocaleDateString('he-IL')}</p>
        <h3>נוכחות כללית היום</h3>
        <div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;border:1px solid #dbe4ee;font-size:14px"><thead style="background:#0b2545;color:#fff"><tr><th>עובד</th><th>סוג נוכחות</th><th>כניסה</th><th>יציאה</th><th>משך</th><th>הערה</th></tr></thead><tbody>${attendanceRows || '<tr><td colspan="6">לא נרשמה נוכחות כללית היום.</td></tr>'}</tbody></table></div>
        <h3>שעות לפי פרויקט היום</h3>
        <div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;border:1px solid #dbe4ee;font-size:14px"><thead style="background:#0b2545;color:#fff"><tr><th>עובד</th><th>פרויקט</th><th>התחלה</th><th>סיום</th><th>הערת סיום</th></tr></thead><tbody>${sessionRows || '<tr><td colspan="5">לא נרשמו שעות עבודה היום.</td></tr>'}</tbody></table></div>
        <h3>עדכונים ושינויי סטטוס היום</h3>
        <div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;border:1px solid #dbe4ee;font-size:14px"><thead style="background:#0b2545;color:#fff"><tr><th>פרויקט</th><th>סטטוס חדש</th><th>עודכן על ידי</th><th>מועד</th><th>הערה</th></tr></thead><tbody>${historyRows || '<tr><td colspan="5">לא נרשמו עדכונים היום.</td></tr>'}</tbody></table></div>
        ${appUrl ? `<p><a href="${escapeHtml(appUrl)}">כניסה למערכת</a></p>` : ''}
      </div>`;

    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: fromEmail, to: recipients, subject, html }),
    });
    if (!resendResponse.ok) throw new Error(`Resend error: ${await resendResponse.text()}`);
    const result = await resendResponse.json();
    return new Response(JSON.stringify({ ok: true, sentTo: recipients.length, result }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500;
    if (!(error instanceof HttpError)) console.error('Daily manager summary failed:', error);
    const message = error instanceof HttpError ? error.message : 'Internal server error';
    return new Response(JSON.stringify({ error: message }), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
