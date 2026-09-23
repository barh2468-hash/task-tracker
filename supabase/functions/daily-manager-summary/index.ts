import { createClient } from 'jsr:@supabase/supabase-js@2';
import { sendEmail } from '../_shared/smtp.ts';
import {
  buildDailyInsights,
  durationInMinutes,
  formatDateTime,
  formatDuration,
  formatReportDate,
  getDayBounds,
  getHourInTimeZone,
} from './report.js';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-cron-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const jsonHeaders = { ...corsHeaders, 'Content-Type': 'application/json' };

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
  if (!authHeader.toLowerCase().startsWith('bearer ')) throw new HttpError(401, 'Unauthorized');

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

function safeAppUrl(value: unknown) {
  try {
    const url = new URL(String(value || ''));
    return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
  } catch {
    return '';
  }
}

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: jsonHeaders });
}

function optionalTableUnavailable(error: any) {
  return (
    ['PGRST200', 'PGRST205', '42P01', '42703'].includes(error?.code) ||
    /field_equipment/i.test(error?.message || '')
  );
}

const tableStyle = 'width:100%;border-collapse:collapse;border:1px solid #d8e4ec;font-size:13px';
const headerStyle = 'background:#0b2b53;color:#fff;text-align:right';
const cellStyle = 'padding:9px;border-bottom:1px solid #e4ebf1;vertical-align:top';

function metricCard(label: string, value: number, color = '#0b2b53') {
  return `<td style="width:25%;padding:6px"><div style="border:1px solid #d8e4ec;border-radius:12px;padding:14px;background:#fff"><div style="font-size:25px;font-weight:800;color:${color}">${value}</div><div style="font-size:12px;color:#64748b">${escapeHtml(label)}</div></div></td>`;
}

function renderActionRows(actions: any[]) {
  const severity = {
    high: { label: 'דחוף', background: '#fee2e2', color: '#b42318' },
    medium: { label: 'לטיפול', background: '#fff7df', color: '#a15c00' },
    low: { label: 'לבדיקה', background: '#eaf4f8', color: '#155e8b' },
  } as const;
  return actions
    .slice(0, 12)
    .map((action) => {
      const style = severity[action.severity as keyof typeof severity] || severity.low;
      return `<tr><td style="${cellStyle};width:78px"><span style="display:inline-block;padding:3px 8px;border-radius:999px;background:${style.background};color:${style.color};font-weight:700">${style.label}</span></td><td style="${cellStyle};width:80px">${escapeHtml(action.category)}</td><td style="${cellStyle}"><b>${escapeHtml(action.title)}</b><br/><span style="color:#64748b">${escapeHtml(action.detail)}</span></td></tr>`;
    })
    .join('');
}

