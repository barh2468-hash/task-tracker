import { authorizeUrl, readConfig, IntakeError, safeGraphUrl } from '../gpr-microsoft/core.js';
import { today, addDays, normalize, emailValid } from '../../../src/features/quotes/model.js';
export { IntakeError };
export function configForQuotes(env) {
  return { ...readConfig(env), endpoint: `${env('SUPABASE_URL')}/functions/v1/quotes-microsoft` };
}
export function connectUrl(config, state, challenge, mailbox) {
  const url = new URL(authorizeUrl(config, state, challenge, mailbox));
  url.searchParams.set(
    'scope',
    'https://graph.microsoft.com/Mail.ReadWrite https://graph.microsoft.com/Mail.Send https://graph.microsoft.com/User.Read offline_access',
  );
  return url.href;
}
export function hasScopes(scope) {
  const set = new Set(
    String(scope || '')
      .toLowerCase()
      .split(/\s+/)
      .map((s) => s.replace('https://graph.microsoft.com/', '')),
  );
  return set.has('mail.readwrite') && set.has('mail.send');
}
export async function graph(path, token, { method = 'GET', body, fetcher = fetch } = {}) {
  const url = safeGraphUrl(
    path.startsWith('https:') ? path : `https://graph.microsoft.com/v1.0${path}`,
  );
  const response = await fetcher(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Prefer: 'outlook.body-content-type="text", IdType="ImmutableId"',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(12000),
    redirect: 'error',
  });
  if (!response.ok)
    throw new IntakeError(
      response.status === 401
        ? 'reconnect'
        : response.status === 429
          ? 'throttled'
          : response.status === 403
            ? 'permission_missing'
            : response.status === 404
              ? 'not_found'
              : 'microsoft_error',
      response.status === 429 ? 429 : 502,
    );
  return response.status === 202 || response.status === 204 ? null : response.json();
}
export function safeFolderCursor(raw, folderId) {
  const url = new URL(safeGraphUrl(raw));
  if (decodeURIComponent(url.pathname) !== `/v1.0/me/mailFolders/${folderId}/messages`)
    throw new IntakeError('graph_url', 502);
  return url.href;
}
export function sendingWindow(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Jerusalem',
    weekday: 'short',
    hour: 'numeric',
    hourCycle: 'h23',
  }).formatToParts(now);
  return (
    !['Fri', 'Sat'].includes(parts.find((p) => p.type === 'weekday').value) &&
    Number(parts.find((p) => p.type === 'hour').value) >= 8 &&
    Number(parts.find((p) => p.type === 'hour').value) < 16
  );
}
export function matchQuote(state, subject, body) {
  const text = `${subject}\n${body}`;
  const candidates = state.quotes.filter((q) =>
    new RegExp(
      `(^|[^\\p{L}\\p{N}])${q.number.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[^\\p{L}\\p{N}])`,
      'iu',
    ).test(text),
  );
  return candidates.length === 1 ? candidates[0] : null;
}
export function mailCandidate(meta, state) {
  const sender = String(meta.from?.emailAddress?.address || '').toLowerCase();
  const actual = String(meta.sender?.emailAddress?.address || sender).toLowerCase();
  if (meta.isDraft || !emailValid(sender) || sender !== actual) return false;
  // Address membership is a filter, never authority to execute free-form content.
  return (
    state.settings.allowedSenders.includes(sender) || state.clients.some((c) => c.email === sender)
  );
}
export function incomingRecord(meta, full, state) {
  if (full.body?.contentType?.toLowerCase() !== 'text')
    throw new IntakeError('plain_text_required');
  const sender = meta.from.emailAddress.address.toLowerCase();
  const body = String(full.body?.content || '').slice(0, 100000),
    subject = String(meta.subject || '').slice(0, 500);
  const match = matchQuote(state, subject, body);
  return {
    id: crypto.randomUUID(),
    sender,
    subject,
    body,
    receivedAt: meta.receivedDateTime,
    status: 'pending',
    quoteId: '',
    suggestedQuoteId: match?.id || '',
    verification: 'microsoft_graph',
    fingerprint: String(meta.internetMessageId || meta.id),
  };
}
const escapeHtml = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
const labels = {
  interested: 'מעוניינים להתקדם',
  signatures: 'סבב חתימות',
  developer: 'בדיקה מול היזם',
  undecided: 'טרם התקבלה החלטה',
  approval: 'הועברה לאישור המזמין',
  date: 'חזרו אלי בתאריך',
  other: 'אחר, עם הערה',
  cancelled: 'הפרויקט בוטל',
  other_vendor: 'נבחר ספק אחר',
  irrelevant: 'לא רלוונטי',
};
export function followupMail(quote, client, token, endpoint, mailbox) {
  // Reply-by-email works with the existing production frontend too. A customer's
  // email is queued for review and never treated as an instruction to the agent.
  const linkFor = (key, label) =>
    `mailto:${encodeURIComponent(mailbox)}?${new URLSearchParams({ subject: `Re: הצעת מחיר ${quote.number} — ${quote.title}`.slice(0, 250), body: `${label}\n\nהצעה ${quote.number}` })}`;
  const hello = escapeHtml(client.contact || client.name);
  const detail = `הצעה ${escapeHtml(quote.number)} — ${escapeHtml(quote.title)}`;
  const links = Object.entries(labels)
    .map(
      ([key, label]) =>
        `<p><a href="${escapeHtml(linkFor(key, label))}" style="display:inline-block;padding:10px 16px;color:#176991;border:1px solid #dbe4ed;border-radius:6px;text-decoration:none">${label}</a></p>`,
    )
    .join('');
  return {
    subject: `עדכון לגבי הצעת מחיר ${quote.number} — ${quote.title}`
      .replace(/[\r\n]/g, ' ')
      .slice(0, 250),
    body: {
      contentType: 'HTML',
      content: `<html lang="he" dir="rtl"><body style="font-family:Arial,sans-serif;color:#10213f;text-align:right"><h2>קבוצת מאיה</h2><p>שלום ${hello},</p><p>נשמח לעדכון לגבי ${detail}, שנשלחה בתאריך ${escapeHtml(quote.sentAt)}.</p><p>מה מצב ההצעה אצלכם? לחיצה על אפשרות מכינה תשובה בתיבת המייל שלכם. אשרו את שליחתה כדי להעביר אותה לפלג.</p>${links}<p>אפשר גם להשיב למייל הזה ופלג יטפל בתשובה.</p><p><a href="${escapeHtml(linkFor('opt_out', 'אבקש להסיר אותי ממיילי מעקב'))}">בקשת הסרה ממיילי מעקב</a></p></body></html>`,
    },
    internetMessageHeaders: [{ name: 'x-maya-quote', value: quote.id }],
    toRecipients: [{ emailAddress: { address: client.email } }],
  };
}
export function followupState(quote, jobs, settings, now = new Date()) {
  const relevant = jobs.filter((j) => j.quote_id === quote.id && j.cycle === quoteCycle(quote));
  const sent = relevant.filter((j) => j.status === 'sent').sort((a, b) => b.round_no - a.round_no);
  const last = sent[0];
  if (
    last &&
    last.round_no >= settings.maxEmails &&
    addDays(today(new Date(last.sent_at)), settings.reminderDays) <= today(now)
  )
    return { attention: true };
  return { round: (last?.round_no || 0) + 1, last };
}
export function quoteCycle(quote) {
  const marker = quote.events.find((e) =>
    ['response', 'reopened', 'resume', 'snooze'].includes(e.type),
  );
  return marker?.id || quote.id;
}
export function dueQuote(quote, client, now = new Date()) {
  return (
    quote.status === 'open' &&
    ['waiting', 'awaiting_reply', 'snoozed'].includes(quote.tracking) &&
    quote.nextFollowup &&
    quote.nextFollowup <= today(now) &&
    client &&
    emailValid(client.email) &&
    !client.optOut
  );
}
export function validateSnapshot(state) {
  if (
    state.quotes.length > 5000 ||
    state.clients.length > 5000 ||
    state.messages.length > 1000 ||
    JSON.stringify(state).length > 6_000_000
  )
    throw new IntakeError('workspace_limit', 413);
  const ids = new Set();
  for (const q of state.quotes) {
    if (!/^[a-f0-9-]{36}$/i.test(q.id) || ids.has(normalize(q.number)))
      throw new IntakeError('settings_invalid');
    ids.add(normalize(q.number));
  }
}
