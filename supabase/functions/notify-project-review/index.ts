import { createClient } from 'jsr:@supabase/supabase-js@2';
import { sendEmail } from '../_shared/smtp.ts';
import { getStatusEmailTheme } from '../_shared/status-email-theme.ts';
import {
  escapeHtml,
  executionStartLine,
  getExecutionStartDate,
  highlightBlock,
  noteBlock,
  renderProjectEmail,
} from '../_shared/project-email.ts';

type Payload = {
  projectId: string;
  projectName: string;
  clientName?: string | null;
  location?: string | null;
  contactPhone?: string | null;
  pdfFileName?: string | null;
  pdfFilePath?: string | null;
  pdfFiles?: Array<{ name: string; path: string }> | null;
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

function uniqueEmails(rows: Array<{ email?: string | null }>) {
  return Array.from(new Set(rows.map((row) => row.email).filter(Boolean))) as string[];
}

function isDrafterCandidate(profile: { role?: string | null; full_name?: string | null }) {
  if (profile.role === 'demo') return false;
  if (profile.role === 'drafter') return true;
  return /(^|\s)(דודי|dudi|dudy)(\s|$)/i.test(String(profile.full_name || '').trim());
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
    if (!supabaseUrl || !anonKey || !serviceRoleKey) throw new Error('Missing Supabase Edge Function secrets');

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
    const requesterIsManager = ['manager', 'admin'].includes(requester.role);
    const requesterIsDrafter = isDrafterCandidate(requester);
    if (!requesterIsManager && !requesterIsDrafter) {
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

    if (requesterIsDrafter && !requesterIsManager && !assignedWorkerIds.includes(requester.id)) {
      return new Response(JSON.stringify({ error: 'Drafter is not assigned to this project' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { data: managers, error: managersError } = await adminClient
      .from('profiles')
      .select('id,email,full_name,role')
      .in('role', ['manager', 'admin']);
    if (managersError) throw managersError;

    let assignedRecipients: Array<{ id: string; email: string | null; full_name: string | null; role: string }> = [];
    if (assignedWorkerIds.length) {
      const { data: workers, error: workersError } = await adminClient
        .from('profiles')
        .select('id,email,full_name,role')
        .in('id', assignedWorkerIds);
      if (workersError) throw workersError;
      assignedRecipients = workers || [];
    }

    // Managers receive system-wide review mail. Every other recipient, including
    // drafters, must be explicitly assigned to this project.
    const recipients = uniqueEmails([...(managers || []), ...assignedRecipients]);
    if (!recipients.length) {
      return new Response(JSON.stringify({ ok: true, skipped: true, reason: 'no_recipient_emails' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const reviewFiles = payload.pdfFiles?.length
      ? payload.pdfFiles.filter((file) => file?.name && file?.path)
      : payload.pdfFileName && payload.pdfFilePath
        ? [{ name: payload.pdfFileName, path: payload.pdfFilePath }]
        : [];
    const reviewFileLinks: Array<{ name: string; url: string }> = [];
    for (const file of reviewFiles) {
      const { data: signed } = await adminClient.storage
        .from('project-review-files')
        .createSignedUrl(file.path, 60 * 60 * 24 * 7);
      reviewFileLinks.push({ name: file.name, url: signed?.signedUrl || '' });
    }

    const htmlFileLinks = reviewFileLinks
      .map(
        (file) =>
          `<div style="padding:3px 0">📄 ${
            file.url
              ? `<a href="${escapeHtml(file.url)}" style="color:#0b5fff;font-weight:700;text-decoration:none">${escapeHtml(file.name)}</a>`
              : escapeHtml(file.name)
          }</div>`,
      )
      .join('');

    const subject = `נשלח להגהה: ${payload.projectName}`;
    const changedBy = payload.changedByName || requester.full_name || 'שרטט';
    const clientName = payload.clientName || project.client_name;
    const location = payload.location || project.location;
    const contactPhone = payload.contactPhone || project.contact_phone;
    const executionStartDate = await getExecutionStartDate(adminClient, payload.projectId);
    const theme = getStatusEmailTheme('נשלח להגהה');

    const html = renderProjectEmail({
      theme,
      title: 'פרויקט נשלח להגהה',
      projectName: payload.projectName,
      clientName,
      location,
      blocks: [
        highlightBlock(
          theme,
          `<b>${escapeHtml(changedBy)} העביר את הפרויקט לסטטוס נשלח להגהה</b><br/>
                      <span style="font-size:13px">${escapeHtml(executionStartLine(executionStartDate))}</span>`,
        ),
        htmlFileLinks ? noteBlock('קובצי PDF להגהה', htmlFileLinks) : '',
        payload.note ? noteBlock('הערה', escapeHtml(payload.note)) : '',
      ],
      details: [
        { label: 'הועבר על ידי', value: payload.changedByEmail ? `${changedBy} · ${payload.changedByEmail}` : changedBy },
        ...(contactPhone ? [{ label: 'טלפון איש קשר', value: contactPhone }] : []),
      ],
      appUrl: payload.appUrl,
    });

    const text = [
      'פרויקט נשלח להגהה',
      `פרויקט: ${payload.projectName}`,
      `לקוח: ${clientName || 'לא צוין'}`,
      `מיקום: ${location || 'לא צוין'}`,
      executionStartLine(executionStartDate),
      contactPhone ? `טלפון איש קשר: ${contactPhone}` : '',
      `הועבר על ידי: ${changedBy}`,
      ...reviewFileLinks.map((file) => `PDF: ${file.name}${file.url ? ` — ${file.url}` : ''}`),
      payload.note ? `הערה: ${payload.note}` : '',
      payload.appUrl ? `מערכת: ${payload.appUrl}` : ''
    ].filter(Boolean).join('\n');

    const result = await sendEmail({ to: recipients, subject, html, text });
    return new Response(JSON.stringify({ ok: true, sentTo: recipients.length, recipients, result }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