function renderEmail({
  now,
  appUrl,
  sessions,
  attendance,
  history,
  insights,
}: {
  now: Date;
  appUrl: string;
  sessions: any[];
  attendance: any[];
  history: any[];
  insights: any;
}) {
  const typeLabels: Record<string, string> = {
    field: 'עבודה בשטח',
    office: 'משרד',
    vacation: 'חופש',
    sick: 'מחלה',
    reserve_duty: 'מילואים',
  };
  const actionRows = renderActionRows(insights.actions);
  const hiddenActions = Math.max(0, insights.actions.length - 12);
  const notReportedRows = insights.notReportedWorkers
    .map(
      (worker: any) =>
        `<tr><td style="${cellStyle}"><b>${escapeHtml(worker.full_name)}</b></td><td style="${cellStyle}">${escapeHtml(worker.email || '—')}</td></tr>`,
    )
    .join('');
  const attendanceRows = attendance
    .map((entry: any) => {
      const typeLabel = typeLabels[entry.attendance_type] || 'נוכחות כללית';
      if (entry.is_all_day) {
        return `<tr><td style="${cellStyle}">${escapeHtml(entry.profiles?.full_name || 'עובד')}</td><td style="${cellStyle}">${escapeHtml(typeLabel)}</td><td style="${cellStyle}" colspan="3">דיווח יומי ללא שעות</td><td style="${cellStyle}">${escapeHtml(entry.end_note || '—')}</td></tr>`;
      }
      const minutes = durationInMinutes(entry.started_at, entry.ended_at, now);
      return `<tr><td style="${cellStyle}">${escapeHtml(entry.profiles?.full_name || 'עובד')}</td><td style="${cellStyle}">${escapeHtml(typeLabel)}</td><td style="${cellStyle}">${escapeHtml(formatDateTime(entry.started_at))}</td><td style="${cellStyle}">${entry.ended_at ? escapeHtml(formatDateTime(entry.ended_at)) : '<b style="color:#b42318">פתוח</b>'}</td><td style="${cellStyle}">${escapeHtml(formatDuration(minutes))}</td><td style="${cellStyle}">${escapeHtml(entry.end_note || '—')}</td></tr>`;
    })
    .join('');
  const sessionRows = sessions
    .map((session: any) => {
      const minutes = durationInMinutes(session.started_at, session.ended_at, now);
      return `<tr><td style="${cellStyle}">${escapeHtml(session.profiles?.full_name || 'עובד')}</td><td style="${cellStyle}"><b>${escapeHtml(session.projects?.name || 'פרויקט')}</b><br/><span style="color:#64748b">${escapeHtml(session.projects?.location || '')}</span></td><td style="${cellStyle}">${escapeHtml(formatDateTime(session.started_at))}</td><td style="${cellStyle}">${session.ended_at ? escapeHtml(formatDateTime(session.ended_at)) : '<b style="color:#b42318">פתוח</b>'}</td><td style="${cellStyle}">${escapeHtml(formatDuration(minutes))}</td><td style="${cellStyle}">${escapeHtml(session.end_note || '—')}</td></tr>`;
    })
    .join('');
  const historyRows = history
    .map(
      (entry: any) =>
        `<tr><td style="${cellStyle}"><b>${escapeHtml(entry.projects?.name || 'פרויקט')}</b><br/><span style="color:#64748b">${escapeHtml(entry.projects?.location || '')}</span></td><td style="${cellStyle}">${escapeHtml(entry.new_status)}</td><td style="${cellStyle}">${escapeHtml(entry.profiles?.full_name || 'משתמש')}</td><td style="${cellStyle}">${escapeHtml(formatDateTime(entry.created_at))}</td><td style="${cellStyle}">${escapeHtml(entry.note || '—')}</td></tr>`,
    )
    .join('');
  const equipment = insights.equipment;
  const equipmentText = equipment.importTitle
    ? `הייבוא האחרון: <b>${escapeHtml(equipment.importTitle)}</b> · ${equipment.workerCount} רשומות עובדים · ${equipment.itemCount} פריטים מסומנים · עודכן ${escapeHtml(formatDateTime(equipment.importedAt))}`
    : 'לא נמצא ייבוא ציוד פעיל להצגה.';

  return `
    <div dir="rtl" style="font-family:Arial,sans-serif;line-height:1.55;color:#17324d;max-width:1100px;margin:auto;background:#f7fafc;padding:20px">
      <div style="background:linear-gradient(135deg,#0b2b53,#155e8b);color:#fff;border-radius:16px;padding:22px">
        <h1 style="font-size:24px;margin:0 0 4px">סיכום ניהולי יומי</h1>
        <div style="opacity:.85">מערכת משימות מאיה · ${escapeHtml(formatReportDate(now))}</div>
      </div>

      <table role="presentation" style="width:100%;border-collapse:collapse;margin:12px 0"><tr>
        ${metricCard('עובדים שדיווחו', insights.metrics.workersReported, '#117a65')}
        ${metricCard('טרם דיווחו', insights.metrics.workersNotReported, insights.metrics.workersNotReported ? '#b86b00' : '#117a65')}
        ${metricCard('משמרות פתוחות', insights.metrics.openSessions, insights.metrics.openSessions ? '#b42318' : '#117a65')}
        ${metricCard('פעולות דחופות', insights.metrics.highPriorityCount, insights.metrics.highPriorityCount ? '#b42318' : '#117a65')}
      </tr><tr>
        ${metricCard('פרויקטים פעילים', insights.metrics.activeProjects)}
        ${metricCard('דיווחי עבודה', insights.metrics.projectWorkEntries)}
        ${metricCard('שינויי סטטוס', insights.metrics.statusUpdates)}
        ${metricCard('סה״כ לטיפול', insights.metrics.actionCount, insights.metrics.actionCount ? '#b86b00' : '#117a65')}
      </tr></table>

      <div style="background:#fff;border:1px solid #d8e4ec;border-radius:14px;padding:16px;margin-bottom:14px">
        <h2 style="font-size:18px;margin:0 0 10px">מה דורש תשומת לב</h2>
        <table style="${tableStyle}"><tbody>${actionRows || `<tr><td style="${cellStyle};color:#117a65"><b>אין חריגות או פעולות פתוחות לפי כללי הדוח.</b></td></tr>`}</tbody></table>
        ${hiddenActions ? `<p style="color:#64748b;margin:10px 0 0">מוצגות 12 הפעולות הראשונות. קיימות עוד ${hiddenActions} פעולות במערכת.</p>` : ''}
      </div>

      <div style="background:#fff;border:1px solid #d8e4ec;border-radius:14px;padding:16px;margin-bottom:14px">
        <h2 style="font-size:18px;margin:0 0 10px">עובדי שטח שטרם דיווחו</h2>
        <table style="${tableStyle}"><thead style="${headerStyle}"><tr><th style="${cellStyle}">עובד</th><th style="${cellStyle}">דוא״ל</th></tr></thead><tbody>${notReportedRows || `<tr><td colspan="2" style="${cellStyle};color:#117a65">כל עובדי השטח דיווחו היום.</td></tr>`}</tbody></table>
      </div>

      <div style="background:#fff;border:1px solid #d8e4ec;border-radius:14px;padding:16px;margin-bottom:14px">
        <h2 style="font-size:18px;margin:0 0 10px">נוכחות כללית היום</h2>
        <div style="overflow-x:auto"><table style="${tableStyle}"><thead style="${headerStyle}"><tr><th style="${cellStyle}">עובד</th><th style="${cellStyle}">סוג</th><th style="${cellStyle}">כניסה</th><th style="${cellStyle}">יציאה</th><th style="${cellStyle}">משך</th><th style="${cellStyle}">הערה</th></tr></thead><tbody>${attendanceRows || `<tr><td colspan="6" style="${cellStyle}">לא נרשמה נוכחות כללית היום.</td></tr>`}</tbody></table></div>
      </div>

      <div style="background:#fff;border:1px solid #d8e4ec;border-radius:14px;padding:16px;margin-bottom:14px">
        <h2 style="font-size:18px;margin:0 0 10px">שעות לפי פרויקט</h2>
        <div style="overflow-x:auto"><table style="${tableStyle}"><thead style="${headerStyle}"><tr><th style="${cellStyle}">עובד</th><th style="${cellStyle}">פרויקט</th><th style="${cellStyle}">התחלה</th><th style="${cellStyle}">סיום</th><th style="${cellStyle}">משך</th><th style="${cellStyle}">הערה</th></tr></thead><tbody>${sessionRows || `<tr><td colspan="6" style="${cellStyle}">לא נרשמו שעות עבודה היום.</td></tr>`}</tbody></table></div>
      </div>

      <div style="background:#fff;border:1px solid #d8e4ec;border-radius:14px;padding:16px;margin-bottom:14px">
        <h2 style="font-size:18px;margin:0 0 10px">שינויי סטטוס היום</h2>
        <div style="overflow-x:auto"><table style="${tableStyle}"><thead style="${headerStyle}"><tr><th style="${cellStyle}">פרויקט</th><th style="${cellStyle}">סטטוס חדש</th><th style="${cellStyle}">עודכן על ידי</th><th style="${cellStyle}">מועד</th><th style="${cellStyle}">הערה</th></tr></thead><tbody>${historyRows || `<tr><td colspan="5" style="${cellStyle}">לא נרשמו שינויי סטטוס היום.</td></tr>`}</tbody></table></div>
      </div>

      <div style="background:#fff;border:1px solid #d8e4ec;border-radius:14px;padding:16px;margin-bottom:14px">
        <h2 style="font-size:18px;margin:0 0 6px">תמונת מצב ציוד</h2>
        <p style="margin:0">${equipmentText}</p>
      </div>

      ${appUrl ? `<p style="text-align:center;margin:20px 0 4px"><a href="${escapeHtml(appUrl)}" style="display:inline-block;background:#f47c42;color:#071e41;text-decoration:none;font-weight:800;padding:11px 20px;border-radius:10px">כניסה למערכת</a></p>` : ''}
    </div>`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      throw new Error(
        'Missing SUPABASE_URL, SUPABASE_ANON_KEY or SUPABASE_SERVICE_ROLE_KEY',
      );
    }

    await requireManagerOrCron(req, supabaseUrl, anonKey);
    const body = await req.json().catch(() => ({}));
    const appUrl = safeAppUrl(body?.appUrl);
    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const now = new Date();
    if (body?.scheduled === true && getHourInTimeZone(now) !== 17) {
      return jsonResponse({
        ok: true,
        sentTo: 0,
        skipped: true,
        reason: 'outside local send hour',
      });
    }
    const day = getDayBounds(now);

    const [
      profilesResult,
      sessionsResult,
      attendanceResult,
      historyResult,
      projectsResult,
      equipmentImportResult,
    ] = await Promise.all([
      supabase
        .from('profiles')
        .select('id,email,full_name,role')
        .in('role', ['manager', 'field_worker']),
      supabase
        .from('work_sessions')
        .select(
          'worker_id,project_id,started_at,ended_at,end_note,profiles:worker_id(full_name,email),projects:project_id(name,client_name,location)',
        )
        .gte('started_at', day.start)
        .lt('started_at', day.end)
        .order('started_at', { ascending: true }),
      supabase
        .from('attendance_sessions')
        .select(
          'worker_id,started_at,ended_at,end_note,attendance_type,attendance_date,is_all_day,profiles:worker_id(full_name,email)',
        )
        .eq('attendance_date', day.dateKey)
        .order('started_at', { ascending: true }),
      supabase
        .from('status_history')
        .select(
          'new_status,note,created_at,profiles:changed_by(full_name),projects:project_id(name,client_name,location)',
        )
        .gte('created_at', day.start)
        .lt('created_at', day.end)
        .order('created_at', { ascending: true }),
      supabase
        .from('projects')
        .select(
          'id,name,client_name,location,status,due_date,updated_at,assigned_to,is_archived,profiles:assigned_to(full_name),project_tasks(id,title,is_done,created_at)',
        ),
      supabase
        .from('field_equipment_imports')
        .select('id,title,created_at')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    for (const result of [
      profilesResult,
      sessionsResult,
      attendanceResult,
      historyResult,
      projectsResult,
    ]) {
      if (result.error) throw result.error;
    }
    if (equipmentImportResult.error && !optionalTableUnavailable(equipmentImportResult.error)) {
      throw equipmentImportResult.error;
    }

    const profiles = profilesResult.data || [];
    const managers = profiles.filter((profile: any) => profile.role === 'manager' && profile.email);
    const workers = profiles.filter((profile: any) => profile.role === 'field_worker');
    const sessions = sessionsResult.data || [];
    const attendance = attendanceResult.data || [];
    const history = historyResult.data || [];
    const projects = projectsResult.data || [];
    const equipmentImport = equipmentImportResult.data || null;
    let equipmentRecords: any[] = [];

    if (equipmentImport?.id) {
      const equipmentRecordsResult = await supabase
        .from('field_equipment_records')
        .select('worker_name,checked_item_count')
        .eq('import_id', equipmentImport.id);
      if (equipmentRecordsResult.error && !optionalTableUnavailable(equipmentRecordsResult.error)) {
        throw equipmentRecordsResult.error;
      }
      equipmentRecords = equipmentRecordsResult.data || [];
    }

    const recipients = managers.map((manager: any) => manager.email).filter(Boolean);
    if (!recipients.length) return jsonResponse({ ok: true, sentTo: 0, reason: 'no managers' });

    const insights = buildDailyInsights({
      now,
      workers,
      sessions,
      attendance,
      history,
      projects,
      equipmentImport,
      equipmentRecords,
    });
    const reportDate = formatReportDate(now);
    const subjectPrefix = insights.metrics.highPriorityCount
      ? `${insights.metrics.highPriorityCount} פעולות דחופות · `
      : '';
    const subject = `${subjectPrefix}סיכום ניהולי יומי - מאיה - ${reportDate}`;
    const html = renderEmail({ now, appUrl, sessions, attendance, history, insights });

    const result = await sendEmail({ to: recipients, subject, html });
    return jsonResponse({ ok: true, sentTo: recipients.length, metrics: insights.metrics, result });
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500;
    if (!(error instanceof HttpError)) console.error('Daily manager summary failed:', error);
    return jsonResponse(
      { error: error instanceof HttpError ? error.message : 'Internal server error' },
      status,
    );
  }
});
