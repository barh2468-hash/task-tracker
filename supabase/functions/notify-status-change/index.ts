import { createClient } from 'jsr:@supabase/supabase-js@2';
import { sendEmail, type EmailAttachment } from '../_shared/smtp.ts';
import { createWorkDiaryPdf } from './work-diary-pdf.ts';

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

function bytesToBase64(bytes: Uint8Array) {
  let binary = '';
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}

function formatIsraelDate(value: string) {
  return new Intl.DateTimeFormat('he-IL', {
    timeZone: 'Asia/Jerusalem',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(value));
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
    if (!supabaseUrl || !anonKey || !serviceRoleKey) throw new Error('Missing Supabase Edge Function secrets');

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

    // Field workers and managers trigger manager email notifications.
    if (!['field_worker', 'manager'].includes(changer.role)) {
      return new Response(JSON.stringify({ ok: true, skipped: true, reason: 'changed_by_role_is_not_supported' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
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

    const awaitingDrafterAssignment = payload.newStatus === 'עבר לשרטוט';
    let executionStartDate: string | null = null;
    if (awaitingDrafterAssignment) {
      const { data: firstWorkSession, error: firstWorkSessionError } = await adminClient
        .from('work_sessions')
        .select('started_at')
        .eq('project_id', payload.projectId)
        .order('started_at', { ascending: true })
        .limit(1)
        .maybeSingle();
      if (firstWorkSessionError) throw firstWorkSessionError;
      if (firstWorkSession?.started_at) {
        executionStartDate = formatIsraelDate(firstWorkSession.started_at);
      }
    }

    let attachedDiaryNumber: number | null = null;
    const attachments: EmailAttachment[] = [];
    if (payload.newStatus === 'הושלם') {
      const { data: latestDiary, error: diaryError } = await adminClient
        .from('work_diaries')
        .select('diary_number,form_data,customer_signature,team_lead_signature,signed_at')
        .eq('project_id', payload.projectId)
        .order('diary_number', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (diaryError) throw diaryError;
      if (latestDiary) {
        const pdfBytes = await createWorkDiaryPdf({
          name: payload.projectName,
          clientName: payload.clientName,
          location: payload.location,
        }, latestDiary);
        attachedDiaryNumber = latestDiary.diary_number;
        attachments.push({
          filename: `work-diary-${latestDiary.diary_number}.pdf`,
          content: bytesToBase64(pdfBytes),
          contentType: 'application/pdf',
          encoding: 'base64',
        });
      }
    }

    const subject = awaitingDrafterAssignment
      ? `ממתין לשיוך שרטט: ${payload.projectName}`
      : `עדכון סטטוס: ${payload.projectName} → ${payload.newStatus}`;
    const projectUrl = payload.appUrl ? `${payload.appUrl}` : '';
    const html = `
      <div dir="rtl" style="font-family:Arial,sans-serif;line-height:1.7;color:#0b1b3a">
        <h2 style="margin:0 0 12px">עדכון סטטוס בפרויקט איתור תשתיות</h2>
        <p><b>פרויקט:</b> ${escapeHtml(payload.projectName)}</p>
        <p><b>לקוח:</b> ${escapeHtml(payload.clientName || 'לא צוין')}</p>
        <p><b>מיקום:</b> ${escapeHtml(payload.location || 'לא צוין')}</p>
        <p><b>סטטוס קודם:</b> ${escapeHtml(payload.oldStatus || 'לא צוין')}</p>
        <p><b>סטטוס חדש:</b> ${escapeHtml(payload.newStatus)}</p>
        ${awaitingDrafterAssignment ? `<p><b>תאריך תחילת ביצוע:</b> ${escapeHtml(executionStartDate || 'לא נמצא דיווח כניסה')}</p>` : ''}
        ${awaitingDrafterAssignment ? '<p style="padding:12px;border-radius:10px;background:#f3edff;color:#4c1d95"><b>נדרשת פעולת מנהל:</b> יש להיכנס למערכת ולשייך את הפרויקט לשרטט.</p>' : ''}
        <p><b>עודכן על ידי:</b> ${escapeHtml(changer.full_name)} (${escapeHtml(changer.email)})</p>
        ${attachedDiaryNumber ? `<p><b>מצורף:</b> יומן עבודה ${attachedDiaryNumber} (PDF)</p>` : ''}
        ${payload.newStatus === 'הושלם' && !attachedDiaryNumber ? '<p><b>לתשומת לב:</b> לא נמצא יומן עבודה חתום לצירוף.</p>' : ''}
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
      awaitingDrafterAssignment ? `תאריך תחילת ביצוע: ${executionStartDate || 'לא נמצא דיווח כניסה'}` : '',
      awaitingDrafterAssignment ? 'נדרשת פעולת מנהל: יש לשייך את הפרויקט לשרטט במערכת.' : '',
      `עודכן על ידי: ${changer.full_name} (${changer.email})`,
      attachedDiaryNumber ? `מצורף: יומן עבודה ${attachedDiaryNumber} (PDF)` : '',
      payload.newStatus === 'הושלם' && !attachedDiaryNumber ? 'לא נמצא יומן עבודה חתום לצירוף.' : '',
      payload.note ? `הערה: ${payload.note}` : '',
      projectUrl ? `מערכת: ${projectUrl}` : ''
    ].filter(Boolean).join('\n');

    const result = await sendEmail({
      to: recipients,
      subject,
      html,
      text,
      attachments: attachments.length ? attachments : undefined,
    });
    return new Response(JSON.stringify({ ok: true, sentTo: recipients.length, attachedDiaryNumber, result }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
