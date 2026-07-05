import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    const fromEmail = Deno.env.get('FROM_EMAIL');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!resendApiKey || !fromEmail || !supabaseUrl || !serviceRoleKey) {
      throw new Error('Missing RESEND_API_KEY, FROM_EMAIL, SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    }

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
      return `<li><b>${s.profiles?.full_name || 'עובד'}</b> - ${s.projects?.name || 'פרויקט'} (${s.projects?.location || ''})<br/>התחלה: ${start} · סיום: ${end}${s.end_note ? `<br/>הערת סיום: ${s.end_note}` : ''}</li>`;
    }).join('');

    const historyRows = (history || []).map((h: any) => {
      const time = new Date(h.created_at).toLocaleString('he-IL');
      return `<li><b>${h.projects?.name || 'פרויקט'}</b> - ${h.new_status}<br/>${h.profiles?.full_name || 'משתמש'} · ${time}${h.note ? `<br/>${h.note}` : ''}</li>`;
    }).join('');

    const subject = `סיכום יומי - מערכת משימות מאיה - ${new Date().toLocaleDateString('he-IL')}`;
    const html = `
      <div dir="rtl" style="font-family:Arial,sans-serif;line-height:1.7;color:#0b2545">
        <h2>סיכום יומי - מערכת משימות מאיה</h2>
        <p>תאריך: ${new Date().toLocaleDateString('he-IL')}</p>
        <h3>שעות עבודה היום</h3>
        <ul>${sessionRows || '<li>לא נרשמו שעות עבודה היום.</li>'}</ul>
        <h3>עדכונים ושינויי סטטוס היום</h3>
        <ul>${historyRows || '<li>לא נרשמו עדכונים היום.</li>'}</ul>
        ${appUrl ? `<p><a href="${appUrl}">כניסה למערכת</a></p>` : ''}
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
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
