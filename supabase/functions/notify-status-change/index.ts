import { createClient } from 'jsr:@supabase/supabase-js@2';

type Payload = {
  projectId: string;
  projectName: string;
  clientName?: string | null;
  location?: string | null;
  oldStatus?: string | null;
  newStatus: string;
  note?: string;
  changedByName?: string;
  changedByEmail?: string | null;
  changedByRole?: string;
  appUrl?: string;
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    const fromEmail = Deno.env.get('FROM_EMAIL') || 'MAYA Tracker <onboarding@resend.dev>';

    if (!supabaseUrl || !anonKey || !serviceRoleKey) throw new Error('Missing Supabase Edge Function secrets');
    if (!resendApiKey) throw new Error('Missing RESEND_API_KEY secret');

    const authHeader = req.headers.get('Authorization') || '';
    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user) throw new Error('Unauthorized');

    const payload = await req.json() as Payload;
    if (!payload.projectId || !payload.projectName || !payload.newStatus) throw new Error('Missing required status payload');

    const { data: changer, error: changerError } = await adminClient
      .from('profiles')
      .select('id,email,full_name,role')
      .eq('id', userData.user.id)
      .maybeSingle();

    if (changerError) throw changerError;
    if (!changer) throw new Error('Missing changer profile');

    // Only field workers trigger manager email notifications.
    // Managers can still update status, but do not trigger this email.
    if (changer.role !== 'field_worker') {
      return new Response(JSON.stringify({ ok: true, skipped: true, reason: 'changed_by_is_not_field_worker' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { data: managers, error: managersError } = await adminClient
      .from('profiles')
      .select('email,full_name')
      .eq('role', 'manager')
      .not('email', 'is', null);

    if (managersError) throw managersError;

    const recipients = Array.from(new Set((managers || []).map((m) => m.email).filter(Boolean))) as string[];
    if (!recipients.length) {
      return new Response(JSON.stringify({ ok: true, skipped: true, reason: 'no_manager_emails' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const subject = `עדכון סטטוס: ${payload.projectName} → ${payload.newStatus}`;
    const projectUrl = payload.appUrl ? `${payload.appUrl}` : '';
    const html = `
      <div dir="rtl" style="font-family:Arial,sans-serif;line-height:1.7;color:#0b1b3a">
        <h2 style="margin:0 0 12px">עדכון סטטוס בפרויקט איתור תשתיות</h2>
        <p><b>פרויקט:</b> ${escapeHtml(payload.projectName)}</p>
        <p><b>לקוח:</b> ${escapeHtml(payload.clientName || 'לא צוין')}</p>
        <p><b>מיקום:</b> ${escapeHtml(payload.location || 'לא צוין')}</p>
        <p><b>סטטוס קודם:</b> ${escapeHtml(payload.oldStatus || 'לא צוין')}</p>
        <p><b>סטטוס חדש:</b> ${escapeHtml(payload.newStatus)}</p>
        <p><b>עודכן על ידי:</b> ${escapeHtml(changer.full_name)} (${escapeHtml(changer.email)})</p>
        ${payload.note ? `<p><b>הערה:</b> ${escapeHtml(payload.note)}</p>` : ''}
        ${projectUrl ? `<p><a href="${escapeHtml(projectUrl)}" style="color:#0b5fff">פתיחת המערכת</a></p>` : ''}
      </div>`;

    const text = [
      'עדכון סטטוס בפרויקט איתור תשתיות',
      `פרויקט: ${payload.projectName}`,
      `לקוח: ${payload.clientName || 'לא צוין'}`,
      `מיקום: ${payload.location || 'לא צוין'}`,
      `סטטוס קודם: ${payload.oldStatus || 'לא צוין'}`,
      `סטטוס חדש: ${payload.newStatus}`,
      `עודכן על ידי: ${changer.full_name} (${changer.email})`,
      payload.note ? `הערה: ${payload.note}` : '',
      projectUrl ? `מערכת: ${projectUrl}` : ''
    ].filter(Boolean).join('\n');

    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ from: fromEmail, to: recipients, subject, html, text })
    });

    if (!resendResponse.ok) {
      const details = await resendResponse.text();
      throw new Error(`Resend error: ${details}`);
    }

    const result = await resendResponse.json();
    return new Response(JSON.stringify({ ok: true, sentTo: recipients.length, result }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
