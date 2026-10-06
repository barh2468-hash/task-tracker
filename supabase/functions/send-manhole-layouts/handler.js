const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const MAX_EMAIL_BYTES = 18 * 1000 * 1000;
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const reply = (status, body) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
const escapeHtml = value => String(value || '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);

export function validateEmailPayload(body) {
  if (!body || !UUID.test(body.requestId || '') || !Array.isArray(body.layoutIds) || body.layoutIds.length < 1 || body.layoutIds.length > 5 || body.layoutIds.some(id => typeof id !== 'string' || !UUID.test(id))) throw new Error('יש לבחור בין פרישה אחת לחמש פרישות.');
  if (!Array.isArray(body.recipients) || !body.recipients.length || body.recipients.length > 10 || body.recipients.some(email => typeof email !== 'string' || email.length > 254 || !/^[^\s<>@,;]+@[^\s<>@,;]+\.[^\s<>@,;]+$/.test(email))) throw new Error('יש להזין עד 10 כתובות מייל תקינות.');
  if (typeof body.subject !== 'string' || !body.subject.trim() || body.subject.length > 200 || /[\r\n]/.test(body.subject) || typeof body.message !== 'string' || body.message.length > 2000) throw new Error('נושא או הודעת המייל אינם תקינים.');
  return { requestId: body.requestId, layoutIds: [...new Set(body.layoutIds)].sort(), recipients: [...new Set(body.recipients.map(email => email.toLowerCase()))].sort(), subject: body.subject.trim(), message: body.message };
}

export function buildLayoutEmail(payload, rows, attachments) {
  const details = rows.map(row => `${row.project_name} · שוחה ${row.manhole_number} · ${row.file_name}`);
  return {
    to: payload.recipients, subject: payload.subject,
    text: ['פרישת שוחות', payload.message, 'קובצי הפרישות מצורפים למייל, כולל תמונות.', ...details].filter(Boolean).join('\n\n'),
    html: `<!doctype html><html lang="he" dir="rtl"><body style="margin:0;background:#f3f7fb;font-family:Arial,sans-serif;color:#10213f"><div style="max-width:600px;margin:24px auto;padding:24px;background:#fff;border-radius:16px"><h1 style="font-size:24px;color:#0b3565">פרישת שוחות</h1>${payload.message ? `<p style="font-size:16px;line-height:1.7;white-space:pre-wrap">${escapeHtml(payload.message)}</p>` : ''}<p style="font-size:16px;line-height:1.7">קובצי הפרישות מצורפים למייל, כולל תמונות.</p><ul style="font-size:16px;line-height:1.7">${details.map(detail => `<li>${escapeHtml(detail)}</li>`).join('')}</ul></div></body></html>`,
    attachments,
  };
}

export function createLayoutEmailHandler({ createClient, sendEmail, env }) {
  return async req => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
    if (req.method !== 'POST') return reply(405, { error: 'Method not allowed' });
    const authHeader = req.headers.get('Authorization') || '';
    if (!/^Bearer\s+\S+$/i.test(authHeader)) return reply(401, { error: 'יש להתחבר כדי לשלוח פרישות.' });
    let admin, reservation, smtpStarted = false;
    try {
      const url = env('SUPABASE_URL'), anon = env('SUPABASE_ANON_KEY'), service = env('SUPABASE_SERVICE_ROLE_KEY');
      if (!url || !anon || !service) return reply(503, { error: 'שירות שליחת הפרישות אינו זמין כרגע.' });
      const userClient = createClient(url, anon, { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false, autoRefreshToken: false } });
      const { data: auth, error: authError } = await userClient.auth.getUser();
      if (authError || !auth?.user) return reply(401, { error: 'יש להתחבר מחדש כדי לשלוח פרישות.' });
      if (['SMTP_HOST', 'SMTP_USER', 'SMTP_PASSWORD', 'SMTP_FROM'].some(name => !env(name)?.trim())) return reply(503, { error: 'שירות המייל אינו מוגדר במערכת. יש לפנות למנהל.' });
      let payload;
      try {
        const raw = await req.text();
        if (raw.length > 12000) return reply(413, { error: 'הבקשה גדולה מדי.' });
        payload = validateEmailPayload(JSON.parse(raw));
      } catch (error) { return reply(400, { error: error instanceof SyntaxError ? 'בקשת המייל אינה תקינה.' : error.message }); }
      const { data: rows, error: rowsError } = await userClient.from('project_manhole_layouts').select('id,project_id,created_by,project_name,manhole_number,file_name,pdf_path,pdf_size').in('id', payload.layoutIds);
      if (rowsError) return reply(503, { error: 'לא ניתן לטעון את הפרישות לשליחה.' });
      if (!rows || rows.length !== payload.layoutIds.length) return reply(403, { error: 'אין הרשאה לשלוח אחת מהפרישות שנבחרו.' });
      if (rows.reduce((size, row) => size + Number(row.pdf_size), 0) > MAX_EMAIL_BYTES) return reply(413, { error: 'הקבצים גדולים מדי. בחרו פחות פרישות, עד 18 MB.' });
      const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(payload)));
      const hash = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
      admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
      const { data: reserved, error: reserveError } = await admin.rpc('reserve_manhole_email_request', { request_id: payload.requestId, actor_id: auth.user.id, payload_hash: hash });
      if (reserveError) return reply(reserveError.message?.includes('mail_rate_limited') ? 429 : 503, { error: reserveError.message?.includes('mail_rate_limited') ? 'נשלחו יותר מדי בקשות מייל. נסו שוב בעוד שעה.' : 'לא ניתן להתחיל את השליחה. נסו שוב.' });
      if (reserved.existing) {
        if (reserved.user_id !== auth.user.id || reserved.request_hash !== hash) return reply(409, { error: 'בקשת השליחה השתנתה. סגרו ופתחו מחדש את חלון המייל.' });
        if (reserved.status === 'sent') return reply(200, { ok: true, ...reserved.result });
        const pendingStale = reserved.status === 'pending' && Date.now() - Date.parse(reserved.created_at) > 120000;
        return reply(409, { error: reserved.status === 'pending' && !pendingStale ? 'השליחה עדיין מתבצעת. המתינו ולחצו על בדיקת מצב השליחה.' : reserved.status === 'unknown' || pendingStale ? 'מצב השליחה אינו ודאי. בדקו עם הנמענים לפני פתיחת בקשת שליחה חדשה.' : 'השליחה נכשלה. סגרו ופתחו מחדש את חלון המייל כדי לנסות שוב.' });
      }
      reservation = reserved;
      const attachments = [];
      const names = new Map();
      let total = 0;
      for (const row of rows) {
        if (row.pdf_path !== `${row.project_id}/${row.created_by}/${row.id}/report.pdf`) throw new Error('Invalid saved path');
        const { data: pdf, error } = await userClient.storage.from('manhole-layouts').download(row.pdf_path);
        if (error || !pdf) throw new Error('Could not read PDF');
        total += pdf.size;
        if (total > MAX_EMAIL_BYTES) throw new Error('Attachment size exceeds limit');
        const bytes = new Uint8Array(await pdf.arrayBuffer());
        if (new TextDecoder().decode(bytes.slice(0, 5)) !== '%PDF-') throw new Error('Invalid PDF');
        const occurrence = (names.get(row.file_name) || 0) + 1;
        names.set(row.file_name, occurrence);
        const filename = occurrence > 1 ? `${row.file_name.replace(/\.pdf$/i, '')} (${occurrence}).pdf` : row.file_name;
        attachments.push({ filename, content: bytes, contentType: 'application/pdf' });
      }
      smtpStarted = true;
      const result = await sendEmail(buildLayoutEmail(payload, rows, attachments));
      if (!result.accepted?.length) throw new Error('No accepted recipients');
      const savedResult = { accepted: result.accepted, rejected: result.rejected || [], messageId: result.messageId };
      const { error: statusError } = await admin.from('manhole_layout_email_requests').update({ status: 'sent', result: savedResult }).eq('id', payload.requestId);
      if (statusError) return reply(200, { ok: true, ...savedResult });
      return reply(200, { ok: true, ...savedResult });
    } catch {
      if (reservation && admin) {
        try { await admin.from('manhole_layout_email_requests').update({ status: smtpStarted ? 'unknown' : 'failed' }).eq('id', reservation.id); } catch { /* Keep the reservation; never send a duplicate after an uncertain response. */ }
      }
      return reply(503, { error: smtpStarted ? 'לא ניתן לאשר את השליחה. בדקו עם הנמענים לפני ניסיון נוסף.' : 'לא ניתן להכין את המייל. סגרו את החלון ונסו שוב.' });
    }
  };
}
