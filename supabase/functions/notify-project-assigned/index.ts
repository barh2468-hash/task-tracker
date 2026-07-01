import { createClient } from 'jsr:@supabase/supabase-js@2';

type Payload = {
  workerId: string;
  projectId: string;
  projectName: string;
  clientName?: string | null;
  location?: string | null;
  description?: string | null;
  dueDate?: string | null;
  assignedByName?: string | null;
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
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    const fromEmail = Deno.env.get('FROM_EMAIL') || 'MAYA Tasks <onboarding@resend.dev>';

    if (!supabaseUrl || !anonKey || !serviceRoleKey) throw new Error('Missing Supabase Edge Function secrets');
    if (!resendApiKey) throw new Error('Missing RESEND_API_KEY secret');

    const authHeader = req.headers.get('Authorization') || '';
    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user) throw new Error('Unauthorized');

    const { data: requester, error: requesterError } = await adminClient
      .from('profiles')
      .select('id,email,full_name,role')
      .eq('id', userData.user.id)
      .maybeSingle();

    if (requesterError) throw requesterError;
    if (!requester) throw new Error('Missing requester profile');
    if (requester.role !== 'manager') {
      return new Response(JSON.stringify({ ok: true, skipped: true, reason: 'requester_is_not_manager' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const payload = await req.json() as Payload;
    if (!payload.workerId || !payload.projectId || !payload.projectName) throw new Error('Missing required assignment payload');

    const { data: worker, error: workerError } = await adminClient
      .from('profiles')
      .select('id,email,full_name,role')
      .eq('id', payload.workerId)
      .maybeSingle();

    if (workerError) throw workerError;
    if (!worker) throw new Error('Missing worker profile');
    if (!worker.email) {
      return new Response(JSON.stringify({ ok: true, skipped: true, reason: 'worker_has_no_email' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const subject = `שויך אליך פרויקט חדש: ${payload.projectName}`;
    const assignedBy = payload.assignedByName || requester.full_name || 'מנהל מערכת';
    const html = `
      <div dir="rtl" style="font-family:Arial,sans-serif;line-height:1.7;color:#0b1b3a">
        <h2 style="margin:0 0 12px">שויך אליך פרויקט חדש</h2>
        <p>שלום ${escapeHtml(worker.full_name || worker.email)},</p>
        <p>מנהל המערכת ${escapeHtml(assignedBy)} שייך אליך פרויקט במערכת איתור התשתיות.</p>
        <p><b>פרויקט:</b> ${escapeHtml(payload.projectName)}</p>
        <p><b>לקוח:</b> ${escapeHtml(payload.clientName || 'לא צוין')}</p>
        <p><b>מיקום:</b> ${escapeHtml(payload.location || 'לא צוין')}</p>
        ${payload.description ? `<p><b>תיאור:</b> ${escapeHtml(payload.description)}</p>` : ''}
        ${payload.dueDate ? `<p><b>תאריך יעד:</b> ${escapeHtml(payload.dueDate)}</p>` : ''}
        ${payload.appUrl ? `<p><a href="${escapeHtml(payload.appUrl)}" style="color:#0b5fff">פתיחת המערכת</a></p>` : ''}
      </div>`;

    const text = [
      'שויך אליך פרויקט חדש',
      `פרויקט: ${payload.projectName}`,
      `לקוח: ${payload.clientName || 'לא צוין'}`,
      `מיקום: ${payload.location || 'לא צוין'}`,
      payload.description ? `תיאור: ${payload.description}` : '',
      payload.dueDate ? `תאריך יעד: ${payload.dueDate}` : '',
      payload.appUrl ? `מערכת: ${payload.appUrl}` : ''
    ].filter(Boolean).join('\n');

    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ from: fromEmail, to: [worker.email], subject, html, text })
    });

    if (!resendResponse.ok) {
      const details = await resendResponse.text();
      throw new Error(`Resend error: ${details}`);
    }

    const result = await resendResponse.json();
    return new Response(JSON.stringify({ ok: true, sentTo: 1, workerEmail: worker.email, result }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
