import { createClient } from 'jsr:@supabase/supabase-js@2';
import { sendEmail, type EmailAttachment } from '../_shared/smtp.ts';
import { getStatusEmailTheme } from '../_shared/status-email-theme.ts';
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
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
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

function statusBadge(status: string | null | undefined, fallback: string) {
  const label = status || fallback;
  const theme = getStatusEmailTheme(status);
  return `<span style="display:inline-block;padding:7px 12px;border:1px solid ${theme.border};border-radius:999px;background:${theme.background};color:${theme.text};font-size:13px;font-weight:700;line-height:1.2;white-space:nowrap">${escapeHtml(label)}</span>`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !anonKey || !serviceRoleKey)
      throw new Error('Missing Supabase Edge Function secrets');

    const authHeader = req.headers.get('Authorization') || '';
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user) throw new Error('Unauthorized');

    const payload = (await req.json()) as Payload;
    if (!payload.projectId || !payload.projectName || !payload.newStatus)
      throw new Error('Missing required status payload');

    const { data: changer, error: changerError } = await adminClient
      .from('profiles')
      .select('id,email,full_name,role')
      .eq('id', userData.user.id)
      .maybeSingle();

    if (changerError) throw changerError;
    if (!changer) throw new Error('Missing changer profile');

    // Field workers and managers trigger manager email notifications.
    if (!['field_worker', 'manager'].includes(changer.role)) {
      return new Response(
        JSON.stringify({ ok: true, skipped: true, reason: 'changed_by_role_is_not_supported' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const { data: managers, error: managersError } = await adminClient
      .from('profiles')
      .select('email,full_name')
      .eq('role', 'manager')
      .not('email', 'is', null);

    if (managersError) throw managersError;

    const recipients = Array.from(
      new Set((managers || []).map((m) => m.email).filter(Boolean)),
    ) as string[];
    if (!recipients.length) {
      return new Response(
        JSON.stringify({ ok: true, skipped: true, reason: 'no_manager_emails' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
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
        const pdfBytes = await createWorkDiaryPdf(
          {
            name: payload.projectName,
            clientName: payload.clientName,
            location: payload.location,
          },
          latestDiary,
        );
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
    const newStatusTheme = getStatusEmailTheme(payload.newStatus);
    const html = `
      <div dir="rtl" style="margin:0;padding:24px 12px;background:#eef4fa;font-family:Arial,Helvetica,sans-serif;color:#10213f">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;border-collapse:collapse">
          <tr>
            <td align="center">
              <table role="presentation" width="640" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:640px;border-collapse:separate;background:#ffffff;border:1px solid #dfe8f2;border-radius:20px;overflow:hidden;box-shadow:0 14px 36px rgba(7,30,65,.10)">
                <tr><td style="height:6px;background:${newStatusTheme.accent};font-size:0;line-height:0">&nbsp;</td></tr>
                <tr>
                  <td style="padding:26px 30px;background:#0b2a55;color:#ffffff">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse:collapse">
                      <tr>
                        <td style="text-align:right">
                          <div style="font-size:12px;font-weight:700;letter-spacing:1.6px;color:#9bd8ff">MAYA TRACKER</div>
                          <h1 style="margin:7px 0 5px;font-size:25px;line-height:1.3;color:#ffffff">סטטוס הפרויקט עודכן</h1>
                          <p style="margin:0;color:#d7e8f7;font-size:14px">כל הפרטים החשובים, במקום אחד</p>
                        </td>
                        <td width="58" valign="middle" style="width:58px;text-align:left">
                          <div style="width:48px;height:48px;border-radius:15px;background:${newStatusTheme.accent};color:#ffffff;font-size:25px;font-weight:700;line-height:48px;text-align:center">✓</div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding:28px 30px 10px">
                    <div style="font-size:13px;font-weight:700;color:#64748b">פרויקט</div>
                    <h2 style="margin:4px 0 6px;color:#0b2545;font-size:23px;line-height:1.35">${escapeHtml(payload.projectName)}</h2>
                    <p style="margin:0;color:#64748b;font-size:14px">${escapeHtml(payload.clientName || 'לקוח לא צוין')} · ${escapeHtml(payload.location || 'מיקום לא צוין')}</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:16px 30px 22px">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;border-collapse:separate;border-spacing:0">
                      <tr>
                        <td width="44%" valign="middle" style="width:44%;padding:16px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:14px;text-align:center">
                          <div style="margin-bottom:9px;color:#64748b;font-size:12px;font-weight:700">סטטוס קודם</div>
                          ${statusBadge(payload.oldStatus, 'לא צוין')}
                        </td>
                        <td width="12%" valign="middle" style="width:12%;text-align:center;color:${newStatusTheme.accent};font-size:24px;font-weight:700">←</td>
                        <td width="44%" valign="middle" style="width:44%;padding:16px;background:${newStatusTheme.background};border:1px solid ${newStatusTheme.border};border-radius:14px;text-align:center">
                          <div style="margin-bottom:9px;color:${newStatusTheme.text};font-size:12px;font-weight:700">סטטוס חדש</div>
                          ${statusBadge(payload.newStatus, payload.newStatus)}
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                ${
                  awaitingDrafterAssignment
                    ? `
                <tr>
                  <td style="padding:0 30px 18px">
                    <div style="padding:15px 17px;border-right:5px solid ${newStatusTheme.accent};border-radius:12px;background:${newStatusTheme.background};color:${newStatusTheme.text};font-size:14px;line-height:1.65">
                      <b>נדרשת פעולת מנהל</b><br/>יש להיכנס למערכת ולשייך את הפרויקט לשרטט.<br/>
                      <span style="font-size:13px">תאריך תחילת ביצוע: ${escapeHtml(executionStartDate || 'לא נמצא דיווח כניסה')}</span>
                    </div>
                  </td>
                </tr>`
                    : ''
                }
                ${
                  payload.note
                    ? `
                <tr>
                  <td style="padding:0 30px 18px">
                    <div style="padding:15px 17px;border:1px solid #dbe7f1;border-radius:12px;background:#f7fbff;color:#334155;font-size:14px;line-height:1.65">
                      <div style="margin-bottom:4px;color:#0b2545;font-weight:700">הערה לעדכון</div>
                      ${escapeHtml(payload.note)}
                    </div>
                  </td>
                </tr>`
                    : ''
                }
                <tr>
                  <td style="padding:0 30px 22px">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;border-collapse:collapse;background:#ffffff;border:1px solid #e6edf4;border-radius:12px">
                      <tr>
                        <td style="padding:12px 15px;border-bottom:1px solid #edf2f7;color:#64748b;font-size:13px">עודכן על ידי</td>
                        <td style="padding:12px 15px;border-bottom:1px solid #edf2f7;text-align:left;color:#0b2545;font-size:13px;font-weight:700">${escapeHtml(changer.full_name)} · ${escapeHtml(changer.email)}</td>
                      </tr>
                      ${attachedDiaryNumber ? `<tr><td style="padding:12px 15px;color:#64748b;font-size:13px">קובץ מצורף</td><td style="padding:12px 15px;text-align:left;color:#0b2545;font-size:13px;font-weight:700">יומן עבודה ${attachedDiaryNumber} (PDF)</td></tr>` : ''}
                      ${payload.newStatus === 'הושלם' && !attachedDiaryNumber ? '<tr><td colspan="2" style="padding:12px 15px;background:#fff7ed;color:#9a3412;font-size:13px"><b>לתשומת לב:</b> לא נמצא יומן עבודה חתום לצירוף.</td></tr>' : ''}
                    </table>
                  </td>
                </tr>
                ${
                  projectUrl
                    ? `
                <tr>
                  <td align="center" style="padding:0 30px 30px">
                    <a href="${escapeHtml(projectUrl)}" style="display:inline-block;padding:13px 24px;border-radius:12px;background:#0b2a55;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none">פתיחת הפרויקט במערכת</a>
                  </td>
                </tr>`
                    : ''
                }
                <tr>
                  <td style="padding:16px 30px;background:#f7fafc;border-top:1px solid #e6edf4;text-align:center;color:#7b8aa0;font-size:11px;line-height:1.6">
                    ההודעה נשלחה אוטומטית ממערכת MAYA לניהול פרויקטי תשתיות
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </div>`;

    const text = [
      'עדכון סטטוס בפרויקט איתור תשתיות',
      `פרויקט: ${payload.projectName}`,
      `לקוח: ${payload.clientName || 'לא צוין'}`,
      `מיקום: ${payload.location || 'לא צוין'}`,
      `סטטוס קודם: ${payload.oldStatus || 'לא צוין'}`,
      `סטטוס חדש: ${payload.newStatus}`,
      awaitingDrafterAssignment
        ? `תאריך תחילת ביצוע: ${executionStartDate || 'לא נמצא דיווח כניסה'}`
        : '',
      awaitingDrafterAssignment ? 'נדרשת פעולת מנהל: יש לשייך את הפרויקט לשרטט במערכת.' : '',
      `עודכן על ידי: ${changer.full_name} (${changer.email})`,
      attachedDiaryNumber ? `מצורף: יומן עבודה ${attachedDiaryNumber} (PDF)` : '',
      payload.newStatus === 'הושלם' && !attachedDiaryNumber
        ? 'לא נמצא יומן עבודה חתום לצירוף.'
        : '',
      payload.note ? `הערה: ${payload.note}` : '',
      projectUrl ? `מערכת: ${projectUrl}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    const result = await sendEmail({
      to: recipients,
      subject,
      html,
      text,
      attachments: attachments.length ? attachments : undefined,
    });
    return new Response(
      JSON.stringify({ ok: true, sentTo: recipients.length, attachedDiaryNumber, result }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
