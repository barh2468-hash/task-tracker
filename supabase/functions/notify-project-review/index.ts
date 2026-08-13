import { createClient } from 'jsr:@supabase/supabase-js@2';

type Payload = {
  projectId: string;
  projectName: string;
  clientName?: string | null;
  location?: string | null;
  contactPhone?: string | null;
  pdfFileName?: string | null;
  pdfFilePath?: string | null;
  note?: string | null;
  changedByName?: string | null;
  changedByEmail?: string | null;
  appUrl?: string | null;
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

function uniqueEmails(rows: Array<{ email?: string | null }>) {
  return Array.from(new Set(rows.map((row) => row.email).filter(Boolean))) as string[];
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
    if (!['manager', 'drafter'].includes(requester.role)) {
      return new Response(JSON.stringify({ ok: true, skipped: true, reason: 'requester_is_not_manager_or_drafter' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const payload = await req.json() as Payload;
    if (!payload.projectId || !payload.projectName) throw new Error('Missing required review payload');

    const { data: project, error: projectError } = await adminClient
      .from('projects')
      .select('id,name,client_name,location,contact_phone,assigned_to,project_workers(worker_id)')
      .eq('id', payload.projectId)
      .maybeSingle();

    if (projectError) throw projectError;
    if (!project) throw new Error('Missing project');

    const assignedWorkerIds = Array.from(new Set([
      project.assigned_to,
      ...((project.project_workers || []) as Array<{ worker_id?: string | null }>).map((row) => row.worker_id)
    ].filter(Boolean))) as string[];

    const { data: managersAndDrafters, error: teamError } = await adminClient
      .from('profiles')
      .select('id,email,full_name,role')
      .in('role', ['manager', 'drafter']);
    if (teamError) throw teamError;

    let fieldWorkers: Array<{ id: string; email: string | null; full_name: string | null; role: string }> = [];
    if (assignedWorkerIds.length) {
      const { data: workers, error: workersError } = await adminClient
        .from('profiles')
        .select('id,email,full_name,role')
        .in('id', assignedWorkerIds);
      if (workersError) throw workersError;
      fieldWorkers = workers || [];
    }

    const recipients = uniqueEmails([...(managersAndDrafters || []), ...fieldWorkers]);
    if (!recipients.length) {
      return new Response(JSON.stringify({ ok: true, skipped: true, reason: 'no_recipient_emails' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    let pdfUrl = '';
    if (payload.pdfFilePath) {
      const { data: signed } = await adminClient.storage
        .from('project-review-files')
        .createSignedUrl(payload.pdfFilePath, 60 * 60 * 24 * 7);
      pdfUrl = signed?.signedUrl || '';
    }

    const subject = `נשלח להגהה: ${payload.projectName}`;
    const changedBy = payload.changedByName || requester.full_name || 'שרטט';
    const html = `
      <div dir="rtl" style="font-family:Arial,sans-serif;line-height:1.7;color:#0b1b3a">
        <h2 style="margin:0 0 12px">פרויקט נשלח להגהה</h2>
        <p>${escapeHtml(changedBy)} העביר את הפרויקט לסטטוס <b>נשלח להגהה</b>.</p>
        <p><b>פרויקט:</b> ${escapeHtml(payload.projectName)}</p>
        <p><b>לקוח:</b> ${escapeHtml(payload.clientName || project.client_name || 'לא צוין')}</p>
        <p><b>מיקום:</b> ${escapeHtml(payload.location || project.location || 'לא צוין')}</p>
        ${payload.contactPhone || project.contact_phone ? `<p><b>טלפון איש קשר:</b> ${escapeHtml(payload.contactPhone || project.contact_phone)}</p>` : ''}
        ${payload.pdfFileName ? `<p><b>PDF:</b> ${escapeHtml(payload.pdfFileName)}</p>` : ''}
        ${pdfUrl ? `<p><a href="${escapeHtml(pdfUrl)}" style="color:#0b5fff">פתיחת קובץ ההגהה</a></p>` : ''}
        ${payload.note ? `<p><b>הערה:</b> ${escapeHtml(payload.note)}</p>` : ''}
        ${payload.appUrl ? `<p><a href="${escapeHtml(payload.appUrl)}" style="color:#0b5fff">פתיחת המערכת</a></p>` : ''}
      </div>`;

    const text = [
      'פרויקט נשלח להגהה',
      `פרויקט: ${payload.projectName}`,
      `לקוח: ${payload.clientName || project.client_name || 'לא צוין'}`,
      `מיקום: ${payload.location || project.location || 'לא צוין'}`,
      `הועבר על ידי: ${changedBy}`,
      payload.pdfFileName ? `PDF: ${payload.pdfFileName}` : '',
      pdfUrl ? `קובץ הגהה: ${pdfUrl}` : '',
      payload.note ? `הערה: ${payload.note}` : '',
      payload.appUrl ? `מערכת: ${payload.appUrl}` : ''
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
    return new Response(JSON.stringify({ ok: true, sentTo: recipients.length, recipients, result }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
