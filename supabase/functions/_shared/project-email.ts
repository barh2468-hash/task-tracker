import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import type { StatusEmailTheme } from './status-email-theme.ts';

// Card layout shared by the project emails, matching the notify-status-change design.

export function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function formatIsraelDate(value: string) {
  return new Intl.DateTimeFormat('he-IL', {
    timeZone: 'Asia/Jerusalem',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(value));
}

// The execution start date is the first check-in (work session) on the project.
export async function getExecutionStartDate(adminClient: SupabaseClient, projectId: string) {
  const { data: firstWorkSession, error } = await adminClient
    .from('work_sessions')
    .select('started_at')
    .eq('project_id', projectId)
    .order('started_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return firstWorkSession?.started_at ? formatIsraelDate(firstWorkSession.started_at) : null;
}

export function executionStartLine(executionStartDate: string | null) {
  return `תאריך תחילת ביצוע: ${executionStartDate || 'לא נמצא דיווח כניסה'}`;
}

// A colored callout with a thick right border, like the drafting box in the status email.
export function highlightBlock(theme: StatusEmailTheme, innerHtml: string) {
  return `
                <tr>
                  <td style="padding:0 30px 18px">
                    <div style="padding:15px 17px;border-right:5px solid ${theme.accent};border-radius:12px;background:${theme.background};color:${theme.text};font-size:14px;line-height:1.65">
                      ${innerHtml}
                    </div>
                  </td>
                </tr>`;
}

// A neutral boxed section with a bold title, like the note box in the status email.
export function noteBlock(title: string, innerHtml: string) {
  return `
                <tr>
                  <td style="padding:0 30px 18px">
                    <div style="padding:15px 17px;border:1px solid #dbe7f1;border-radius:12px;background:#f7fbff;color:#334155;font-size:14px;line-height:1.65">
                      <div style="margin-bottom:4px;color:#0b2545;font-weight:700">${escapeHtml(title)}</div>
                      ${innerHtml}
                    </div>
                  </td>
                </tr>`;
}

type ProjectEmailOptions = {
  theme: StatusEmailTheme;
  title: string;
  icon?: string;
  projectName: string;
  clientName?: string | null;
  location?: string | null;
  // Pre-rendered <tr> rows placed between the project header and the details table.
  blocks?: string[];
  details?: Array<{ label: string; value: string }>;
  appUrl?: string | null;
};

export function renderProjectEmail(options: ProjectEmailOptions) {
  const { theme } = options;
  const details = options.details || [];
  return `
      <div dir="rtl" style="margin:0;padding:24px 12px;background:#eef4fa;font-family:Arial,Helvetica,sans-serif;color:#10213f">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;border-collapse:collapse">
          <tr>
            <td align="center">
              <table role="presentation" width="640" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:640px;border-collapse:separate;background:#ffffff;border:1px solid #dfe8f2;border-radius:20px;overflow:hidden;box-shadow:0 14px 36px rgba(7,30,65,.10)">
                <tr><td style="height:6px;background:${theme.accent};font-size:0;line-height:0">&nbsp;</td></tr>
                <tr>
                  <td style="padding:26px 30px;background:#0b2a55;color:#ffffff">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse:collapse">
                      <tr>
                        <td style="text-align:right">
                          <div style="font-size:12px;font-weight:700;letter-spacing:1.6px;color:#9bd8ff">MAYA TRACKER</div>
                          <h1 style="margin:7px 0 5px;font-size:25px;line-height:1.3;color:#ffffff">${escapeHtml(options.title)}</h1>
                          <p style="margin:0;color:#d7e8f7;font-size:14px">כל הפרטים החשובים, במקום אחד</p>
                        </td>
                        <td width="58" valign="middle" style="width:58px;text-align:left">
                          <div style="width:48px;height:48px;border-radius:15px;background:${theme.accent};color:#ffffff;font-size:25px;font-weight:700;line-height:48px;text-align:center">${options.icon || '✓'}</div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding:28px 30px 18px">
                    <div style="font-size:13px;font-weight:700;color:#64748b">פרויקט</div>
                    <h2 style="margin:4px 0 6px;color:#0b2545;font-size:23px;line-height:1.35">${escapeHtml(options.projectName)}</h2>
                    <p style="margin:0;color:#64748b;font-size:14px">${escapeHtml(options.clientName || 'לקוח לא צוין')} · ${escapeHtml(options.location || 'מיקום לא צוין')}</p>
                  </td>
                </tr>
                ${(options.blocks || []).join('')}
                ${
                  details.length
                    ? `
                <tr>
                  <td style="padding:0 30px 22px">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;border-collapse:collapse;background:#ffffff;border:1px solid #e6edf4;border-radius:12px">
                      ${details
                        .map(
                          (row, index) => `
                      <tr>
                        <td style="padding:12px 15px;${index < details.length - 1 ? 'border-bottom:1px solid #edf2f7;' : ''}color:#64748b;font-size:13px">${escapeHtml(row.label)}</td>
                        <td style="padding:12px 15px;${index < details.length - 1 ? 'border-bottom:1px solid #edf2f7;' : ''}text-align:left;color:#0b2545;font-size:13px;font-weight:700">${escapeHtml(row.value)}</td>
                      </tr>`,
                        )
                        .join('')}
                    </table>
                  </td>
                </tr>`
                    : ''
                }
                ${
                  options.appUrl
                    ? `
                <tr>
                  <td align="center" style="padding:0 30px 30px">
                    <a href="${escapeHtml(options.appUrl)}" style="display:inline-block;padding:13px 24px;border-radius:12px;background:#0b2a55;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none">פתיחת הפרויקט במערכת</a>
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
}
