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
    if (!['manager', 'admin'].includes(requester.role)) {
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
    if (worker.role === 'demo') {
      return new Response(JSON.stringify({ ok: true, skipped: true, reason: 'demo_has_showcase_access_only' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    if (!worker.email) {
      return new Response(JSON.stringify({ ok: true, skipped: true, reason: 'worker_has_no_email' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const isDrafterAssignment = worker.role === 'drafter';
    const title = isDrafterAssignment ? 'שויך אליך פרויקט לשרטוט' : 'שויך אליך פרויקט חדש';
    const subject = `${title}: ${payload.projectName}`;
    const assignedBy = payload.assignedByName || requester.full_name || 'מנהל מערכת';
    const executionStartDate = isDrafterAssignment
      ? await getExecutionStartDate(adminClient, payload.projectId)
      : null;
    const theme = getStatusEmailTheme(isDrafterAssignment ? 'עבר לשרטוט' : 'בעבודה בשטח');

    const html = renderProjectEmail({
      theme,
      title,
      projectName: payload.projectName,
      clientName: payload.clientName,
      location: payload.location,
      blocks: [
        highlightBlock(
          theme,
          `<b>שלום ${escapeHtml(worker.full_name || worker.email)}</b><br/>
                      ${escapeHtml(assignedBy)} שייך אליך ${isDrafterAssignment ? 'פרויקט לטיפול בשרטוט' : 'פרויקט'} במערכת איתור התשתיות.
                      ${isDrafterAssignment ? `<br/><span style="font-size:13px">${escapeHtml(executionStartLine(executionStartDate))}</span>` : ''}`,
        ),
        payload.description ? noteBlock('תיאור הפרויקט', escapeHtml(payload.description)) : '',
      ],
      details: [
        { label: 'שויך על ידי', value: requester.email ? `${assignedBy} · ${requester.email}` : assignedBy },
        ...(payload.dueDate ? [{ label: 'תאריך יעד', value: payload.dueDate }] : []),
      ],
      appUrl: payload.appUrl,
    });

    const text = [
      title,
      `פרויקט: ${payload.projectName}`,
      `לקוח: ${payload.clientName || 'לא צוין'}`,
      `מיקום: ${payload.location || 'לא צוין'}`,
      isDrafterAssignment ? executionStartLine(executionStartDate) : '',
      payload.description ? `תיאור: ${payload.description}` : '',
      `שויך על ידי: ${assignedBy}`,
      payload.dueDate ? `תאריך יעד: ${payload.dueDate}` : '',
      payload.appUrl ? `מערכת: ${payload.appUrl}` : ''
    ].filter(Boolean).join('\n');

    const result = await sendEmail({ to: [worker.email], subject, html, text });
    return new Response(JSON.stringify({ ok: true, sentTo: 1, workerEmail: worker.email, result }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
