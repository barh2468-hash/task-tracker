import { createClient } from 'jsr:@supabase/supabase-js@2';

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
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    const fromEmail = Deno.env.get('FROM_EMAIL');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!resendApiKey || !fromEmail || !supabaseUrl || !anonKey || !serviceRoleKey) {
      throw new Error(
        'Missing RESEND_API_KEY, FROM_EMAIL, SUPABASE_URL, SUPABASE_ANON_KEY or SUPABASE_SERVICE_ROLE_KEY',
      );
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
            <div><span style="color:#64748b">קודם:</span> ${escapeHtml(change.old_status)}</div>
            <div><span style="color:#64748b">חדש:</span> <b>${escapeHtml(change.new_status)}</b></div>
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
      <div dir="rtl" style="font-family:Arial,sans-serif;line-height:1.6;color:#0b2545;max-width:1000px;margin:auto">
        ${previewManagerEmail ? '<div style="background:#fff7ed;border:1px solid #fdba74;color:#9a3412;border-radius:10px;padding:10px 14px;margin-bottom:16px"><b>מייל דוגמה</b> – זוהי תצוגה מקדימה של הסיכום היומי.</div>' : ''}
        <h2 style="margin:0 0 8px">סיכום שינויי סטטוס</h2>
        <p style="margin:0 0 18px;color:#475569">השינויים שבוצעו במערכת במהלך 24 השעות האחרונות.</p>
        <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:12px;padding:12px 16px;margin-bottom:18px">
          <b>טווח הדוח:</b> ${escapeHtml(rangeLabel)}<br/>
          <b>מספר שינויים:</b> ${changes.length}
        </div>
        ${
          changes.length
            ? `
          <div style="overflow-x:auto">
            <table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;font-size:14px">
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
            : '<p style="padding:18px;background:#f8fafc;border-radius:12px">לא בוצעו שינויי סטטוס במהלך 24 השעות האחרונות.</p>'
        }
        ${appUrl ? `<p style="margin-top:20px"><a href="${escapeHtml(appUrl)}" style="color:#0b5fff">פתיחת המערכת</a></p>` : ''}
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

    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: fromEmail, to: recipients, subject, html, text }),
    });
    if (!resendResponse.ok) {
      throw new Error(`Resend error: ${await resendResponse.text()}`);
    }

    const result = await resendResponse.json();
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
