import { createClient } from 'jsr:@supabase/supabase-js@2';
import { sendEmail } from '../_shared/smtp.ts';
import { getStatusEmailTheme } from '../_shared/status-email-theme.ts';

const ISRAEL_TIME_ZONE = 'Asia/Jerusalem';
const DAY_IN_MS = 24 * 60 * 60 * 1000;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-cron-secret',
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

async function requireManagerOrCron(req: Request, supabaseUrl: string, anonKey: string) {
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

function formatIsraelDateTime(value: Date | string) {
  return new Intl.DateTimeFormat('he-IL', {
    timeZone: ISRAEL_TIME_ZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(value));
}

function statusBadge(status: string | null | undefined, fallback = 'לא צוין') {
  const label = status || fallback;
  const theme = getStatusEmailTheme(status);
  return `<span style="display:inline-block;padding:5px 9px;border:1px solid ${theme.border};border-radius:999px;background:${theme.background};color:${theme.text};font-size:12px;font-weight:700;line-height:1.2;white-space:nowrap">${escapeHtml(label)}</span>`;
}

function israelTimeParts(value: Date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: ISRAEL_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(value);
  return Object.fromEntries(parts.map((part) => [part.type, part.value]));
}

function isScheduledIsraelTime(value: Date) {
  const parts = israelTimeParts(value);
  return parts.hour === '17' && parts.minute === '00';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') {
    return Response.json(
      { error: 'Method not allowed' },
      {
        status: 405,
        headers: corsHeaders,
      },
    );
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      throw new Error('Missing SUPABASE_URL, SUPABASE_ANON_KEY or SUPABASE_SERVICE_ROLE_KEY');
    }

    const cronRequest = isAuthorizedCronRequest(req);
    await requireManagerOrCron(req, supabaseUrl, anonKey);

    const body = await req.json().catch(() => ({}));
    const previewRecipient =
      typeof body?.previewRecipient === 'string'
        ? body.previewRecipient.trim().toLocaleLowerCase('en-US')
        : '';
    const now = new Date();
    if (cronRequest && !previewRecipient && !isScheduledIsraelTime(now)) {
      return Response.json(
        { ok: true, skipped: true, reason: 'outside_17_00_israel' },
        {
          headers: corsHeaders,
        },
      );
    }

    const requestedAppUrl = typeof body?.appUrl === 'string' ? body.appUrl.trim() : '';
    const appUrl = /^https?:\/\//i.test(requestedAppUrl) ? requestedAppUrl : '';
    const windowEnd = now;
    const windowStart = new Date(windowEnd.getTime() - DAY_IN_MS);
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const [{ data: managers, error: managersError }, { data: history, error: historyError }] =
      await Promise.all([
        supabase.from('profiles').select('email').eq('role', 'manager').not('email', 'is', null),
        supabase
          .from('status_history')
          .select(
            'old_status,new_status,note,created_at,profiles:changed_by(full_name),projects:project_id(name,client_name,location)',
          )
          .not('old_status', 'is', null)
          .gte('created_at', windowStart.toISOString())
          .lt('created_at', windowEnd.toISOString())
          .order('created_at', { ascending: false }),
      ]);

    if (managersError) throw managersError;
    if (historyError) throw historyError;

    const managerRecipients = Array.from(
      new Set((managers || []).map((manager: any) => manager.email).filter(Boolean)),
    ) as string[];
    const previewManagerEmail = previewRecipient
      ? managerRecipients.find((email) => email.toLocaleLowerCase('en-US') === previewRecipient)
      : '';
    if (previewRecipient && !previewManagerEmail) {
      throw new HttpError(400, 'Preview recipient must be a manager email');
    }
    const recipients = previewManagerEmail ? [previewManagerEmail] : managerRecipients;
    if (!recipients.length) {
      return Response.json(
        { ok: true, sentTo: 0, reason: 'no_manager_emails' },
        {
          headers: corsHeaders,
        },
      );
    }

    const changes = history || [];
    const tableRows = changes
      .map((change: any) => {
        const projectName = change.projects?.name || 'פרויקט ללא שם';
        const projectDetails = [change.projects?.client_name, change.projects?.location]
          .filter(Boolean)
          .join(' · ');
        return `
        <tr>
          <td style="padding:12px;border-bottom:1px solid #e5e7eb;vertical-align:top">
            <b>${escapeHtml(projectName)}</b>
            ${projectDetails ? `<div style="color:#64748b;font-size:12px">${escapeHtml(projectDetails)}</div>` : ''}
          </td>
          <td style="padding:12px;border-bottom:1px solid #e5e7eb;vertical-align:top">
            <div style="margin-bottom:7px"><span style="display:inline-block;width:38px;color:#64748b;font-size:12px">קודם:</span> ${statusBadge(change.old_status)}</div>
            <div><span style="display:inline-block;width:38px;color:#64748b;font-size:12px">חדש:</span> ${statusBadge(change.new_status)}</div>
          </td>
          <td style="padding:12px;border-bottom:1px solid #e5e7eb;vertical-align:top">
            ${escapeHtml(change.profiles?.full_name || 'משתמש')}
          </td>
          <td style="padding:12px;border-bottom:1px solid #e5e7eb;vertical-align:top;white-space:nowrap">
            ${escapeHtml(formatIsraelDateTime(change.created_at))}
          </td>
          <td style="padding:12px;border-bottom:1px solid #e5e7eb;vertical-align:top">
            ${escapeHtml(change.note || '—')}
          </td>
        </tr>`;
      })
      .join('');

    const rangeLabel = `${formatIsraelDateTime(windowStart)} עד ${formatIsraelDateTime(windowEnd)}`;
    const subjectPrefix = previewManagerEmail ? '[דוגמה] ' : '';
    const subject = `${subjectPrefix}סיכום שינויי סטטוס – 24 השעות האחרונות – ${new Intl.DateTimeFormat(
      'he-IL',
      {
        timeZone: ISRAEL_TIME_ZONE,
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      },
    ).format(now)}`;
    const html = `
      <div dir="rtl" style="margin:0;padding:24px 12px;background:#eef4fa;font-family:Arial,Helvetica,sans-serif;line-height:1.6;color:#0b2545">
        <div style="max-width:960px;margin:auto;background:#ffffff;border:1px solid #dfe8f2;border-radius:20px;overflow:hidden;box-shadow:0 14px 36px rgba(7,30,65,.10)">
          <div style="height:6px;background:#258fc4;font-size:0;line-height:0">&nbsp;</div>
          <div style="padding:25px 28px;background:#0b2a55;color:#ffffff">
            <div style="font-size:12px;font-weight:700;letter-spacing:1.6px;color:#9bd8ff">MAYA TRACKER</div>
            <h2 style="margin:6px 0 5px;color:#ffffff;font-size:25px">סיכום שינויי סטטוס</h2>
            <p style="margin:0;color:#d7e8f7;font-size:14px">24 השעות האחרונות בפרויקטים שלך</p>
          </div>
          <div style="padding:24px 28px">
            ${previewManagerEmail ? '<div style="background:#fff7ed;border:1px solid #fdba74;color:#9a3412;border-radius:10px;padding:10px 14px;margin-bottom:16px"><b>מייל דוגמה</b> – זוהי תצוגה מקדימה של הסיכום היומי.</div>' : ''}
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;border-collapse:separate;background:#eff6ff;border:1px solid #bfdbfe;border-radius:12px;margin-bottom:18px">
              <tr>
                <td style="padding:13px 16px;color:#475569;font-size:13px"><b style="color:#0b2545">טווח הדוח</b><br/>${escapeHtml(rangeLabel)}</td>
                <td width="150" style="width:150px;padding:13px 16px;border-right:1px solid #bfdbfe;text-align:center"><span style="display:block;color:#64748b;font-size:12px">מספר שינויים</span><b style="display:block;color:#0b5f9a;font-size:24px">${changes.length}</b></td>
              </tr>
            </table>
            ${
              changes.length
                ? `
            <div style="overflow-x:auto;border:1px solid #dfe7f1;border-radius:12px">
              <table style="width:100%;border-collapse:collapse;font-size:14px">
                <thead style="background:#0b2545;color:white">
                <tr>
                  <th style="padding:11px;text-align:right">פרויקט</th>
                  <th style="padding:11px;text-align:right">שינוי סטטוס</th>
                  <th style="padding:11px;text-align:right">עודכן על ידי</th>
                  <th style="padding:11px;text-align:right">מועד</th>
                  <th style="padding:11px;text-align:right">הערה</th>
                </tr>
                </thead>
                <tbody>${tableRows}</tbody>
              </table>
            </div>`
                : '<p style="padding:18px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;text-align:center;color:#64748b">לא בוצעו שינויי סטטוס במהלך 24 השעות האחרונות.</p>'
            }
            ${appUrl ? `<p style="margin:22px 0 4px;text-align:center"><a href="${escapeHtml(appUrl)}" style="display:inline-block;padding:12px 22px;border-radius:11px;background:#0b2a55;color:#ffffff;font-weight:700;text-decoration:none">פתיחת המערכת</a></p>` : ''}
          </div>
          <div style="padding:15px 28px;background:#f7fafc;border-top:1px solid #e6edf4;text-align:center;color:#7b8aa0;font-size:11px">ההודעה נשלחה אוטומטית ממערכת MAYA לניהול פרויקטי תשתיות</div>
        </div>
      </div>`;

    const textRows = changes
      .map((change: any) =>
        [
          `${change.projects?.name || 'פרויקט ללא שם'}`,
          `סטטוס קודם: ${change.old_status}`,
          `סטטוס חדש: ${change.new_status}`,
          `עודכן על ידי: ${change.profiles?.full_name || 'משתמש'}`,
          `מועד: ${formatIsraelDateTime(change.created_at)}`,
          change.note ? `הערה: ${change.note}` : '',
        ]
          .filter(Boolean)
          .join('\n'),
      )
      .join('\n\n');
    const text = [
      previewManagerEmail ? 'מייל דוגמה – תצוגה מקדימה של הסיכום היומי' : '',
      'סיכום שינויי סטטוס – 24 השעות האחרונות',
      `טווח: ${rangeLabel}`,
      `מספר שינויים: ${changes.length}`,
      textRows || 'לא בוצעו שינויי סטטוס במהלך 24 השעות האחרונות.',
      appUrl ? `מערכת: ${appUrl}` : '',
    ]
      .filter(Boolean)
      .join('\n\n');

    const result = await sendEmail({ to: recipients, subject, html, text });
    return Response.json(
      {
        ok: true,
        sentTo: recipients.length,
        changeCount: changes.length,
        windowStart: windowStart.toISOString(),
        windowEnd: windowEnd.toISOString(),
        preview: Boolean(previewManagerEmail),
        result,
      },
      { headers: corsHeaders },
    );
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500;
    if (!(error instanceof HttpError)) console.error('Daily status summary failed:', error);
    const message = error instanceof HttpError ? error.message : 'Internal server error';
    return Response.json({ error: message }, { status, headers: corsHeaders });
  }
});
